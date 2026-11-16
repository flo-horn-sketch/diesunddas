import { summarize, classify, alcoholGrams, isValidProfile } from './bac.js';
import { CATEGORIES, searchDrinks, sizesFor, iconFor, estMinFor } from './drinks.js';
import { icon } from './icons.js';

export const APP_VERSION = 6;

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const KEEP_DRINKS_MS = 36 * HOUR;
const MAX_DURATION_MIN = 6 * 60;

// Standard-Getränke als Kacheln; alles andere über die Suche.
// estMin = typische Trinkdauer für die Standardmenge (wird mit der Menge hochgerechnet)
const BEER_SIZES = [200, 300, 330, 400, 500, 1000];
const PRESETS = [
  { icon: 'bier', name: 'Bier', cat: 'bier', volumeMl: 500, abv: 5, estMin: 30, sizes: BEER_SIZES },
  { icon: 'pils', name: 'Pils', cat: 'bier', volumeMl: 330, abv: 4.8, estMin: 20, sizes: BEER_SIZES },
  { icon: 'weizen', name: 'Weizen', cat: 'bier', volumeMl: 500, abv: 5.4, estMin: 30, sizes: [300, 330, 500] },
  { icon: 'radler', name: 'Radler', cat: 'bier', volumeMl: 500, abv: 2.5, estMin: 30, sizes: [330, 500, 1000] },
  { icon: 'wein', name: 'Wein', cat: 'wein', volumeMl: 200, abv: 12, estMin: 30, sizes: [100, 125, 150, 200, 250] },
  { icon: 'sekt', name: 'Sekt', cat: 'sekt', volumeMl: 100, abv: 11, estMin: 15, sizes: [100, 150, 200] },
  { icon: 'spritz', name: 'Spritz', cat: 'sekt', volumeMl: 200, abv: 8, estMin: 30, sizes: [200, 300, 400] },
  { icon: 'longdrink', name: 'Longdrink', cat: 'longdrink', volumeMl: 40, abv: 40, estMin: 30, sizes: [20, 40, 60, 80] },
  { icon: 'shot', name: 'Shot', cat: 'schnaps', volumeMl: 20, abv: 40, estMin: 0, sizes: [20, 40] },
];

/** Typische Trinkdauer an die Menge anpassen (1 l Bier dauert länger als 0,33 l) */
function scaledEstMin(baseEstMin, refMl, volumeMl) {
  if (!baseEstMin) return 0;
  if (!refMl || !volumeMl) return baseEstMin;
  return Math.round(Math.min(120, Math.max(5, (baseEstMin * volumeMl) / refMl)));
}

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
  presetSizes: store.get('pegel.presetSizes', {}),
  addMode: 'start', // 'start' = Stoppuhr, 'past' = nachtragen
  query: '',
  cat: null,
  dlg: { mode: 'start', editingId: null, base: null },
  undo: null,
};

const saveDrinks = () => store.set('pegel.drinks', state.drinks);
const newId = () => crypto.randomUUID?.() ?? String(Date.now() + Math.random());
const clone = (v) => JSON.parse(JSON.stringify(v));

// ---------- Formatierung ----------
const fmtBac = (v) => v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtTime = (t) => new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const fmtNum = (v, d = 1) => v.toLocaleString('de-DE', { maximumFractionDigits: d });
const fmtVolume = (ml) => {
  if (ml >= 100 && ml % 10 !== 0) return `${fmtNum(ml, 0)} ml`; // z. B. 175 ml statt 0,18 l
  if (ml < 100 && ml % 5 !== 0) return `${fmtNum(ml, 0)} ml`;
  return ml >= 100 ? `${fmtNum(ml / 1000, 2)} l` : `${fmtNum(ml / 10)} cl`;
};
const fmtDrinkMeta = (d) => `${fmtVolume(d.volumeMl)} · ${fmtNum(d.abv)} %`;

