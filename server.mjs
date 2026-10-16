#!/usr/bin/env node
/* DhakaPath dev server — no dependencies.
 *
 *   GET  /api/config  → public client config. Returns the CARTO key but NEVER the Gemini key.
 *   POST /api/chat    → streams the Transit AI reply as SSE (send {"stream":false} for plain JSON).
 *                       The Gemini key stays server-side.
 *   GET  /*           → static files (dotfiles such as .env are refused).
 *
 *   node server.mjs
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PORT = Number(process.env.PORT || 8000);

/* Overridable so the streaming path can be pointed at a gateway or a local mock. */
const API_BASE = () => (process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8'
};

const SYSTEM_PROMPT = `You are the DhakaPath Transit Dispatch AI for Dhaka, Bangladesh.
Answer using ONLY the live network snapshot provided below. Never invent fares, routes or disruptions.
Be concise: 2-4 short sentences, or a compact list when comparing options. Quote fares in BDT with the
৳ symbol, and mention transfers, on-time reliability or a relevant live alert when useful.
If the rider writes in Bangla, answer in Bangla. If the snapshot genuinely cannot answer the question,
say what is missing and suggest what to check in the app instead of guessing.`;

/* Read .env into process.env (existing variables win). */
async function loadDotEnv() {
  let raw;
  try {
    raw = await readFile(join(ROOT, '.env'), 'utf8');
  } catch {
    return; // .env is optional
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

/* Primary model first, then any configured fallbacks. */
function modelChain() {
  return [...new Set([
    process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    ...(process.env.GEMINI_FALLBACK_MODELS || '')
      .split(',')
      .map(name => name.trim())
      .filter(Boolean)
  ])];
}

/* Thinking models spend output budget on internal reasoning, which truncates short
   answers and adds latency. Ask for low thinking where supported, and drop the field
   for models that reject it.

   process.env is read inside the function on purpose: .env is loaded after the module
   body runs, so caching the value at load time would silently ignore GEMINI_THINKING_LEVEL. */
let thinkingSupported = true;

function generationConfigs() {
  const base = {
    temperature: 0.4,
    maxOutputTokens: Number(process.env.GEMINI_MAX_OUTPUT_TOKENS || 2048)
  };

  const configs = [];
  if (thinkingSupported && process.env.GEMINI_THINKING_LEVEL) {
    configs.push({ ...base, thinkingConfig: { thinkingLevel: process.env.GEMINI_THINKING_LEVEL } });
  }
  configs.push(base);
  return configs;
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

async function readJsonBody(req, limit = 64_000) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('payload too large');
    chunks.push(chunk);
  }

  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function buildPayload({ message, history, context }, generationConfig) {
  const turns = (Array.isArray(history) ? history : []).slice(-6).map(turn => ({
    role: turn.role === 'model' ? 'model' : 'user',
    parts: [{ text: String(turn.text || '').slice(0, 2000) }]
  }));

  const snapshot = `${SYSTEM_PROMPT}\n\nLive network snapshot:\n${String(context || '').slice(0, 8000)}`;

  return {
    systemInstruction: { parts: [{ text: snapshot }] },
    contents: [...turns, { role: 'user', parts: [{ text: String(message).slice(0, 4000) }] }],
    generationConfig
  };
}

/* Statuses worth retrying on another model: retired, busy or rate limited. */
const RETRYABLE = [404, 429, 500, 503];

function recordFailure(attempts, label, data, status) {
  attempts.push(`${label}: ${data?.error?.status || status} ${data?.error?.message || ''}`.trim());
}

/* ---------------------------------------------------------------- non-streaming */
async function callGemini({ message, history, context }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set in .env');

  const timeoutMs = Number(process.env.GEMINI_TIMEOUT_MS || 45_000);
  const attempts = [];

  for (const model of modelChain()) {
    for (const generationConfig of generationConfigs()) {
      const label = generationConfig.thinkingConfig ? `${model} (low thinking)` : model;
      let response;

      try {
        response = await fetch(`${API_BASE()}/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
          body: JSON.stringify(buildPayload({ message, history, context }, generationConfig)),
          signal: AbortSignal.timeout(timeoutMs)
        });
      } catch (error) {
        attempts.push(`${label}: ${error.name === 'TimeoutError' ? `timed out after ${timeoutMs}ms` : error.message}`);
        continue;
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        recordFailure(attempts, label, data, response.status);
        if (response.status === 400 && generationConfig.thinkingConfig) {
          thinkingSupported = false;
          continue;
        }
        break;
      }

      const candidate = data?.candidates?.[0];
      const reply = (candidate?.content?.parts || [])
        .filter(part => part.thought !== true)
        .map(part => part.text || '')
        .join('')
        .trim();

      if (reply) {
        if (candidate?.finishReason === 'MAX_TOKENS') {
          console.warn(`[chat] ${label} stopped at MAX_TOKENS — raise GEMINI_MAX_OUTPUT_TOKENS`);
        }
        return { reply, model, attempts };
      }

      if (data?.promptFeedback?.blockReason) {
        return { reply: 'That question was blocked by the model safety filter — try rephrasing it.', model, attempts };
      }

      attempts.push(`${label}: empty completion (${candidate?.finishReason || 'unknown reason'})`);
    }
  }

  throw new Error(`All Gemini models failed. ${attempts.join(' | ')}`);
}

/* -------------------------------------------------------------------- streaming */

/* Frame-by-frame SSE reader: Gemini sends `data: {json}` records. */
async function* geminiEvents(body) {
  const decoder = new TextDecoder();
  let buffer = '';

  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true }).replace(/\r\n/g, '\n');

    let boundary;
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      for (const line of frame.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const raw = line.slice(5).trim();
        if (!raw) continue;
        try {
          yield JSON.parse(raw);
        } catch {
          // ignore keep-alive or malformed frames
        }
      }
    }
  }
}

/* Flattens Gemini's stream into { text } / { finishReason } / { blockReason } events.
   Reasoning parts are dropped so internal thoughts never reach the rider. */
async function* streamDeltas(body) {
  for await (const event of geminiEvents(body)) {
    if (event?.promptFeedback?.blockReason) {
      yield { blockReason: event.promptFeedback.blockReason };
      return;
    }

    const candidate = event?.candidates?.[0];

    for (const part of candidate?.content?.parts || []) {
      if (part.thought === true) continue;
      if (part.text) yield { text: part.text };
    }

    if (candidate?.finishReason) yield { finishReason: candidate.finishReason };
  }
}

/* Opens a streaming connection, walking the model chain until one accepts it.
   Once bytes start flowing we are committed — no further fallback is possible. */
async function openGeminiStream({ message, history, context }, signal) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set in .env');

  const attempts = [];

  for (const model of modelChain()) {
    for (const generationConfig of generationConfigs()) {
      const label = generationConfig.thinkingConfig ? `${model} (low thinking)` : model;
      let response;

      try {
        response = await fetch(`${API_BASE()}/models/${model}:streamGenerateContent?alt=sse`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
          body: JSON.stringify(buildPayload({ message, history, context }, generationConfig)),
          signal
        });
      } catch (error) {
        throw new Error(`Gemini request failed: ${error.message}`);
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        recordFailure(attempts, label, data, response.status);
        if (response.status === 400 && generationConfig.thinkingConfig) {
          thinkingSupported = false;
          continue;
        }
        if (RETRYABLE.includes(response.status)) break; // try the next model
        throw new Error(attempts.join(' | '));
      }

      return { model, body: response.body, attempts };
    }
  }

  throw new Error(`All Gemini models failed. ${attempts.join(' | ')}`);
}

async function streamChat(req, res, request) {
  const streamTimeoutMs = Number(process.env.GEMINI_STREAM_TIMEOUT_MS || 180_000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), streamTimeoutMs);

  // Stop paying for tokens if the rider navigates away mid-answer
  res.on('close', () => controller.abort());

  let opened;
  try {
    opened = await openGeminiStream(request, controller.signal);
  } catch (error) {
    clearTimeout(timer);
    return sendJson(res, 502, { error: error.message });
  }

  if (opened.attempts.length) console.log(`[chat] fallbacks → ${opened.attempts.join(' | ')}`);
  const started = Date.now();
  console.log(`[chat] streaming ${opened.model}`);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const send = payload => res.write(`data: ${JSON.stringify(payload)}\n\n`);
  send({ type: 'meta', model: opened.model });

  let text = '';
  let finishReason = null;
  let blocked = null;
  let firstChunkMs = null;

  try {
    for await (const event of streamDeltas(opened.body)) {
      if (event.text) {
        if (firstChunkMs === null) firstChunkMs = Date.now() - started;
        text += event.text;
        send({ type: 'chunk', text: event.text });
      }
      if (event.finishReason) finishReason = event.finishReason;
      if (event.blockReason) blocked = event.blockReason;
    }

    if (blocked) {
      send({ type: 'error', error: 'That question was blocked by the model safety filter — try rephrasing it.' });
    } else if (!text.trim()) {
      send({ type: 'error', error: `The model returned no text (${finishReason || 'unknown reason'}).` });
    } else {
      send({
        type: 'done',
        model: opened.model,
        characters: text.length,
        truncated: finishReason === 'MAX_TOKENS'
      });
    }
  } catch (error) {
    const aborted = controller.signal.aborted;
    send({ type: 'error', error: aborted ? 'The answer timed out before it finished.' : error.message, partial: text });
  } finally {
    clearTimeout(timer);
    res.end();
    console.log(`[chat] ${opened.model} streamed ${text.length} chars, first chunk ${firstChunkMs ?? 'n/a'}ms, total ${Date.now() - started}ms`);
  }
}

/* ----------------------------------------------------------------------- weather */
/*
  GET /api/weather → Dhaka hour-by-hour rainfall for the Monsoon Shield model.

  Upstream is Open-Meteo (free, no key). The response is reshaped to the 24-hour
  rain array the browser model expects and cached for 15 minutes, so a room full
  of judges hammering the panel makes one upstream call at most. If the upstream
  fetch fails the endpoint answers 200 with a bundled, clearly-labelled sample so
  the feature degrades instead of breaking.
*/
const WEATHER_TTL_MS = 15 * 60 * 1000;
const weatherCache = { at: 0, payload: null };

const SAMPLE_FORECAST = {
  source: 'offline-sample',
  label: 'Offline sample forecast',
  place: 'Dhaka',
  degraded: true,
  hourly: {
    time: Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, '0')}:00`),
    rain: [0, 0, 0, 0, 0.2, 0.6, 0.4, 0, 0, 0, 0, 0, 0.4, 1.2, 3.4, 7.8, 11.2, 8.6, 4.2, 1.4, 0.6, 0.2, 0, 0],
    temperature: [26, 26, 25, 25, 26, 28, 30, 31, 32, 33, 33, 34, 34, 33, 31, 30, 29, 28, 28, 27, 27, 27, 26, 26]
  }
};

async function getWeather() {
  const now = Date.now();
  if (weatherCache.payload && now - weatherCache.at < WEATHER_TTL_MS) {
    return { ...weatherCache.payload, cached: true };
  }

  const url = 'https://api.open-meteo.com/v1/forecast'
    + '?latitude=23.8103&longitude=90.4125'
    + '&hourly=precipitation,temperature_2m'
    + '&forecast_days=1&timezone=Asia%2FDhaka';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`);
    const data = await response.json();

    const rain = (data?.hourly?.precipitation || []).slice(0, 24).map(value => Number(value) || 0);
    const temperature = (data?.hourly?.temperature_2m || []).slice(0, 24).map(value => Number(value));
    if (rain.length !== 24) throw new Error('unexpected forecast shape');

    const payload = {
      source: 'open-meteo',
      label: 'Live forecast (Open-Meteo)',
      place: 'Dhaka',
      fetchedAt: new Date().toISOString(),
      degraded: false,
      hourly: {
        time: (data?.hourly?.time || []).slice(0, 24).map(stamp => String(stamp).slice(11, 16)),
        rain,
        temperature
      }
    };

    weatherCache.at = now;
    weatherCache.payload = payload;
    console.log(`[weather] live forecast cached (${rain.reduce((sum, mm) => sum + mm, 0).toFixed(1)} mm today)`);
    return payload;
  } catch (error) {
    console.warn(`[weather] falling back to the sample forecast: ${error.message}`);
    return { ...SAMPLE_FORECAST, fetchedAt: new Date().toISOString(), reason: error.message };
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------------ static */
async function serveStatic(res, pathname) {
  const relative = decodeURIComponent(pathname).replace(/^\/+/, '');
  const target = resolve(join(ROOT, normalize(relative || 'index.html')));

  // Never escape the project directory, and never serve dotfiles (.env, .gitignore, .git)
  if (target !== ROOT && !target.startsWith(ROOT + sep)) {
    return sendJson(res, 403, { error: 'Forbidden' });
  }
  if (relative.split('/').some(segment => segment.startsWith('.'))) {
    return sendJson(res, 403, { error: 'Forbidden' });
  }

  let body;
  try {
    body = await readFile(target);
  } catch {
    return sendJson(res, 404, { error: 'Not found' });
  }

  res.writeHead(200, {
    'Content-Type': MIME[extname(target).toLowerCase()] || 'application/octet-stream',
    'Content-Length': body.length,
    'Cache-Control': 'no-cache'
  });
  res.end(body);
}

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  try {
    if (pathname === '/api/config' && req.method === 'GET') {
      return sendJson(res, 200, {
        cartoKey: process.env.CARTO_API_KEY || null,
        gemini: {
          enabled: Boolean(process.env.GEMINI_API_KEY),
          model: modelChain()[0],
          streaming: true
        }
      });
    }

    if (pathname === '/api/chat' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const message = String(body.message || '').trim();
      if (!message) return sendJson(res, 400, { error: 'message is required' });

      const request = { message, history: body.history, context: body.context };

      // Plain JSON reply for scripted checks and non-streaming clients
      if (body.stream === false) {
        const started = Date.now();
        const result = await callGemini(request);
        console.log(`[chat] ${result.model} in ${Date.now() - started}ms${result.attempts.length ? ` (fallbacks: ${result.attempts.join(' | ')})` : ''}`);
        return sendJson(res, 200, { reply: result.reply, model: result.model });
      }

      return streamChat(req, res, request);
    }

    if (pathname === '/api/weather' && req.method === 'GET') {
      return sendJson(res, 200, await getWeather());
    }

    if (pathname.startsWith('/api/')) return sendJson(res, 404, { error: 'Unknown endpoint' });

    return serveStatic(res, pathname === '/' ? '/index.html' : pathname);
  } catch (error) {
    console.error('[error]', error.message);
    return sendJson(res, 502, { error: error.message });
  }
});

await loadDotEnv();

server.listen(PORT, () => {
  console.log(`DhakaPath → http://localhost:${PORT}`);
  console.log(`  AI      : ${process.env.GEMINI_API_KEY ? `Gemini (${modelChain().join(' → ')}) via ${API_BASE()}` : 'DISABLED — no GEMINI_API_KEY in .env'}`);
  console.log(`  Basemap : ${process.env.CARTO_API_KEY ? 'CARTO tiles' : 'OpenStreetMap tiles (no CARTO_API_KEY)'}`);
  console.log('  Chat    : streaming SSE (send {"stream":false} for a JSON reply)');
  console.log('  Keys live in .env and are never sent to the browser.');
});
