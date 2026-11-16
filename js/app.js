import { summarize, classify, alcoholGrams, isValidProfile } from './bac.js';
import { CATEGORIES, searchDrinks, sizesFor, emojiFor, estMinFor } from './drinks.js';

export const APP_VERSION = 4;

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const KEEP_DRINKS_MS = 36 * HOUR;
const MAX_DURATION_MIN = 6 * 60;

// Standard-Getränke als Kacheln; alles andere über die Suche
const PRESETS = [
  { emoji: '🍺', name: 'Bier', cat: 'bier', volumeMl: 500, abv: 5 },
  { emoji: '🍺', name: 'Pils', cat: 'bier', volumeMl: 330, abv: 4.8, estMin: 20 },
  { emoji: '🍻', name: 'Weizen', cat: 'bier', volumeMl: 500, abv: 5.4 },
  { emoji: '🍋', name: 'Radler', cat: 'bier', volumeMl: 500, abv: 2.5 },
  { emoji: '🍷', name: 'Wein', cat: 'wein', volumeMl: 200, abv: 12 },
  { emoji: '🥂', name: 'Sekt', cat: 'sekt', volumeMl: 100, abv: 11, estMin: 15 },
  { emoji: '🍹', name: 'Spritz', cat: 'sekt', volumeMl: 200, abv: 8, estMin: 30 },
  { emoji: '🍸', name: 'Longdrink', cat: 'longdrink', volumeMl: 40, abv: 40 },
  { emoji: '🥃', name: 'Shot', cat: 'schnaps', volumeMl: 20, abv: 40 },
];

// ---------- Speicher (nur lokal auf dem Gerät) ----------
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* z. B. privater Modus */ }
  },
};

const state = {
  profile: store.get('pegel.profile', null),
  drinks: store.get('pegel.drinks', []).filter((d) => d.time > Date.now() - KEEP_DRINKS_MS),
  fullStomach: store.get('pegel.fullStomach', false),
  query: '',
  cat: null,
  dlg: { mode: 'start', editingId: null, base: null },
  undo: null,
};

const saveDrinks = () => store.set('pegel.drinks', state.drinks);
const newId = () => crypto.randomUUID?.() ?? String(Date.now() + Math.random());

// ---------- Formatierung ----------
const fmtBac = (v) => v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtTime = (t) => new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const fmtNum = (v, d = 1) => v.toLocaleString('de-DE', { maximumFractionDigits: d });
const fmtVolume = (ml) => (ml >= 100 ? `${fmtNum(ml / 1000, 2)} l` : `${fmtNum(ml / 10)} cl`);
const fmtDrinkMeta = (d) => `${fmtVolume(d.volumeMl)} · ${fmtNum(d.abv)} %`;

function fmtIn(t, now) {
  const mins = Math.max(0, Math.round((t - now) / MIN));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `in ${m} min`;
  return `in ${h} h ${String(m).padStart(2, '0')} min`;
}

function fmtDuration(min) {
  if (min <= 0) return 'auf einmal';
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
}