function fmtIn(t, now) {
  const mins = Math.max(0, Math.round((t - now) / MIN));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `in ${m} min`;
  return `in ${h} h ${String(m).padStart(2, '0')}`;
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
const iconOf = (d) => d.icon ?? iconFor(d.cat);

// ---------- Getränke & Modell ----------
const finishedEnd = (d) => d.time + (d.durationMin ?? 0) * MIN;
const runningDrink = () => state.drinks.find((d) => d.running);

/** Laufendes Getränk: fürs Modell mindestens die typische Dauer annehmen, sonst bis jetzt */
function modelDrinks(now) {
  return state.drinks.map((d) => (d.running
    ? { ...d, durationMin: Math.max((now - d.time) / MIN, d.estMin ?? 20) }
    : d));
}

function stopNow(d, now) {
  d.running = false;
  d.durationMin = Math.min(MAX_DURATION_MIN, Math.max(0, Math.round((now - d.time) / MIN)));
}

/** Es läuft höchstens ein Getränk. Ältere Stände (mehrere laufend) werden bereinigt. */
function normalizeRunning() {
  const running = state.drinks.filter((d) => d.running).sort((a, b) => a.time - b.time);
  for (const d of running.slice(0, -1)) {
    d.running = false;
    d.durationMin = Math.max(1, d.estMin ?? 20);
  }
  if (running.length > 1) saveDrinks();
}

/** Änderung an den Getränken mit „Rückgängig“ */
function commit(message, mutate) {
  const snapshot = clone(state.drinks);
  mutate();
  saveDrinks();
  render();
  showToast(message, () => {
    state.drinks = snapshot;
    saveDrinks();
    render();
  });
}

function rememberPresetSize(presetKey, ml) {
  if (!presetKey) return;
  state.presetSizes = { ...state.presetSizes, [presetKey]: ml };
  store.set('pegel.presetSizes', state.presetSizes);
  renderPresets();
}

/** Getränk angetippt: Stoppuhr starten oder (Modus „Nachtragen“) den Zeitraum abfragen */
function choose(base) {
  if (!ensureProfile()) return;
  if (state.addMode === 'past') openDrinkDialog({ base });
  else startDrink(base);
}

/**
 * Startet ein Getränk ab jetzt. Ein laufendes Getränk wird dabei automatisch gestoppt.
 * Shots (ohne Trinkdauer) werden direkt eingetragen und stoppen nichts.
 */
function startDrink(base) {
  const now = Date.now();
  const cat = base.cat ?? 'custom';
  const baseEstMin = base.baseEstMin ?? base.estMin ?? estMinFor(cat);
  const refMl = base.defaultMl ?? base.volumeMl;
  const d = {
    id: newId(), name: base.name, cat, icon: base.icon ?? iconFor(cat),
    volumeMl: base.volumeMl, abv: base.abv, fullStomach: base.fullStomach ?? state.fullStomach,
    time: now, baseEstMin, refMl, estMin: scaledEstMin(baseEstMin, refMl, base.volumeMl),
    sizes: base.sizes ?? [], presetKey: base.presetKey ?? null,
  };
  const prev = d.estMin > 0 ? runningDrink() : null;
  let message;
  if (d.estMin > 0) {
    d.running = true;
    d.durationMin = null;
    message = prev ? `${d.name} gestartet · ${prev.name} gestoppt` : `${d.name} gestartet`;
  } else {
    d.durationMin = 0;
    message = `${d.name} eingetragen`;
  }
  commit(message, () => {
    if (prev) stopNow(state.drinks.find((x) => x.id === prev.id), now);
    state.drinks.push(d);
  });
}

function finishDrink(id) {
  const d = state.drinks.find((x) => x.id === id);
  if (!d?.running) return;
  const now = Date.now();
  const mins = Math.round((now - d.time) / MIN);
  commit(`${d.name} gestoppt · ${fmtDuration(mins)}`, () => stopNow(state.drinks.find((x) => x.id === id), now));
}

function setRunningSize(ml) {
  const d = runningDrink();
  if (!d) return;
  d.volumeMl = ml;
  d.estMin = scaledEstMin(d.baseEstMin ?? d.estMin, d.refMl, ml) || d.estMin;
  saveDrinks();
  rememberPresetSize(d.presetKey, ml);
  render();
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
  $('status-note').textContent = hasDrinks ? cls.note : '';
  $('status-note').hidden = !hasDrinks;
  $('gauge-fill').style.width = `${Math.max(2, Math.min(100, (s.current / 1.6) * 100)).toFixed(1)}%`;

  const below05 = !hasDrinks ? '–' : s.below05 ? fmtTime(s.below05) : 'jetzt';
  const sober = !hasDrinks ? '–' : s.soberAt ? `${fmtDayPrefix(s.soberAt, now)}${fmtTime(s.soberAt)}` : 'jetzt';
  $('hero-05').textContent = below05;
  $('hero-sober').textContent = sober;

  if (hasDrinks) {
    $('fact-peak').innerHTML = s.peak
      ? `${fmtBac(s.peak.bac)} ‰ <small>${s.peak.t > now ? 'um' : 'war'} ${fmtTime(s.peak.t)}</small>`
      : '–';
    $('fact-05').innerHTML = s.below05 ? `${below05} <small>${fmtIn(s.below05, now)}</small>` : 'jetzt schon';
    $('fact-sober').innerHTML = s.soberAt
      ? `${sober} <small>bis ca. ${fmtTime(s.soberLatest ?? s.soberAt)}</small>`
      : 'jetzt';
  }
  $('fact-grams').textContent = `${fmtNum(s.totalGrams, 0)} g`;

  renderChart(s, drinks, now);
  renderRunning(now);
  renderDrinks(now);
  renderPresets();
}

function sizeChips(container, sizes, current, onPick) {
  container.replaceChildren(...sizes.map((ml) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'size-chip';
    b.textContent = fmtVolume(ml);
    b.dataset.ml = ml;
    b.setAttribute('aria-pressed', String(Number(current) === ml));
    b.addEventListener('click', () => onPick(ml));
    return b;
  }));
}

