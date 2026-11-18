'use strict';
// ─────────────────────────────────────────────────────────────
//  MEG Quiz — servidor tipo Kahoot sin dependencias externas.
//  Tiempo real con Server-Sent Events (SSE): el servidor empuja el
//  estado completo a cada pantalla; las respuestas llegan por POST.
// ─────────────────────────────────────────────────────────────
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const QUESTIONS = require('./questions');

const PORT = Number(process.env.PORT) || 3000;
const HOST_PIN = process.env.HOST_PIN || 'meg2026';

const MAX_PLAYERS = 150;
const MAX_NAME_LENGTH = 18;
const MAX_TEXT_ANSWER_LENGTH = 200;
const MAX_BODY_BYTES = 4096;
const INTRO_MS = 4000;              // "¡Prepárate!" antes de mostrar las alternativas
const HEARTBEAT_MS = 15000;         // mantiene viva la conexión SSE en el hosting
const BROADCAST_COALESCE_MS = 120;  // agrupa muchos cambios seguidos en un solo envío
const REACTION_COOLDOWN_MS = 600;

const MAX_POINTS = 1000;
const MIN_POINTS_IF_CORRECT = 500;
const STREAK_BONUS_STEP = 100;
const STREAK_BONUS_CAP = 500;
const PARTICIPATION_POINTS = { poll: 100, text: 200 };

const AVATARS = ['🦁', '🐯', '🐼', '🦊', '🐸', '🐵', '🐧', '🦉', '🐙', '🦄', '🐢', '🐬', '🦖', '🐝', '🐨', '🐻', '🦜', '🐳'];
const REACTIONS = ['🔥', '😂', '🙌', '❤️', '😮', '👏'];

const STATIC_FILES = {
  '/': { file: 'play.html', type: 'text/html; charset=utf-8' },
  '/host': { file: 'host.html', type: 'text/html; charset=utf-8' },
  '/style.css': { file: 'style.css', type: 'text/css; charset=utf-8' },
  '/common.js': { file: 'common.js', type: 'text/javascript; charset=utf-8' },
};

// ── Estado del juego (en memoria: es para una sola sesión) ──
const game = {
  phase: 'lobby', // lobby | intro | question | reveal | ranking | end
  questionIndex: -1,
  phaseEndsAt: 0,
  phaseTimer: null,
  players: new Map(), // id -> player
};
const connections = new Set(); // { res, role, playerId }

function createPlayer(name, avatar) {
  return {
    id: crypto.randomBytes(12).toString('hex'),
    name,
    avatar,
    score: 0,
    streak: 0,
    previousRank: null,
    lastReactionAt: 0,
    answers: {}, // questionIndex -> { choice?, text?, elapsedMs, correct?, points, streakBonus }
  };
}

const currentQuestion = () => QUESTIONS[game.questionIndex];
const isLastQuestion = () => game.questionIndex >= QUESTIONS.length - 1;
const remainingMs = () => Math.max(0, game.phaseEndsAt - Date.now());