function fmtStopwatch(ms) {
  const s = Math.max(0, Math.floor(ms / SEC));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const mm = String(m).padStart(2, '0'), ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function fmtDayPrefix(t, now) {
  const d = new Date(t);
  if (d.toDateString() === new Date(now).toDateString()) return '';
  if (d.toDateString() === new Date(now - 24 * HOUR).toDateString()) return 'gestern ';
  if (d.toDateString() === new Date(now + 24 * HOUR).toDateString()) return 'morgen ';
  return d.toLocaleDateString('de-DE', { weekday: 'short' }) + ' ';
}

const $ = (id) => document.getElementById(id);
const emojiOf = (d) => d.emoji ?? emojiFor(d.cat);

// ---------- Getränke & Modell ----------
const finishedEnd = (d) => d.time + (d.durationMin ?? 0) * MIN;

/** Laufende Getränke: Annahme fürs Modell – mindestens typische Dauer, sonst bis jetzt */
function modelDrinks(now) {
  return state.drinks.map((d) => (d.running
    ? { ...d, durationMin: Math.max((now - d.time) / MIN, d.estMin ?? 20) }
    : d));
}

/** Neues Getränk ab jetzt: mit Stoppuhr, Shots direkt als getrunken */
function startDrink(base) {
  const now = Date.now();
  const estMin = base.estMin ?? estMinFor(base.cat);
  const d = {
    id: newId(), name: base.name, cat: base.cat ?? 'custom', ...(base.emoji ? { emoji: base.emoji } : {}), volumeMl: base.volumeMl, abv: base.abv,
    fullStomach: base.fullStomach ?? state.fullStomach, time: now, estMin,
    ...(estMin > 0 ? { running: true, durationMin: null } : { durationMin: 0 }),
  };
  addDrink(d, estMin > 0 ? `${d.name} gestartet ⏱` : `${d.name} eingetragen`);
}

function addDrink(d, message) {
  state.drinks.push(d);
  saveDrinks();
  render();
  showToast(message, () => {
    state.drinks = state.drinks.filter((x) => x.id !== d.id);
    saveDrinks();
    render();
  });
}

function finishDrink(id) {
  const d = state.drinks.find((x) => x.id === id);
  if (!d?.running) return;
  const before = { ...d };
  d.running = false;
  d.durationMin = Math.min(MAX_DURATION_MIN, Math.max(0, Math.round((Date.now() - d.time) / MIN)));
  saveDrinks();
  render();
  showToast(`${d.name} fertig · ${fmtDuration(d.durationMin)}`, () => {
    Object.assign(d, before);
    saveDrinks();
    render();
  });
}

// ---------- Rendering ----------
function render() {
  const now = Date.now();
  const drinks = state.profile ? modelDrinks(now) : [];
  const s = summarize(drinks, state.profile, now);
  const cls = classify(s.current);
  const hasDrinks = state.drinks.length > 0;

  $('hero').dataset.level = cls.level;
  $('bac-value').textContent = fmtBac(s.current);
  $('status-label').textContent = cls.label;
  $('status-note').textContent = hasDrinks ? cls.note : 'Such dein Getränk und starte die Stoppuhr. Der Wert wird laufend neu berechnet.';

  if (!hasDrinks) {
    $('fact-05').textContent = '–';
    $('fact-sober').textContent = '–';
    $('fact-peak').textContent = '–';
  } else {
    $('fact-05').innerHTML = s.below05
      ? `${fmtTime(s.below05)} <small>${fmtIn(s.below05, now)}</small>`
      : 'jetzt schon';
    $('fact-sober').innerHTML = s.soberAt
      ? `${fmtDayPrefix(s.soberAt, now)}${fmtTime(s.soberAt)} <small>bis ca. ${fmtTime(s.soberLatest ?? s.soberAt)}</small>`
      : 'jetzt';
    $('fact-peak').innerHTML = s.peak
      ? `${fmtBac(s.peak.bac)} ‰ <small>${s.peak.t > now ? 'um' : 'war'} ${fmtTime(s.peak.t)}</small>`
      : '–';
  }
  $('fact-grams').textContent = `${fmtNum(s.totalGrams, 0)} g`;

  renderChart(s, drinks, now);
  renderRunning(now);
  renderDrinks(now);
}

function renderRunning(now) {
  const running = state.drinks.filter((d) => d.running).sort((a, b) => a.time - b.time);
  $('running-card').hidden = running.length === 0;
  $('running-list').replaceChildren(...running.map((d) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <button type="button" class="info"><span class="n"></span><span class="meta"></span></button>
      <span class="timer"></span>
      <button type="button" class="primary">Fertig</button>`;
    li.querySelector('.n').textContent = `${emojiOf(d)} ${d.name}`;
    const long = now - d.time > 2 * HOUR;
    li.querySelector('.meta').textContent =
      `seit ${fmtTime(d.time)} · ${fmtDrinkMeta(d)}${long ? ' · noch dran?' : ''}`;
    const timer = li.querySelector('.timer');
    timer.dataset.start = d.time;
    timer.textContent = fmtStopwatch(now - d.time);
    li.querySelector('.info').addEventListener('click', () => openDrinkDialog({ drink: d }));
    li.querySelector('.primary').addEventListener('click', () => finishDrink(d.id));
    return li;
  }));
}

function tickTimers() {
  const now = Date.now();
  document.querySelectorAll('.timer[data-start]').forEach((el) => {
    el.textContent = fmtStopwatch(now - Number(el.dataset.start));
  });
}

function renderDrinks(now) {
  const drinks = state.drinks.filter((d) => !d.running).sort((a, b) => b.time - a.time);
  $('drink-list').replaceChildren(...drinks.map((d) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerHTML = `
      <span class="time"></span>
      <span><span class="n"></span><br><span class="meta"></span></span>
      <span class="grams"></span>
      <span class="chev" aria-hidden="true">›</span>`;
    btn.querySelector('.time').textContent = fmtTime(d.time);
    btn.querySelector('.n').textContent = `${emojiOf(d)} ${d.name}`;
    btn.querySelector('.meta').textContent =
      `${fmtDayPrefix(d.time, now)}${d.durationMin ? `bis ${fmtTime(finishedEnd(d))} · ` : ''}${fmtDrinkMeta(d)}${d.fullStomach ? ' · gegessen' : ''}`;
    btn.querySelector('.grams').textContent = `${fmtNum(alcoholGrams(d.volumeMl, d.abv), 0)} g`;
    btn.addEventListener('click', () => openDrinkDialog({ drink: d }));
    li.append(btn);
    return li;
  }));
  $('drink-empty').hidden = state.drinks.length > 0;
  $('drink-empty').textContent = state.drinks.length ? '' : 'Noch nichts eingetragen.';
  $('drink-edit-hint').hidden = drinks.length === 0;
  $('btn-clear').hidden = state.drinks.length === 0;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
function el(name, attrs, text) {
  const n = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  return n;
}

function renderChart(s, drinks, now) {
  const card = $('chart-card');
  const svg = $('chart');
  if (!s.points.length || !s.peak) { card.hidden = true; return; }
  card.hidden = false;

  const W = 340, H = 170, L = 26, R = 8, T = 10, B = 20;
  const t0 = s.points[0].t - 10 * MIN;
  const t1 = Math.max(s.points[s.points.length - 1].t, now, ...drinks.map(finishedEnd)) + 10 * MIN;
  const yMax = Math.max(0.7, s.peak.bac * 1.2);
  const x = (t) => L + ((t - t0) / (t1 - t0)) * (W - L - R);
  const y = (v) => T + (1 - v / yMax) * (H - T - B);

  const nodes = [];
  const yStep = yMax > 2.5 ? 1 : 0.5;
  for (let v = 0; v <= yMax; v += yStep) {
    nodes.push(el('line', { class: 'grid', x1: L, x2: W - R, y1: y(v), y2: y(v) }));
    nodes.push(el('text', { x: L - 4, y: y(v) + 3, 'text-anchor': 'end' }, fmtNum(v)));
  }
  nodes.push(el('line', { class: 'limit', x1: L, x2: W - R, y1: y(0.5), y2: y(0.5) }));
  const spanH = (t1 - t0) / HOUR;
  const hStep = spanH > 16 ? 4 : spanH > 8 ? 2 : 1;
  const first = new Date(t0); first.setMinutes(0, 0, 0);
  for (let t = first.getTime() + HOUR; t < t1; t += HOUR) {
    if (new Date(t).getHours() % hStep) continue;
    nodes.push(el('text', { x: x(t), y: H - 4, 'text-anchor': 'middle' }, `${new Date(t).getHours()} h`));
  }

  const sample = s.points.filter((_, i) => i % 3 === 0 || i === s.points.length - 1);
  const past = sample.filter((p) => p.t <= now);
  const future = sample.filter((p) => p.t >= now);
  const nowPt = { t: now, bac: s.current };
  if (past.length) past.push(nowPt);
  if (future.length) future.unshift(nowPt);
  const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.bac).toFixed(1)}`).join('');

  if (past.length > 1) {
    nodes.push(el('path', { class: 'area', d: `${path(past)}L${x(now)},${y(0)}L${x(past[0].t)},${y(0)}Z` }));
    nodes.push(el('path', { class: 'line-past', d: path(past) }));
  }
  if (future.length > 1) nodes.push(el('path', { class: 'line-future', d: path(future) }));

  for (const d of drinks) {
    if (d.durationMin) nodes.push(el('line', { class: 'drink-span', x1: x(d.time), x2: x(finishedEnd(d)), y1: y(0), y2: y(0) }));
    else nodes.push(el('circle', { class: 'drink-tick', cx: x(d.time), cy: y(0), r: 2.5 }));
  }

  if (now >= t0 && now <= t1) {
    nodes.push(el('line', { class: 'now', x1: x(now), x2: x(now), y1: T, y2: y(0) }));
    nodes.push(el('circle', { class: 'now-dot', cx: x(now), cy: y(s.current), r: 4 }));
  }
  svg.replaceChildren(...nodes);
}

// ---------- Suche & Schnellstart ----------
function renderCats() {
  const btns = Object.entries(CATEGORIES).map(([key, c]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cat';
    b.textContent = `${c.emoji} ${c.label}`;
    b.setAttribute('aria-pressed', String(state.cat === key));
    b.addEventListener('click', () => {
      state.cat = state.cat === key ? null : key;
      renderCats();
      renderAdd();
    });
    return b;
  });
  $('cats').replaceChildren(...btns);
}

function renderAdd() {
  const searching = !!state.query.trim() || !!state.cat;
  $('results').hidden = !searching;
  $('search-clear').hidden = !state.query;
  if (!searching) return;

  const q = state.query.trim();
  const hits = searchDrinks(q, { cat: state.cat, limit: q ? 40 : 200 });
  const items = hits.map((d) => {
    const li = document.createElement('li');
    li.innerHTML = '<button type="button"><span class="e"></span><span class="n"></span><span class="meta"></span></button>';
    li.querySelector('.e').textContent = emojiFor(d.cat);
    li.querySelector('.n').textContent = d.name;
    li.querySelector('.meta').textContent = fmtDrinkMeta(d);
    li.querySelector('button').addEventListener('click', () => ensureProfile() && openDrinkDialog({ base: d }));
    return li;
  });
  if (q && !hits.some((d) => d.name.toLowerCase() === q.toLowerCase())) {
    const li = document.createElement('li');
    li.innerHTML = '<button type="button"><span class="e">＋</span><span class="n new"></span><span class="meta">eigenes</span></button>';
    li.querySelector('.n').textContent = `„${q}“ selbst anlegen`;
    li.querySelector('button').addEventListener('click', () => ensureProfile() && openDrinkDialog({
      base: { name: q, cat: state.cat ?? 'custom', volumeMl: '', abv: '' },
    }));
    items.push(li);
  }
  if (!hits.length && !q) {
    const li = document.createElement('li');
    li.className = 'none';
    li.textContent = 'Keine Treffer.';
    items.push(li);
  }
  $('results').replaceChildren(...items);
}

$('search').addEventListener('input', (e) => { state.query = e.target.value; renderAdd(); });
$('search-clear').addEventListener('click', () => {
  state.query = '';
  $('search').value = '';
  renderAdd();
  $('search').focus();
});

function renderPresets() {
  $('presets').replaceChildren(...PRESETS.map((p) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'preset';
    b.innerHTML = '<span class="emoji"></span><span class="name"></span><span class="meta"></span>';
    b.querySelector('.emoji').textContent = p.emoji;
    b.querySelector('.name').textContent = p.name;
    b.querySelector('.meta').textContent = fmtDrinkMeta(p);
    b.addEventListener('click', () => ensureProfile() && startDrink(p));
    return b;
  }));
}

// ---------- Getränke-Dialog ----------
const toTimeInput = (t) => {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** "HH:MM" → Zeitstempel; liegt die Uhrzeit in der Zukunft, ist gestern gemeint */
function fromTimeInput(value, now = Date.now()) {
  const [h, m] = value.split(':').map(Number);
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  if (d.getTime() > now + 5 * MIN) d.setDate(d.getDate() - 1);
  return d.getTime();
}

/** Von/Bis aus dem Dialog → { time, durationMin }; „bis“ vor „von“ heißt: über Mitternacht */
function readSpan() {
  const f = $('form-drink');
  const time = fromTimeInput(f.elements.start.value);
  const [h, m] = f.elements.end.value.split(':').map(Number);
  const end = new Date(time);
  end.setHours(h, m, 0, 0);
  if (end.getTime() < time) end.setDate(end.getDate() + 1);
  return { time, durationMin: Math.round((end.getTime() - time) / MIN) };
}

function updateDurationHint() {
  const f = $('form-drink');
  const usesEnd = state.dlg.mode === 'past';
  f.elements.end.setCustomValidity('');
  if (!usesEnd || !f.elements.start.value || !f.elements.end.value) { $('drink-duration').textContent = ''; return; }
  const { durationMin } = readSpan();
  const tooLong = durationMin > MAX_DURATION_MIN;
  f.elements.end.setCustomValidity(tooLong ? 'Höchstens 6 Stunden pro Getränk' : '');
  $('drink-duration').textContent = tooLong
    ? 'Höchstens 6 Stunden pro Getränk. Trag lieber mehrere Getränke ein.'
    : `Trinkdauer: ${fmtDuration(durationMin)}`;
}

/**
 * Modi: 'start' (neu, Stoppuhr ab jetzt), 'past' (von–bis), 'running' (läuft, nur Startzeit änderbar)
 */
function setMode(mode) {
  state.dlg.mode = mode;
  const f = $('form-drink');
  const isNew = !state.dlg.editingId;
  const instant = (state.dlg.base?.estMin ?? estMinFor(state.dlg.base?.cat)) === 0;
  document.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === mode)));
  $('time-fields').hidden = mode === 'start';
  $('end-label').hidden = mode === 'running';
  $('start-label').firstChild.textContent = mode === 'running' ? 'Gestartet um' : 'Getrunken von';
  $('start-hint').hidden = mode !== 'start';
  $('start-hint').textContent = instant
    ? 'Wird als gerade eben getrunken eingetragen.'
    : 'Die Stoppuhr läuft, bis du auf „Fertig“ tippst.';
  f.elements.start.required = mode !== 'start';
  f.elements.end.required = mode === 'past';
  $('drink-submit').textContent = !isNew ? 'Speichern' : mode === 'start' ? (instant ? 'Eintragen' : '▶ Starten') : 'Eintragen';
  updateDurationHint();
}