function renderRunning(now) {
  const d = runningDrink();
  $('run-active').hidden = !d;
  $('run-idle').hidden = !!d;
  if (!d) return;
  $('run-icon').replaceChildren(icon(iconOf(d), 26));
  $('run-name').textContent = d.name;
  const long = now - d.time > 2 * HOUR;
  $('run-meta').textContent = `seit ${fmtTime(d.time)} · ${fmtNum(d.abv)} %${long ? ' · noch dran?' : ''}`;
  $('run-timer').dataset.start = d.time;
  $('run-timer').textContent = fmtStopwatch(now - d.time);
  const sizes = [...new Set([...(d.sizes ?? []), d.volumeMl])].sort((a, b) => a - b);
  sizeChips($('run-sizes'), sizes, d.volumeMl, setRunningSize);
}

function tickTimers() {
  const el = $('run-timer');
  if (el.dataset.start && !$('run-active').hidden) el.textContent = fmtStopwatch(Date.now() - Number(el.dataset.start));
}

function renderDrinks(now) {
  const drinks = state.drinks.filter((d) => !d.running).sort((a, b) => b.time - a.time);
  $('drink-list').replaceChildren(...drinks.map((d) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerHTML = '<span class="txt"><span class="n"></span><span class="meta"></span></span><span class="grams"></span>';
    btn.prepend(icon(iconOf(d), 24));
    const chev = icon('chevron', 16);
    chev.classList.add('chev');
    btn.append(chev);
    btn.querySelector('.n').textContent = d.name;
    const span = d.durationMin ? `${fmtTime(d.time)} bis ${fmtTime(finishedEnd(d))}` : fmtTime(d.time);
    btn.querySelector('.meta').textContent =
      `${fmtDayPrefix(d.time, now)}${span} · ${fmtDrinkMeta(d)}${d.fullStomach ? ' · gegessen' : ''}`;
    btn.querySelector('.grams').textContent = `${fmtNum(alcoholGrams(d.volumeMl, d.abv), 0)} g`;
    btn.addEventListener('click', () => openDrinkDialog({ drink: d }));
    li.append(btn);
    return li;
  }));
  $('drink-empty').hidden = drinks.length > 0;
  $('drink-empty').textContent = state.drinks.length ? 'Noch kein Getränk fertig.' : 'Noch nichts eingetragen.';
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

  for (const d of state.drinks) {
    const end = d.running ? now : finishedEnd(d);
    if (end > d.time) nodes.push(el('line', { class: d.running ? 'drink-span live' : 'drink-span', x1: x(d.time), x2: x(end), y1: y(0), y2: y(0) }));
    else nodes.push(el('circle', { class: 'drink-tick', cx: x(d.time), cy: y(0), r: 3 }));
  }

  if (now >= t0 && now <= t1) {
    nodes.push(el('line', { class: 'now', x1: x(now), x2: x(now), y1: T, y2: y(0) }));
    nodes.push(el('circle', { class: 'now-dot', cx: x(now), cy: y(s.current), r: 5 }));
  }
  svg.replaceChildren(...nodes);
}

