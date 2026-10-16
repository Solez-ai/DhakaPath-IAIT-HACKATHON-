import { state, activeAlerts } from './state.js';
import { getEnv } from './env.js';
import { validateLegs, validateProse, groundingBadge } from './core/ground.js';
import { describeScenario, scenarioActive } from './core/scenario.js';
import { HUB_BY_ID, FARE_RULES } from './core/network.js';

/* ===============================
   Transit AI Dispatch Desk
   ===============================
   The dev server proxies Gemini and relays it as SSE. Replies are rendered as
   they arrive: the bubble grows token-by-token, then markdown is applied once
   at the end so a half-finished **bold** marker never looks broken. */

const MAX_HISTORY_TURNS = 6;
const STREAM_TIMEOUT_MS = 90_000;
const conversation = [];

const STATUS_CLASSES = {
  online: 'text-[10px] bg-ok/10 text-ok border border-ok/30 px-1.5 py-0.5 rounded font-mono',
  offline: 'text-[10px] bg-warn/10 text-warn border border-warn/30 px-1.5 py-0.5 rounded font-mono'
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

/* Model output is escaped first, so the few tags added here stay safe. */
function formatReply(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^\s*[-*]\s+/gm, '• ');
}

function prettyModel(model) {
  return String(model || 'transit model')
    .replace(/-/g, ' ')
    .replace(/\b([a-z])/g, (_, char) => char.toUpperCase());
}

function applyStatus(online, model) {
  const chip = document.getElementById('aiStatus');
  const label = document.getElementById('aiModelLabel');

  if (label) {
    label.textContent = online ? `${prettyModel(model)} Transit Desk` : 'Transit Desk (offline)';
  }

  if (chip) {
    chip.textContent = online ? 'ONLINE' : 'OFFLINE';
    chip.className = STATUS_CLASSES[online ? 'online' : 'offline'];
    chip.title = online
      ? `Answers streamed from ${model} through the local proxy — your API key stays on the server.`
      : 'Start the dev server (node server.mjs) to enable live Gemini answers.';
  }
}

export function initAiStatus() {
  const env = getEnv();
  applyStatus(env.gemini.enabled, env.gemini.model);
}

/* Compact snapshot of the live network so answers are grounded in real data. */
function buildContext() {
  const routes = state.routes.map(card => {
    const legs = card.legs
      .map(leg => `${leg.mode} ${leg.from}→${leg.to} (${leg.time}, ${leg.km} km, ৳${leg.fareValue}${leg.includedIn ? ', already covered by the ride you are on' : ''})`)
      .join('; ');
    const arrival = card.arrival
      ? `P50 ${card.arrival.stats.p50} min, P90 ${card.arrival.stats.p90} min, ${Math.round((card.arrival.onTime ?? 0) * 100)}% on time${card.arrival.leaveBy ? `, leave by ${card.arrival.leaveBy}` : ''}`
      : 'no simulation';
    return `- ${card.title} [${card.tag}] ${card.timeMinutes} min, ৳${state.studentPass ? card.studentFare : card.baseFare}${state.studentPass ? ' student' : ''}, ${card.transfers} transfer(s), heuristic reliability ${card.reliability}/100, ${arrival} | ${legs}`;
  }).join('\n');

  const alerts = activeAlerts()
    .slice(0, 8)
    .map(alert => `- ${alert.type} @ ${HUB_BY_ID.get(alert.hubId)?.name || alert.hubId} (severity ${alert.severity}, ${alert.source}): ${alert.description}`)
    .join('\n');

  const weather = state.weather
    ? `Forecast: ${state.weather.label}, rain load ${state.weather.hourly.rain[state.weatherHour]} mm/h at ${String(state.weatherHour).padStart(2, '0')}:00, Dhaka Pulse ${state.pulse.score}/100 (${state.pulse.band}).`
    : 'Forecast: unavailable.';

  return [
    `Fare mode: ${state.studentPass ? 'student half pass (50% off bus legs with a ৳10 floor; MRT-6 has no student rate)' : 'regular'}`,
    `Scenario: ${describeScenario(state.scenario)}`,
    weather,
    'Routes currently planned (these are the only routes that exist — do not invent others):',
    routes || '- none (no origin/destination resolved)',
    'Live reports feeding routing:',
    alerts || '- none',
    `Network: ${state.summary.hubs} dataset stops, ${state.summary.links} directed links, services ${state.summary.lines.map(line => line.name).join(', ')}.`,
    'Fare rules (official published rates):',
    Object.entries(FARE_RULES).map(([mode, rules]) => `- ${rules.label}: ৳${rules.perKm}/km, ৳${rules.minFare} minimum${rules.maxFare ? `, ৳${rules.maxFare} maximum` : ''}${rules.band > 1 ? `, tickets sold in ৳${rules.band} bands` : ''}${rules.studentDiscountPct ? `, student ${rules.studentDiscountPct}% off (৳${rules.studentMinFare} floor)` : ', no student rate'} — ${rules.source}`).join('\n'),
    'Rule: never invent a hub, link, fare or time. If the data above does not answer the question, say so.'
  ].join('\n');
}