function renderSizeChips(sizes, current) {
  $('size-chips').replaceChildren(...sizes.map((ml) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = fmtVolume(ml);
    b.dataset.ml = ml;
    b.setAttribute('aria-pressed', String(Number(current) === ml));
    b.addEventListener('click', () => {
      $('form-drink').elements.volumeMl.value = ml;
      renderSizeChips(sizes, ml);
    });
    return b;
  }));
}

function openDrinkDialog({ base = null, drink = null }) {
  const now = Date.now();
  const src = drink ?? base;
  state.dlg = { mode: 'start', editingId: drink?.id ?? null, base: src };
  const f = $('form-drink');
  f.elements.name.value = src.name ?? '';
  f.elements.volumeMl.value = src.volumeMl ?? '';
  f.elements.abv.value = src.abv ?? '';
  f.elements.fullStomach.checked = drink?.fullStomach ?? state.fullStomach;

  const sizes = src.cat && CATEGORIES[src.cat] ? sizesFor(src) : [];
  renderSizeChips(sizes, src.volumeMl);
  const note = CATEGORIES[src.cat]?.note;
  $('drink-note').hidden = !note;
  $('drink-note').textContent = note ?? '';

  const est = src.estMin ?? estMinFor(src.cat);
  if (drink) {
    f.elements.start.value = toTimeInput(drink.time);
    f.elements.end.value = toTimeInput(drink.running ? now : finishedEnd(drink));
  } else {
    f.elements.start.value = toTimeInput(now - Math.max(est, 10) * MIN);
    f.elements.end.value = toTimeInput(now);
  }

  $('drink-title').textContent = drink ? 'Getränk bearbeiten' : `${emojiFor(src.cat)} Getränk hinzufügen`;
  $('mode-switch').hidden = !!drink;
  $('drink-delete').hidden = !drink;
  $('drink-finish').hidden = !drink?.running;
  setMode(drink ? (drink.running ? 'running' : 'past') : 'start');
  $('dlg-drink').showModal();
}