// ---------- Getränk starten: Kacheln, Suche ----------
function presetBase(preset) {
  return {
    ...preset,
    defaultMl: preset.volumeMl,
    volumeMl: state.presetSizes[preset.name] ?? preset.volumeMl,
    presetKey: preset.name,
  };
}

function renderPresets() {
  const run = runningDrink();
  $('presets').replaceChildren(...PRESETS.map((preset) => {
    const p = presetBase(preset);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = run?.presetKey === p.name ? 'preset active' : 'preset';
    b.innerHTML = '<span class="name"></span><span class="meta"></span>';
    b.prepend(icon(p.icon, 26));
    b.querySelector('.name').textContent = p.name;
    b.querySelector('.meta').textContent = fmtDrinkMeta(p);
    b.addEventListener('click', () => choose(p));
    return b;
  }));
}

function renderAddMode() {
  document.querySelectorAll('[data-addmode]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.addmode === state.addMode)));
  $('add-hint').textContent = state.addMode === 'start'
    ? 'Antippen startet die Stoppuhr. Ein neues Getränk stoppt das laufende, Shots werden direkt eingetragen.'
    : 'Antippen und eintragen, von wann bis wann du es getrunken hast.';
}
document.querySelectorAll('[data-addmode]').forEach((b) => b.addEventListener('click', () => {
  state.addMode = b.dataset.addmode;
  renderAddMode();
}));

function renderCats() {
  const btns = Object.entries(CATEGORIES).map(([key, c]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cat';
    b.textContent = c.label;
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
    li.innerHTML = '<button type="button"><span><span class="n"></span><span class="c"></span></span><span class="meta"></span></button>';
    const btn = li.querySelector('button');
    btn.prepend(icon(iconFor(d.cat), 24));
    li.querySelector('.n').textContent = d.name;
    li.querySelector('.c').textContent = CATEGORIES[d.cat].label;
    li.querySelector('.meta').textContent = fmtDrinkMeta(d);
    btn.addEventListener('click', () => {
      choose({ ...d, id: undefined, defaultMl: d.volumeMl, sizes: sizesFor(d) });
      if (state.addMode === 'start') resetSearch();
    });
    return li;
  });
  if (q && !hits.some((d) => d.name.toLowerCase() === q.toLowerCase())) {
    const li = document.createElement('li');
    li.innerHTML = '<button type="button"><span class="n new"></span><span class="meta">eigenes Getränk</span></button>';
    const btn = li.querySelector('button');
    const plus = icon('plus', 24);
    plus.classList.add('new-ico');
    btn.prepend(plus);
    li.querySelector('.n').textContent = `„${q}“ selbst anlegen`;
    btn.addEventListener('click', () => ensureProfile() && openDrinkDialog({
      base: { name: q, cat: state.cat ?? 'custom', volumeMl: '', abv: '' },
    }));
    items.push(li);
  }
  if (!items.length) {
    const li = document.createElement('li');
    li.className = 'none';
    li.textContent = 'Keine Treffer.';
    items.push(li);
  }
  $('results').replaceChildren(...items);
}

function resetSearch() {
  state.query = '';
  state.cat = null;
  $('search').value = '';
  renderCats();
  renderAdd();
}

$('search').addEventListener('input', (e) => { state.query = e.target.value; renderAdd(); });
$('search-clear').addEventListener('click', () => {
  state.query = '';
  $('search').value = '';
  renderAdd();
  $('search').focus();
});

$('run-stop').addEventListener('click', () => { const d = runningDrink(); if (d) finishDrink(d.id); });
$('run-info').addEventListener('click', () => { const d = runningDrink(); if (d) openDrinkDialog({ drink: d }); });

// ---------- Getränke-Dialog (nachtragen, ändern, eigenes Getränk) ----------
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

function updateSummary() {
  const f = $('form-drink');
  const { mode } = state.dlg;
  const ml = Number(f.elements.volumeMl.value), abv = Number(f.elements.abv.value);
  $('drink-grams').innerHTML = ml > 0 && f.elements.abv.value !== '' && abv >= 0
    ? `Reiner Alkohol <b>${fmtNum(alcoholGrams(ml, abv), 1)} g</b>`
    : '';

  f.elements.end.setCustomValidity('');
  const dur = $('drink-duration');
  if (mode === 'past' && f.elements.start.value && f.elements.end.value) {
    const { durationMin } = readSpan();
    if (durationMin > MAX_DURATION_MIN) {
      f.elements.end.setCustomValidity('Höchstens 6 Stunden pro Getränk');
      dur.innerHTML = '<span class="warn">Höchstens 6 Stunden pro Getränk</span>';
    } else {
      dur.innerHTML = `Trinkdauer <b>${fmtDuration(durationMin)}</b>`;
    }
  } else if (mode === 'start') {
    dur.textContent = state.dlg.instant ? 'Wird sofort eingetragen' : 'Stoppuhr startet jetzt';
  } else if (mode === 'running') {
    dur.textContent = 'Stoppuhr läuft';
  } else {
    dur.textContent = '';
  }
}

/** Modi: 'start' (Stoppuhr ab jetzt), 'past' (von–bis), 'running' (läuft, nur Startzeit änderbar) */
function setMode(mode) {
  state.dlg.mode = mode;
  const f = $('form-drink');
  const isNew = !state.dlg.editingId;
  document.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === mode)));
  $('time-fields').hidden = mode === 'start';
  $('end-label').hidden = mode === 'running';
  $('start-label').firstChild.textContent = mode === 'running' ? 'Gestartet um' : 'Getrunken von';
  f.elements.start.required = mode !== 'start';
  f.elements.end.required = mode === 'past';
  $('drink-submit').textContent = !isNew ? 'Speichern' : mode === 'start' && !state.dlg.instant ? 'Starten' : 'Eintragen';
  updateSummary();
}