/* Deterministic answer used when Gemini is unreachable — still fully grounded. */
function localEstimate() {
  const card = state.routes.find(route => route.id === state.selectedRouteId) || state.routes[0];
  const alert = activeAlerts()[0];

  if (!card) return 'No route is currently planned. Name an origin and a destination, for example "Mirpur theke Motijheel".';

  const legs = card.legs
    .filter(leg => !leg.includedIn)
    .map(leg => `${leg.mode} ${leg.from} → ${leg.to}`)
    .join(', then ');
  const fare = state.studentPass ? card.studentFare : card.baseFare;
  const arrival = card.arrival;

  return `Local estimate: ${card.title} takes about ${arrival ? arrival.stats.p50 : card.timeMinutes} min (P90 ${arrival ? arrival.stats.p90 : '—'} min) with ${card.transfers} transfer(s) for ৳${fare}${state.studentPass ? ' with the student half pass' : ''} — ${legs}.`
    + (arrival ? ` ${Math.round((arrival.onTime ?? 0) * 100)}% on time${arrival.leaveBy ? `, leave by ${arrival.leaveBy}` : ''}.` : '')
    + (scenarioActive(state.scenario) ? ` ${describeScenario(state.scenario)}` : '')
    + (alert ? ` Latest live report: ${alert.type} at ${HUB_BY_ID.get(alert.hubId)?.name || alert.hubId}.` : '');
}

/* Grounding badge: proves the answer's route claims exist in the graph. */
function groundingHtml(text) {
  const claims = validateProse(text);
  const badge = claims.checked
    ? groundingBadge(claims)
    : groundingBadge(validateLegs(state.plan?.options?.[0]?.legs || []));

  const tone = {
    ok: 'text-ok border-ok/30 bg-ok/10',
    danger: 'text-danger border-danger/30 bg-danger/10',
    muted: 'text-ink-3 border-line bg-surface-2'
  }[badge.tone] || 'text-ink-3 border-line bg-surface-2';

  const icon = badge.tone === 'ok' ? 'fa-shield-halved' : badge.tone === 'danger' ? 'fa-triangle-exclamation' : 'fa-circle-info';
  return `<span class="inline-flex items-center gap-1 mt-1 text-[10px] px-1.5 py-0.5 rounded border ${tone}" title="${escapeHtml(badge.detail)}">
    <i class="fa-solid ${icon}"></i>${escapeHtml(badge.label)}</span>`;
}

function rawBubble(text) {
  return `<div class="p-2 rounded bg-surface border border-line text-right font-medium text-ink whitespace-pre-line">${formatReply(text)}</div>`;
}

const OFFLINE_NOTICE = `<span class="block mt-1 text-[10px] text-warn">
  <i class="fa-solid fa-plug-circle-xmark me-1"></i>AI offline — start the dev server (<span class="font-mono">node server.mjs</span>) for live Gemini answers.</span>`;

/* Reading SSE frames off the fetch body as they arrive. */
async function* sseFrames(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

    let boundary;
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      const line = frame.split('\n').find(entry => entry.startsWith('data:'));
      if (!line) continue;

      const raw = line.slice(5).trim();
      if (!raw) continue;

      try {
        yield JSON.parse(raw);
      } catch {
        // ignore malformed frames
      }
    }
  }
}

