import { summarize, classify, alcoholGrams, isValidProfile } from './bac.js';

const MIN = 60_000;
const HOUR = 60 * MIN;
const KEEP_DRINKS_MS = 36 * HOUR;

// durationMin: typische Trinkdauer; beim Antippen gilt „ab jetzt“
const PRESETS = [
  { emoji: '🍺', name: 'Bier', volumeMl: 500, abv: 5, durationMin: 30 },
  { emoji: '🍺', name: 'Pils', volumeMl: 330, abv: 4.9, durationMin: 20 },
  { emoji: '🍻', name: 'Weizen', volumeMl: 500, abv: 5.4, durationMin: 30 },
  { emoji: '🍋', name: 'Radler', volumeMl: 500, abv: 2.5, durationMin: 30 },
  { emoji: '🍷', name: 'Wein', volumeMl: 200, abv: 12, durationMin: 30 },
  { emoji: '🥂', name: 'Sekt', volumeMl: 100, abv: 11, durationMin: 15 },
  { emoji: '🍹', name: 'Spritz', volumeMl: 200, abv: 8, durationMin: 30 },
  { emoji: '🍸', name: 'Longdrink', volumeMl: 40, abv: 40, durationMin: 30 },
  { emoji: '🥃', name: 'Shot', volumeMl: 20, abv: 40, durationMin: 0 },
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
  editingId: null,
  undo: null,
};

const saveDrinks = () => store.set('pegel.drinks', state.drinks);

// ---------- Formatierung ----------
const fmtBac = (v) => v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtTime = (t) => new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const fmtNum = (v, d = 1) => v.toLocaleString('de-DE', { maximumFractionDigits: d });
const fmtVolume = (ml) => (ml >= 100 ? `${fmtNum(ml / 1000, 2)} l` : `${fmtNum(ml / 10)} cl`);

function fmtIn(t, now) {
  const mins = Math.max(0, Math.round((t - now) / MIN));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `in ${m} min`;
  return `in ${h} h ${String(m).padStart(2, '0')} min`;
}

function fmtDayPrefix(t, now) {
  const d = new Date(t);
  const today = new Date(now);
  if (d.toDateString() === today.toDateString()) return '';
  const y = new Date(now - 24 * HOUR);
  if (d.toDateString() === y.toDateString()) return 'gestern ';
  const tm = new Date(now + 24 * HOUR);
  if (d.toDateString() === tm.toDateString()) return 'morgen ';
  return d.toLocaleDateString('de-DE', { weekday: 'short' }) + ' ';
}

const endOf = (d) => d.time + (d.durationMin ?? 0) * MIN;
const fmtSpan = (d) => (d.durationMin ? `${fmtTime(d.time)}–${fmtTime(endOf(d))}` : fmtTime(d.time));
function fmtDuration(min) {
  if (min <= 0) return 'auf einmal';
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
}

const $ = (id) => document.getElementById(id);

// ---------- Rendering ----------
function render() {
  const now = Date.now();
  const s = state.profile ? summarize(state.drinks, state.profile, now) : summarize([], null, now);
  const cls = classify(s.current);
  const hasDrinks = state.drinks.length > 0;

  $('hero').dataset.level = cls.level;
  $('bac-value').textContent = fmtBac(s.current);
  $('status-label').textContent = cls.label;
  $('status-note').textContent = hasDrinks ? cls.note : 'Trag ein, was du trinkst. Der Wert wird laufend neu berechnet.';

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

  renderChart(s, now);
  renderDrinks(now);
}