function dialogSizeChips(sizes, current) {
  sizeChips($('size-chips'), sizes, current, (ml) => {
    $('form-drink').elements.volumeMl.value = ml;
    dialogSizeChips(sizes, ml);
    updateSummary();
  });
}

function openDrinkDialog({ base = null, drink = null }) {
  const now = Date.now();
  const src = drink ?? base;
  const cat = src.cat ?? 'custom';
  const baseEstMin = src.baseEstMin ?? src.estMin ?? estMinFor(cat);
  state.dlg = { mode: 'start', editingId: drink?.id ?? null, base: src, instant: baseEstMin === 0 };
  const f = $('form-drink');
  f.elements.name.value = src.name ?? '';
  f.elements.volumeMl.value = src.volumeMl ?? '';
  f.elements.abv.value = src.abv ?? '';
  f.elements.fullStomach.checked = drink?.fullStomach ?? state.fullStomach;

  const sizes = src.sizes?.length ? src.sizes : (CATEGORIES[cat] && src.volumeMl ? sizesFor({ cat, volumeMl: src.volumeMl }) : []);
  dialogSizeChips(sizes, src.volumeMl);
  const note = CATEGORIES[cat]?.note;
  $('drink-note').hidden = !note;
  $('drink-note').textContent = note ?? '';

  const est = scaledEstMin(baseEstMin, src.refMl ?? src.defaultMl ?? src.volumeMl, src.volumeMl);
  if (drink) {
    f.elements.start.value = toTimeInput(drink.time);
    f.elements.end.value = toTimeInput(drink.running ? now : finishedEnd(drink));
  } else {
    f.elements.start.value = toTimeInput(now - Math.max(est, 10) * MIN);
    f.elements.end.value = toTimeInput(now);
  }

  $('drink-icon').replaceChildren(icon(iconOf(src), 26));
  $('drink-title').textContent = drink ? 'Getränk ändern' : state.addMode === 'past' ? 'Getränk nachtragen' : 'Getränk hinzufügen';
  $('mode-switch').hidden = !!drink;
  $('drink-delete').hidden = !drink;
  setMode(drink ? (drink.running ? 'running' : 'past') : state.addMode);
  $('dlg-drink').showModal();
}