document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
$('form-drink').elements.start.addEventListener('input', updateDurationHint);
$('form-drink').elements.end.addEventListener('input', updateDurationHint);
$('form-drink').elements.volumeMl.addEventListener('input', (e) => {
  const ml = Number(e.target.value);
  document.querySelectorAll('#size-chips .chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.ml === String(ml))));
});

$('form-drink').addEventListener('submit', () => {
  const f = $('form-drink');
  const { mode, editingId, base } = state.dlg;
  const data = {
    name: f.elements.name.value.trim() || 'Getränk',
    volumeMl: Number(f.elements.volumeMl.value),
    abv: Number(f.elements.abv.value),
    fullStomach: f.elements.fullStomach.checked,
  };

  if (editingId) {
    const patch = mode === 'running'
      ? { time: fromTimeInput(f.elements.start.value) }
      : readSpan();
    state.drinks = state.drinks.map((d) => (d.id === editingId ? { ...d, ...data, ...patch } : d));
    saveDrinks();
    render();
    return;
  }

  const cat = base?.cat ?? 'custom';
  if (mode === 'start') {
    startDrink({ ...data, cat, estMin: base?.estMin });
  } else {
    addDrink({ id: newId(), cat, ...data, ...readSpan(), estMin: estMinFor(cat) }, `${data.name} eingetragen`);
  }
  state.query = '';
  $('search').value = '';
  renderAdd();
});

$('drink-cancel').addEventListener('click', () => $('dlg-drink').close());
$('drink-finish').addEventListener('click', () => {
  const id = state.dlg.editingId;
  $('dlg-drink').close();
  finishDrink(id);
});
$('drink-delete').addEventListener('click', () => {
  const removed = state.drinks.find((d) => d.id === state.dlg.editingId);
  state.drinks = state.drinks.filter((d) => d.id !== state.dlg.editingId);
  saveDrinks();
  $('dlg-drink').close();
  render();
  if (removed) {
    showToast(`${removed.name} gelöscht`, () => { state.drinks.push(removed); saveDrinks(); render(); });
  }
});

// ---------- Profil-Dialog ----------
function ensureProfile() {
  if (isValidProfile(state.profile)) return true;
  openProfileDialog();
  return false;
}

function openProfileDialog() {
  const f = $('form-profile');
  const p = state.profile ?? {};
  if (p.sex) f.elements.sex.value = p.sex;
  f.elements.age.value = p.age ?? '';
  f.elements.heightCm.value = p.heightCm ?? '';
  f.elements.weightKg.value = p.weightKg ?? '';
  $('profile-cancel').hidden = !isValidProfile(state.profile);
  $('dlg-profile').showModal();
}

$('form-profile').addEventListener('submit', (e) => {
  const f = e.target;
  const profile = {
    sex: f.elements.sex.value,
    age: Number(f.elements.age.value),
    heightCm: Number(f.elements.heightCm.value),
    weightKg: Number(f.elements.weightKg.value),
  };
  if (!isValidProfile(profile)) { e.preventDefault(); return; }
  state.profile = profile;
  store.set('pegel.profile', profile);
  render();
});
$('dlg-profile').addEventListener('cancel', (e) => { if (!isValidProfile(state.profile)) e.preventDefault(); });
$('profile-cancel').addEventListener('click', () => $('dlg-profile').close());
$('btn-profile').addEventListener('click', openProfileDialog);

// ---------- Sonstiges ----------
let toastTimer;
function showToast(text, onUndo) {
  $('toast-text').textContent = text;
  state.undo = onUndo;
  $('toast-undo').hidden = !onUndo;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; state.undo = null; }, 5000);
}