function sortedPlayers() {
  return [...game.players.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

function rankOf(playerId) {
  return sortedPlayers().findIndex((p) => p.id === playerId) + 1;
}

// ── Puntaje ──
function pointsForCorrectAnswer(elapsedMs, limitMs) {
  const speedFactor = 1 - 0.5 * Math.min(1, elapsedMs / limitMs);
  return Math.max(MIN_POINTS_IF_CORRECT, Math.round(MAX_POINTS * speedFactor));
}

function streakBonus(streak) {
  return streak >= 2 ? Math.min(STREAK_BONUS_CAP, (streak - 1) * STREAK_BONUS_STEP) : 0;
}

function evaluateAnswer(question, answer, elapsedMs) {
  if (question.type !== 'choice') return { correct: null, points: PARTICIPATION_POINTS[question.type] || 0 };
  const correct = answer.choice === question.correct;
  return { correct, points: correct ? pointsForCorrectAnswer(elapsedMs, question.seconds * 1000) : 0 };
}

// Los puntos se suman al revelar (no al responder) para no adelantar quién acertó.
function applyQuestionResults() {
  const question = currentQuestion();
  const ranksBefore = new Map(sortedPlayers().map((p, i) => [p.id, i + 1]));
  for (const player of game.players.values()) {
    player.previousRank = ranksBefore.get(player.id);
    const answer = player.answers[game.questionIndex];
    if (question.type === 'choice') {
      player.streak = answer && answer.correct ? player.streak + 1 : 0;
      if (answer && answer.correct) answer.streakBonus = streakBonus(player.streak);
    }
    if (answer) player.score += answer.points + (answer.streakBonus || 0);
  }
}

// ── Transiciones de fase ──
function setPhase(phase, durationMs = 0, onTimeout = null) {
  clearTimeout(game.phaseTimer);
  game.phase = phase;
  game.phaseEndsAt = durationMs ? Date.now() + durationMs : 0;
  game.phaseTimer = durationMs && onTimeout ? setTimeout(onTimeout, durationMs) : null;
  broadcastState();
}

function startQuestion(index) {
  game.questionIndex = index;
  setPhase('intro', INTRO_MS, openAnswers);
}

function openAnswers() {
  setPhase('question', currentQuestion().seconds * 1000, revealAnswer);
}

function revealAnswer() {
  if (game.phase !== 'question') return;
  applyQuestionResults();
  setPhase('reveal');
}

function advance() {
  switch (game.phase) {
    case 'lobby': return QUESTIONS.length && startQuestion(0);
    case 'intro': return openAnswers();
    case 'question': return revealAnswer();
    case 'reveal': return setPhase('ranking');
    case 'ranking': return isLastQuestion() ? setPhase('end') : startQuestion(game.questionIndex + 1);
    default: return undefined;
  }
}

function resetGame() {
  for (const player of game.players.values()) {
    Object.assign(player, { score: 0, streak: 0, previousRank: null, answers: {} });
  }
  game.questionIndex = -1;
  setPhase('lobby');
}

function countAnswered() {
  let answered = 0;
  for (const player of game.players.values()) if (player.answers[game.questionIndex]) answered += 1;
  return answered;
}

const everyoneAnswered = () => game.players.size > 0 && countAnswered() === game.players.size;

// ── Lo que ve cada pantalla ──
function questionView(includeAnswer) {
  const question = currentQuestion();
  if (!question) return null;
  const optionsVisible = game.phase !== 'intro';
  return {
    type: question.type,
    category: question.category,
    prompt: question.prompt,
    quote: question.quote || null,
    options: optionsVisible ? question.options || [] : [],
    optionCount: (question.options || []).length,
    seconds: question.seconds,
    correct: includeAnswer ? question.correct ?? null : null,
    note: includeAnswer ? question.note || null : null,
  };
}

function answerTally() {
  const question = currentQuestion();
  const counts = (question.options || []).map(() => 0);
  const texts = [];
  for (const player of game.players.values()) {
    const answer = player.answers[game.questionIndex];
    if (!answer) continue;
    if (question.type === 'text') texts.push({ name: player.name, avatar: player.avatar, text: answer.text });
    else counts[answer.choice] += 1;
  }
  return { counts, texts };
}

function rankingView(limit) {
  return sortedPlayers().slice(0, limit).map((p, i) => ({
    name: p.name,
    avatar: p.avatar,
    score: p.score,
    rank: i + 1,
    previousRank: p.previousRank,
    streak: p.streak,
    gained: lastGain(p),
  }));
}

function lastGain(player) {
  const answer = player.answers[game.questionIndex];
  return answer ? answer.points + (answer.streakBonus || 0) : 0;
}

function baseView() {
  return {
    phase: game.phase,
    questionNumber: game.questionIndex + 1,
    totalQuestions: QUESTIONS.length,
    remainingMs: remainingMs(),
    playerCount: game.players.size,
  };
}

const PHASES_WITH_ANSWER = new Set(['reveal', 'ranking', 'end']);

function hostView() {
  const showAnswer = PHASES_WITH_ANSWER.has(game.phase);
  const view = { ...baseView(), role: 'host', question: questionView(showAnswer), reactions: REACTIONS };
  if (game.phase === 'lobby') view.players = [...game.players.values()].map((p) => ({ id: p.id, name: p.name, avatar: p.avatar }));
  if (game.phase === 'question') view.answeredCount = countAnswered();
  if (game.phase === 'reveal') view.tally = answerTally();
  if (game.phase === 'ranking') view.ranking = rankingView(8);
  if (game.phase === 'end') view.ranking = rankingView(10);
  return view;
}

function playerView(playerId) {
  const player = game.players.get(playerId);
  if (!player) return { ...baseView(), role: 'player', removed: true };
  const showAnswer = PHASES_WITH_ANSWER.has(game.phase);
  const answer = player.answers[game.questionIndex];
  return {
    ...baseView(),
    role: 'player',
    reactions: REACTIONS,
    me: { name: player.name, avatar: player.avatar, score: player.score, streak: player.streak, rank: rankOf(player.id) },
    question: questionView(showAnswer),
    myAnswer: answer
      ? {
          choice: answer.choice ?? null,
          text: answer.text ?? null,
          correct: showAnswer ? answer.correct : null,
          points: showAnswer ? answer.points : null,
          streakBonus: showAnswer ? answer.streakBonus || 0 : null,
        }
      : null,
  };
}

// ── Envío en vivo (SSE) ──
function sendEvent(res, eventName, data) {
  res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
}

function sendStateTo(connection) {
  sendEvent(connection.res, 'state', connection.role === 'host' ? hostView() : playerView(connection.playerId));
}

let broadcastScheduled = null;
function broadcastState() {
  if (broadcastScheduled) return;
  broadcastScheduled = setTimeout(() => {
    broadcastScheduled = null;
    for (const connection of connections) sendStateTo(connection);
  }, BROADCAST_COALESCE_MS);
}

function sendToHosts(eventName, data) {
  for (const connection of connections) if (connection.role === 'host') sendEvent(connection.res, eventName, data);
}

setInterval(() => {
  for (const connection of connections) connection.res.write(': ping\n\n');
}, HEARTBEAT_MS);

function openEventStream(req, res, url) {
  const role = url.searchParams.get('role');
  const isHost = role === 'host' && url.searchParams.get('pin') === HOST_PIN;
  const playerId = url.searchParams.get('id');
  if (role === 'host' && !isHost) return sendJson(res, 403, { error: 'PIN incorrecto' });
  if (!isHost && !playerId) return sendJson(res, 400, { error: 'Falta el jugador' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 2000\n\n');
  const connection = { res, role: isHost ? 'host' : 'player', playerId };
  connections.add(connection);
  sendStateTo(connection);
  req.on('close', () => connections.delete(connection));
  return undefined;
}

// ── Utilidades HTTP ──
function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > MAX_BODY_BYTES) {
        reject(new Error('too_large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('bad_json'));
      }
    });
    req.on('error', reject);
  });
}

