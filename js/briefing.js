import { state } from './state.js';
import { currentLang } from './i18n.js';
import { ALERT_TYPES } from './core/alerts.js';
import { HUB_BY_ID } from './core/network.js';

/* ===============================
   Bonus B2 — audio briefing + offline card
   ===============================
   Two answers to the same real problem: a commuter on 8% battery or no data
   still needs the plan. Both are built from the *selected* route card, so they
   include exactly what the screen shows: legs with boarding notes, the fare,
   the on-time probability, the leave-by time and the live disruptions.

   The spoken briefing uses the browser's own speechSynthesis (free, offline,
   no key) and prefers a Bangla voice when the UI is in Bangla. The card is
   drawn on a canvas and downloaded as a PNG, high contrast, no network. */

function selectedCard() {
  const card = state.routes.find(entry => entry.id === state.selectedRouteId) || state.routes[0] || null;
  return card;
}

/* state.plan.alerts holds raw ledger entries, not display cards, so the label and
   place have to be resolved here rather than assumed. */
function alertLabel(alert) {
  const type = ALERT_TYPES[alert.type] || ALERT_TYPES.incident;
  const hub = alert.hubId ? HUB_BY_ID.get(alert.hubId) : null;
  return { title: type.label, place: hub ? hub.name : alert.linkId || 'unlocated', description: alert.description };
}

export function briefingLines(card = selectedCard()) {
  if (!card) return [];

  const lines = [];
  const arrival = card.arrival;
  const disruptions = (state.plan?.alerts || [])
    .filter(alert => card.legs.some(leg => leg.fromId === alert.hubId || leg.toId === alert.hubId))
    .map(alertLabel);

  lines.push(`${card.title}. ${card.timeMinutes} minutes, ${card.transfers} transfer${card.transfers === 1 ? '' : 's'}.`);
  lines.push(arrival
    ? `Fare ${card.baseFare} taka${state.studentPass ? `, student ${card.studentFare} taka` : ''}. Typical arrival ${arrival.stats.p50} minutes, worst case ${arrival.stats.p90}.`
    : `Fare ${card.baseFare} taka.`);

  if (arrival?.onTime !== null && arrival?.onTime !== undefined) {
    lines.push(`${Math.round(arrival.onTime * 100)} percent on-time chance${arrival.leaveBy ? `, so leave by ${arrival.leaveBy}` : ''}.`);
  }

  card.legs.forEach((leg, index) => {
    lines.push(`Leg ${index + 1}. ${leg.mode}, ${leg.from} to ${leg.to}, ${leg.time} minutes, ${leg.fareValue} taka.`);
    lines.push(`${leg.board}. ${leg.alight}.`);
    if (leg.isTransfer) lines.push('Change here — this is a transfer.');
  });

  if (disruptions.length) {
    lines.push(`Heads up: ${disruptions.length} active report${disruptions.length === 1 ? '' : 's'} on this route — ${disruptions.map(alert => `${alert.title.toLowerCase()} at ${alert.place}`).join(', ')}.`);
  }
  if (card.deltas) {
    lines.push(`Disruption delta: ${card.deltas.timeMin >= 0 ? 'plus' : 'minus'} ${Math.abs(card.deltas.timeMin)} minutes and ${card.deltas.fareDelta >= 0 ? 'plus' : 'minus'} ${Math.abs(card.deltas.fareDelta)} taka against the clear-weather plan.`);
  }

  lines.push('Estimates from demo data, not official fares.');
  return lines;
}

export function playBriefing() {
  const card = selectedCard();
  const status = document.getElementById('briefingStatus');
  if (!card) {
    if (status) status.textContent = 'Plan a trip first — the briefing reads the selected route.';
    return null;
  }

  const text = briefingLines(card).join(' ');
  if (!('speechSynthesis' in window)) {
    if (status) status.textContent = 'This browser has no speech synthesis. The offline card has the same content.';
    return text;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  const bangla = currentLang() === 'bn';
  utterance.lang = bangla ? 'bn-BD' : 'en-US';
  utterance.rate = 0.98;

  const voice = window.speechSynthesis.getVoices().find(entry => entry.lang?.toLowerCase().startsWith(bangla ? 'bn' : 'en'));
  if (voice) utterance.voice = voice;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);

  if (status) {
    status.textContent = `Playing the ${bangla ? 'Bangla' : 'English'} briefing — ${card.timeMinutes} min, ${card.baseFare}৳.`;
  }
  return text;
}