$('toast-undo').addEventListener('click', () => {
  state.undo?.();
  state.undo = null;
  $('toast').hidden = true;
});

function renderStomach() {
  document.querySelectorAll('[data-stomach]').forEach((b) => {
    b.setAttribute('aria-checked', String((b.dataset.stomach === 'full') === state.fullStomach));
  });
}
document.querySelectorAll('[data-stomach]').forEach((b) => b.addEventListener('click', () => {
  state.fullStomach = b.dataset.stomach === 'full';
  store.set('pegel.fullStomach', state.fullStomach);
  renderStomach();
}));

$('btn-clear').addEventListener('click', () => {
  if (!confirm('Alle eingetragenen Getränke löschen?')) return;
  const backup = state.drinks;
  state.drinks = [];
  saveDrinks();
  render();
  showToast('Alle Getränke gelöscht', () => { state.drinks = backup; saveDrinks(); render(); });
});

document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
setInterval(tickTimers, SEC);
setInterval(render, 30 * SEC);

$('version').textContent = `Version ${APP_VERSION}`;
renderPresets();
renderCats();
renderAdd();
renderStomach();
render();
if (!isValidProfile(state.profile)) openProfileDialog();

// Updates: beim Zurückkehren in die App nach neuer Version schauen und dann einmal neu laden
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });
  navigator.serviceWorker.register('sw.js').then((reg) => {
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch(() => {});
}