function cleanText(value, maxLength) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function uniqueName(baseName) {
  const taken = new Set([...game.players.values()].map((p) => p.name.toLowerCase()));
  if (!taken.has(baseName.toLowerCase())) return baseName;
  for (let n = 2; ; n += 1) {
    const candidate = `${baseName.slice(0, MAX_NAME_LENGTH - 3)} ${n}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

// ── Acciones ──
function handleJoin(body) {
  const existing = game.players.get(body.id);
  if (existing) return [200, { id: existing.id, name: existing.name, avatar: existing.avatar }];
  const name = cleanText(body.name, MAX_NAME_LENGTH);
  if (!name) return [400, { error: 'Escribe tu nombre' }];
  if (game.players.size >= MAX_PLAYERS) return [409, { error: 'La sala está llena' }];
  const avatar = AVATARS.includes(body.avatar) ? body.avatar : AVATARS[Math.floor(Math.random() * AVATARS.length)];
  const player = createPlayer(uniqueName(name), avatar);
  game.players.set(player.id, player);
  broadcastState();
  return [200, { id: player.id, name: player.name, avatar: player.avatar }];
}

function handleAnswer(body) {
  const player = game.players.get(body.id);
  if (!player) return [404, { error: 'Jugador no encontrado' }];
  if (game.phase !== 'question') return [409, { error: 'Ahora no se puede responder' }];
  if (player.answers[game.questionIndex]) return [409, { error: 'Ya respondiste' }];

  const question = currentQuestion();
  const answer = {};
  if (question.type === 'text') {
    answer.text = cleanText(body.text, MAX_TEXT_ANSWER_LENGTH);
    if (!answer.text) return [400, { error: 'Escribe algo' }];
  } else {
    const choice = Number(body.choice);
    if (!Number.isInteger(choice) || choice < 0 || choice >= question.options.length) return [400, { error: 'Alternativa inválida' }];
    answer.choice = choice;
  }
  const elapsedMs = question.seconds * 1000 - remainingMs();
  Object.assign(answer, { elapsedMs }, evaluateAnswer(question, answer, elapsedMs));
  player.answers[game.questionIndex] = answer;

  if (everyoneAnswered()) revealAnswer();
  else broadcastState();
  return [200, { ok: true }];
}

function handleReaction(body) {
  const player = game.players.get(body.id);
  if (!player || !REACTIONS.includes(body.emoji)) return [400, { error: 'Reacción inválida' }];
  const now = Date.now();
  if (now - player.lastReactionAt < REACTION_COOLDOWN_MS) return [429, { error: 'Más despacio 😄' }];
  player.lastReactionAt = now;
  sendToHosts('reaction', { emoji: body.emoji, name: player.name });
  return [200, { ok: true }];
}

function handleHostAction(body) {
  if (body.pin !== HOST_PIN) return [403, { error: 'PIN incorrecto' }];
  switch (body.action) {
    case 'next': advance(); break;
    case 'reset': resetGame(); break;
    case 'kick':
      game.players.delete(body.playerId);
      broadcastState();
      break;
    case 'check': break;
    default: return [400, { error: 'Acción desconocida' }];
  }
  return [200, { ok: true }];
}

const POST_ROUTES = {
  '/api/join': handleJoin,
  '/api/answer': handleAnswer,
  '/api/react': handleReaction,
  '/api/host': handleHostAction,
};

function serveStatic(res, route) {
  fs.readFile(path.join(__dirname, route.file), (error, content) => {
    if (error) return sendJson(res, 500, { error: 'No se pudo leer el archivo' });
    res.writeHead(200, { 'Content-Type': route.type, 'Cache-Control': 'no-cache' });
    return res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'GET' && url.pathname === '/events') return openEventStream(req, res, url);
    if (req.method === 'GET' && STATIC_FILES[url.pathname]) return serveStatic(res, STATIC_FILES[url.pathname]);
    if (req.method === 'POST' && POST_ROUTES[url.pathname]) {
      const [status, body] = POST_ROUTES[url.pathname](await readJsonBody(req));
      return sendJson(res, status, body);
    }
    return sendJson(res, 404, { error: 'No encontrado' });
  } catch (error) {
    return sendJson(res, 400, { error: 'Petición inválida' });
  }
});

server.listen(PORT, () => {
  console.log(`MEG Quiz listo en http://localhost:${PORT}  (anfitrión: /host)`);
  if (!process.env.HOST_PIN) console.log('Aviso: usando el PIN por defecto. Define HOST_PIN para cambiarlo.');
});
