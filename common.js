// Utilidades compartidas por la pantalla del anfitrión (host.html) y la del jugador (play.html).
'use strict';

const OPTION_STYLES = [
  { shape: '▲', className: 'opt-a' },
  { shape: '◆', className: 'opt-b' },
  { shape: '●', className: 'opt-c' },
  { shape: '■', className: 'opt-d' },
];

const $ = (selector, root = document) => root.querySelector(selector);

// Crea un elemento con clase y texto (textContent evita inyectar HTML de nombres o respuestas).
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

// Conexión en vivo. EventSource reconecta solo si se cae la red.
function connectLive(url, handlers) {
  const source = new EventSource(url);
  for (const [eventName, handler] of Object.entries(handlers)) {
    source.addEventListener(eventName, (event) => handler(JSON.parse(event.data)));
  }
  source.onerror = () => handlers.connection && handlers.connection(false);
  source.onopen = () => handlers.connection && handlers.connection(true);
  return source;
}

// Cuenta regresiva local anclada a lo que dijo el servidor (evita desfases de reloj entre equipos).
const countdown = {
  endsAt: 0,
  sync(remainingMs) { this.endsAt = remainingMs ? Date.now() + remainingMs : 0; },
  secondsLeft() { return this.endsAt ? Math.max(0, Math.ceil((this.endsAt - Date.now()) / 1000)) : 0; },
  fraction(totalSeconds) { return this.endsAt ? Math.max(0, (this.endsAt - Date.now()) / (totalSeconds * 1000)) : 0; },
};

function vibrate(pattern) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch { /* no disponible */ }
}

// ── Confeti ──
function launchConfetti(durationMs = 4000) {
  const canvas = el('canvas', 'confetti');
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const resize = () => { canvas.width = innerWidth; canvas.height = innerHeight; };
  resize();
  addEventListener('resize', resize);
  const colors = ['#CDE877', '#F3BE63', '#F48570', '#ADE0C7', '#F6F3EA'];
  const pieces = Array.from({ length: 180 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * canvas.height,
    size: 6 + Math.random() * 8,
    speed: 2 + Math.random() * 4,
    drift: -1.5 + Math.random() * 3,
    spin: Math.random() * Math.PI,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));
  const stopAt = Date.now() + durationMs;
  (function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of pieces) {
      p.y += p.speed; p.x += p.drift; p.spin += 0.1;
      if (p.y > canvas.height && Date.now() < stopAt) p.y = -20;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.spin);
      ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (Date.now() < stopAt + 3000) requestAnimationFrame(frame);
    else { canvas.remove(); removeEventListener('resize', resize); }
  })();
}