document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
for (const name of ['start', 'end', 'abv']) $('form-drink').elements[name].addEventListener('input', updateSummary);
$('form-drink').elements.volumeMl.addEventListener('input', (e) => {
  const ml = String(Number(e.target.value));
  document.querySelectorAll('#size-chips .size-chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.ml === ml)));
  updateSummary();
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
    const patch = mode === 'running' ? { time: fromTimeInput(f.elements.start.value) } : readSpan();
    commit(`${data.name} geändert`, () => {
      state.drinks = state.drinks.map((d) => {
        if (d.id !== editingId) return d;
        const next = { ...d, ...data, ...patch };
        next.estMin = scaledEstMin(d.baseEstMin ?? d.estMin, d.refMl, data.volumeMl) || d.estMin;
        return next;
      });
    });
    return;
  }

  const cat = base?.cat ?? 'custom';
  const common = {
    ...data, cat, icon: base?.icon, sizes: base?.sizes, presetKey: base?.presetKey,
    baseEstMin: base?.baseEstMin ?? base?.estMin ?? estMinFor(cat),
    defaultMl: base?.defaultMl ?? (base?.volumeMl || data.volumeMl),
  };
  rememberPresetSize(base?.presetKey, data.volumeMl);
  if (mode === 'start') {
    startDrink(common);
  } else {
    const d = {
      id: newId(), ...data, cat, icon: common.icon ?? iconFor(cat), ...readSpan(),
      baseEstMin: common.baseEstMin, refMl: common.defaultMl,
      estMin: scaledEstMin(common.baseEstMin, common.defaultMl, data.volumeMl),
      sizes: common.sizes ?? [], presetKey: common.presetKey ?? null,
    };
    commit(`${d.name} eingetragen`, () => state.drinks.push(d));
  }
  resetSearch();
});

$('drink-cancel').addEventListener('click', () => $('dlg-drink').close());
$('drink-delete').addEventListener('click', () => {
  const id = state.dlg.editingId;
  const removed = state.drinks.find((d) => d.id === id);
  $('dlg-drink').close();
  if (removed) commit(`${removed.name} gelöscht`, () => { state.drinks = state.drinks.filter((d) => d.id !== id); });
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
  toastTimer = setTimeout(() => { $('toast').hidden = true; state.undo = null; }, 6000);
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
  commit('Alle Getränke gelöscht', () => { state.drinks = []; });
});

document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
setInterval(tickTimers, SEC);
setInterval(render, 30 * SEC);

normalizeRunning();
$('version').textContent = `Version ${APP_VERSION}`;
renderAddMode();
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