function renderDrinks(now) {
  const list = $('drink-list');
  const drinks = [...state.drinks].sort((a, b) => b.time - a.time);
  list.replaceChildren(...drinks.map((d) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerHTML = `
      <span class="time"></span>
      <span><span class="n"></span><br><span class="meta"></span></span>
      <span class="grams"></span>`;
    btn.querySelector('.time').textContent = fmtTime(d.time);
    btn.querySelector('.n').textContent = `${d.emoji ?? '🥤'} ${d.name}`;
    btn.querySelector('.meta').textContent =
      `${fmtDayPrefix(d.time, now)}${d.durationMin ? `bis ${fmtTime(endOf(d))} · ` : ''}${fmtVolume(d.volumeMl)} · ${fmtNum(d.abv)} %${d.fullStomach ? ' · gegessen' : ''}`;
    btn.querySelector('.grams').textContent = `${fmtNum(alcoholGrams(d.volumeMl, d.abv), 0)} g`;
    btn.addEventListener('click', () => openDrinkDialog(d));
    li.append(btn);
    return li;
  }));
  $('drink-empty').hidden = drinks.length > 0;
  $('btn-clear').hidden = drinks.length === 0;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
function el(name, attrs, text) {
  const n = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  return n;
}

function renderChart(s, now) {
  const card = $('chart-card');
  const svg = $('chart');
  if (!s.points.length || !s.peak) { card.hidden = true; return; }
  card.hidden = false;

  const W = 340, H = 170, L = 26, R = 8, T = 10, B = 20;
  const t0 = s.points[0].t - 10 * MIN;
  const t1 = Math.max(s.points[s.points.length - 1].t, now, ...state.drinks.map(endOf)) + 10 * MIN;
  const yMax = Math.max(0.7, s.peak.bac * 1.2);
  const x = (t) => L + ((t - t0) / (t1 - t0)) * (W - L - R);
  const y = (v) => T + (1 - v / yMax) * (H - T - B);

  const nodes = [];
  // Y-Raster
  const yStep = yMax > 2.5 ? 1 : 0.5;
  for (let v = 0; v <= yMax; v += yStep) {
    nodes.push(el('line', { class: 'grid', x1: L, x2: W - R, y1: y(v), y2: y(v) }));
    nodes.push(el('text', { x: L - 4, y: y(v) + 3, 'text-anchor': 'end' }, fmtNum(v)));
  }
  // 0,5-‰-Grenze
  nodes.push(el('line', { class: 'limit', x1: L, x2: W - R, y1: y(0.5), y2: y(0.5) }));
  // X-Achse: volle Stunden
  const spanH = (t1 - t0) / HOUR;
  const hStep = spanH > 16 ? 4 : spanH > 8 ? 2 : 1;
  const first = new Date(t0); first.setMinutes(0, 0, 0);
  for (let t = first.getTime() + HOUR; t < t1; t += HOUR) {
    if (new Date(t).getHours() % hStep) continue;
    nodes.push(el('text', { x: x(t), y: H - 4, 'text-anchor': 'middle' }, `${new Date(t).getHours()} h`));
  }

  // Kurve (ausgedünnt), getrennt in Vergangenheit und Prognose
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

  // Getränke als kleine Markierungen
  for (const d of state.drinks) {
    if (d.durationMin) nodes.push(el('line', { class: 'drink-span', x1: x(d.time), x2: x(endOf(d)), y1: y(0), y2: y(0) }));
    else nodes.push(el('circle', { class: 'drink-tick', cx: x(d.time), cy: y(0), r: 2.5 }));
  }

  // Jetzt-Linie
  if (now >= t0 && now <= t1) {
    nodes.push(el('line', { class: 'now', x1: x(now), x2: x(now), y1: T, y2: y(0) }));
    nodes.push(el('circle', { class: 'now-dot', cx: x(now), cy: y(s.current), r: 4 }));
  }
  svg.replaceChildren(...nodes);
}

// ---------- Aktionen ----------
function addDrink(drink) {
  const d = { id: crypto.randomUUID?.() ?? String(Date.now() + Math.random()), ...drink };
  state.drinks.push(d);
  saveDrinks();
  render();
  showToast(`${d.name} · ${fmtSpan(d)}`, () => {
    state.drinks = state.drinks.filter((x) => x.id !== d.id);
    saveDrinks();
    render();
  });
}

let toastTimer;
function showToast(text, onUndo) {
  $('toast-text').textContent = text;
  state.undo = onUndo;
  $('toast-undo').hidden = !onUndo;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; state.undo = null; }, 5000);
}