/* High-contrast, low-battery-friendly summary card. 900×1200 PNG. */
export function downloadSummaryCard() {
  const card = selectedCard();
  const status = document.getElementById('briefingStatus');
  if (!card) {
    if (status) status.textContent = 'Plan a trip first — the card renders the selected route.';
    return null;
  }

  const width = 900;
  const height = 1200;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#FBF9F4';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#C8401A';
  ctx.fillRect(0, 0, width, 14);

  const mono = 'ui-monospace, "Cascadia Mono", Consolas, monospace';
  const sans = '"Hanken Grotesk", system-ui, sans-serif';

  ctx.fillStyle = '#15191C';
  ctx.font = `700 46px ${sans}`;
  ctx.fillText('DhakaPath', 56, 96);
  ctx.fillStyle = '#4A5157';
  ctx.font = `400 22px ${sans}`;
  ctx.fillText('Offline route card — demo data, not official fares', 56, 132);

  ctx.fillStyle = '#15191C';
  ctx.font = `700 40px ${sans}`;
  ctx.fillText(card.title, 56, 208);

  const arrival = card.arrival;
  ctx.font = `700 64px ${mono}`;
  ctx.fillText(`${card.baseFare}৳`, 56, 296);
  ctx.font = `400 24px ${sans}`;
  ctx.fillStyle = '#4A5157';
  ctx.fillText(state.studentPass ? `student ৳${card.studentFare}` : 'regular fare', 56, 330);

  const facts = [
    `${card.timeMinutes} min`,
    `${card.transfers} transfer${card.transfers === 1 ? '' : 's'}`,
    arrival ? `${Math.round((arrival.onTime ?? 0) * 100)}% on time` : 'no deadline set',
    arrival?.leaveBy ? `leave by ${arrival.leaveBy}` : 'leave when ready'
  ];
  ctx.fillStyle = '#15191C';
  ctx.font = `400 26px ${mono}`;
  ctx.fillText(facts.join('   ·   '), 56, 382);

  ctx.strokeStyle = '#DDD7C8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(56, 412);
  ctx.lineTo(width - 56, 412);
  ctx.stroke();

  let y = 470;
  card.legs.forEach((leg, index) => {
    ctx.fillStyle = '#15191C';
    ctx.font = `700 26px ${sans}`;
    ctx.fillText(`${index + 1}. ${leg.mode}`, 56, y);

    ctx.fillStyle = '#4A5157';
    ctx.font = `400 22px ${sans}`;
    ctx.fillText(`${leg.from} → ${leg.to}`, 220, y);

    ctx.fillStyle = '#15191C';
    ctx.font = `500 22px ${mono}`;
    const money = `${leg.fareValue}৳`;
    ctx.fillText(money, width - 56 - ctx.measureText(money).width, y);

    y += 30;
    ctx.fillStyle = '#7A8087';
    ctx.font = `400 19px ${sans}`;
    wrap(ctx, leg.board, 72, y, width - 160, 24);
    y += 24;
    wrap(ctx, leg.alight, 72, y, width - 160, 24);
    y += 42;
  });

  const disruptions = (state.plan?.alerts || []).slice(0, 3).map(alertLabel);
  if (disruptions.length) {
    ctx.fillStyle = '#2F6DA3';
    ctx.font = `700 22px ${sans}`;
    ctx.fillText('Live disruptions on this plan', 56, y);
    y += 32;
    ctx.font = `400 20px ${sans}`;
    disruptions.forEach(alert => {
      wrap(ctx, `• ${alert.title} at ${alert.place}`, 72, y, width - 160, 26);
      y += 26;
    });
    y += 18;
  }

  ctx.strokeStyle = '#DDD7C8';
  ctx.beginPath();
  ctx.moveTo(56, 1090);
  ctx.lineTo(width - 56, 1090);
  ctx.stroke();

  ctx.fillStyle = '#7A8087';
  ctx.font = `400 19px ${mono}`;
  ctx.fillText(`rendered ${new Date().toLocaleString()}`, 56, 1128);
  ctx.fillText('100% free stack · Leaflet + OSM · Gemini free tier', 56, 1158);

  canvas.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `dhakapath-card-${card.id.replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}.png`;
    anchor.click();
    // Revoke on a timer: revoking synchronously can cancel the download in
    // browsers that start it asynchronously (Firefox, Safari).
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    if (status) status.textContent = 'Offline card downloaded — it works with no signal and no battery-hungry app.';
  }, 'image/png');

  return card;
}

function wrap(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(' ');
  let line = '';
  words.forEach(word => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      line = word;
    } else {
      line = test;
    }
  });
  if (line) ctx.fillText(line, x, y);
  return y;
}