/* Live bubble: a text node that grows per delta, with a blinking caret. */
function createStreamBubble(chatBox) {
  const wrapper = document.createElement('div');
  wrapper.className = 'p-2.5 rounded bg-surface-2 border-l-2 border-signal text-ink space-y-1';
  wrapper.innerHTML = `<p class="font-semibold text-signal">Transit Dispatch AI
    <span class="text-[10px] font-mono text-ink-3" data-role="model"></span></p>`;

  const paragraph = document.createElement('p');
  paragraph.className = 'whitespace-pre-line';
  paragraph.dataset.role = 'stream';

  const caret = document.createElement('span');
  caret.className = 'text-signal animate-pulse';
  caret.textContent = '▍';

  const textNode = document.createTextNode('');
  paragraph.append(textNode, caret);
  wrapper.appendChild(paragraph);
  chatBox.appendChild(wrapper);
  chatBox.scrollTop = chatBox.scrollHeight;

  return {
    wrapper,
    textNode,
    caret,
    setModel(model) {
      const slot = wrapper.querySelector('[data-role="model"]');
      if (slot && model) slot.textContent = prettyModel(model);
    },
    append(delta) {
      textNode.data += delta;
      chatBox.scrollTop = chatBox.scrollHeight;
    },
    finish(html) {
      paragraph.innerHTML = html;
      chatBox.scrollTop = chatBox.scrollHeight;
    }
  };
}

export async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;

  const chatBox = document.getElementById('chatMessages');
  chatBox.insertAdjacentHTML('beforeend', rawBubble(text));
  input.value = '';
  chatBox.scrollTop = chatBox.scrollHeight;

  conversation.push({ role: 'user', text });

  const env = getEnv();
  const thinking = document.createElement('div');
  thinking.className = 'p-2.5 rounded bg-surface-2 border-l-2 border-line text-ink-2 flex items-center gap-2';
  thinking.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-signal"></i>
    <span>${env.gemini.enabled ? `Asking ${escapeHtml(prettyModel(env.gemini.model))}…` : 'Thinking locally…'}</span>`;
  chatBox.appendChild(thinking);
  chatBox.scrollTop = chatBox.scrollHeight;

  let live = null;

  const record = answer => {
    conversation.push({ role: 'model', text: answer });
    if (conversation.length > MAX_HISTORY_TURNS) {
      conversation.splice(0, conversation.length - MAX_HISTORY_TURNS);
    }
  };

  const fallback = (reason, partial) => {
    const estimate = localEstimate();
    const notice = `<span class="block mt-1 text-[10px] text-warn">
      <i class="fa-solid fa-triangle-exclamation me-1"></i>${escapeHtml(reason)} — showing a local estimate.</span>`;
    const html = escapeHtml(partial ? `${partial.trim()}\n\n${estimate}` : estimate) + notice;

    if (live) {
      live.finish(html);
      live.wrapper.insertAdjacentHTML('beforeend', groundingHtml(estimate));
    } else {
      thinking.outerHTML = `<div class="p-2.5 rounded bg-surface-2 border-l-2 border-signal text-ink space-y-1">
        <p class="font-semibold text-signal">Transit Dispatch AI</p>
        <p class="whitespace-pre-line">${html}</p>
        ${groundingHtml(estimate)}
      </div>`;
    }
    record(estimate);
  };

  if (!env.gemini.enabled) {
    const estimate = localEstimate();
    thinking.outerHTML = `<div class="p-2.5 rounded bg-surface-2 border-l-2 border-signal text-ink space-y-1">
      <p class="font-semibold text-signal">Transit Dispatch AI</p>
      <p class="whitespace-pre-line">${escapeHtml(estimate)}${OFFLINE_NOTICE}</p>
      ${groundingHtml(estimate)}
    </div>`;
    record(estimate);
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        context: buildContext(),
        history: conversation.slice(-MAX_HISTORY_TURNS, -1)
      }),
      signal: controller.signal
    });

    if (!response.ok || !response.body) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    live = createStreamBubble(chatBox);
    thinking.remove();

    let answer = '';
    let streamError = null;

    for await (const frame of sseFrames(response.body)) {
      if (frame.type === 'meta') {
        live.setModel(frame.model);
        if (frame.model && frame.model !== env.gemini.model) applyStatus(true, frame.model);
      } else if (frame.type === 'chunk') {
        answer += frame.text;
        live.append(frame.text);
      } else if (frame.type === 'error') {
        streamError = frame.error;
      }
    }

    live.caret.remove();

    if (streamError) {
      fallback(streamError.split('\n')[0], answer);
      return;
    }

    if (!answer.trim()) {
      fallback('The model returned an empty answer', '');
      return;
    }

    live.finish(formatReply(answer));
    live.wrapper.insertAdjacentHTML('beforeend', groundingHtml(answer));
    record(answer);
  } catch (error) {
    const aborted = controller.signal.aborted;
    fallback(aborted ? 'Gemini timed out' : `Gemini unavailable (${error.message})`, live ? live.textNode.data : '');
  } finally {
    clearTimeout(timer);
  }
}