function renderPresets() {
  const buttons = PRESETS.map((p) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'preset';
    b.innerHTML = '<span class="emoji"></span><span class="name"></span><span class="meta"></span>';
    b.querySelector('.emoji').textContent = p.emoji;
    b.querySelector('.name').textContent = p.name;
    b.querySelector('.meta').textContent = `${fmtVolume(p.volumeMl)} · ${fmtNum(p.abv)} %`;
    b.addEventListener('click', () => {
      if (!ensureProfile()) return;
      addDrink({ ...p, time: Date.now(), fullStomach: state.fullStomach });
    });
    return b;
  });
  const custom = document.createElement('button');
  custom.type = 'button';
  custom.className = 'preset custom';
  custom.innerHTML = '<span class="emoji">＋</span><span class="name">Eigenes</span><span class="meta">oder später</span>';
  custom.addEventListener('click', () => ensureProfile() && openDrinkDialog(null));
  $('presets').replaceChildren(...buttons, custom);
}

function renderStomach() {
  document.querySelectorAll('[data-stomach]').forEach((b) => {
    b.setAttribute('aria-checked', String((b.dataset.stomach === 'full') === state.fullStomach));
  });
}

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
  if (!f.elements.start.value || !f.elements.end.value) { $('drink-duration').textContent = ''; return; }
  const { durationMin } = readSpan();
  const tooLong = durationMin > 6 * 60;
  f.elements.end.setCustomValidity(tooLong ? 'Höchstens 6 Stunden pro Getränk' : '');
  $('drink-duration').textContent = tooLong
    ? 'Höchstens 6 Stunden pro Getränk. Trag lieber mehrere Getränke ein.'
    : `Trinkdauer: ${fmtDuration(durationMin)}`;
}
$('form-drink').elements.start.addEventListener('input', updateDurationHint);
$('form-drink').elements.end.addEventListener('input', updateDurationHint);

function openDrinkDialog(drink) {
  state.editingId = drink?.id ?? null;
  const f = $('form-drink');
  $('drink-title').textContent = drink ? 'Getränk bearbeiten' : 'Eigenes Getränk';
  f.elements.name.value = drink?.name ?? '';
  f.elements.volumeMl.value = drink?.volumeMl ?? '';
  f.elements.abv.value = drink?.abv ?? '';
  const start = drink?.time ?? Date.now() - 30 * MIN;
  f.elements.start.value = toTimeInput(start);
  f.elements.end.value = toTimeInput(drink ? endOf(drink) : Date.now());
  updateDurationHint();
  f.elements.fullStomach.checked = drink?.fullStomach ?? state.fullStomach;
  $('drink-delete').hidden = !drink;
  $('dlg-drink').showModal();
}

$('form-drink').addEventListener('submit', () => {
  const f = $('form-drink');
  const data = {
    name: f.elements.name.value.trim() || 'Getränk',
    volumeMl: Number(f.elements.volumeMl.value),
    abv: Number(f.elements.abv.value),
    ...readSpan(),
    fullStomach: f.elements.fullStomach.checked,
  };
  if (state.editingId) {
    state.drinks = state.drinks.map((d) => (d.id === state.editingId ? { ...d, ...data } : d));
    saveDrinks();
    render();
  } else {
    addDrink({ emoji: '🥤', ...data });
  }
});
$('drink-cancel').addEventListener('click', () => $('dlg-drink').close());
$('drink-delete').addEventListener('click', () => {
  const removed = state.drinks.find((d) => d.id === state.editingId);
  state.drinks = state.drinks.filter((d) => d.id !== state.editingId);
  saveDrinks();
  $('dlg-drink').close();
  render();
  if (removed) {
    showToast(`${removed.name} gelöscht`, () => { state.drinks.push(removed); saveDrinks(); render(); });
  }
});

// ---------- Sonstiges ----------
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

$('toast-undo').addEventListener('click', () => {
  state.undo?.();
  state.undo = null;
  $('toast').hidden = true;
});

document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
setInterval(render, 30_000);

renderPresets();
renderStomach();
render();
if (!isValidProfile(state.profile)) openProfileDialog();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
