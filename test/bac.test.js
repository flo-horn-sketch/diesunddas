import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  alcoholGrams, totalBodyWater, permillePerGram, simulate, summarize,
  bacAt, classify, isValidProfile,
} from '../js/bac.js';

const H = 3600_000;
const male = { sex: 'male', age: 30, heightCm: 180, weightKg: 80 };
const female = { sex: 'female', age: 30, heightCm: 165, weightKg: 60 };
const beer = (time, extra = {}) => ({ id: String(time), name: 'Bier', volumeMl: 500, abv: 5, time, fullStomach: false, ...extra });

test('Alkoholmenge: 0,5 l Bier mit 5 % ≈ 19,7 g', () => {
  assert.ok(Math.abs(alcoholGrams(500, 5) - 19.725) < 0.01);
});

test('Watson-Körperwasser liegt im plausiblen Bereich', () => {
  const m = totalBodyWater(male);
  const f = totalBodyWater(female);
  assert.ok(m > 40 && m < 50, `Mann: ${m}`);
  assert.ok(f > 25 && f < 35, `Frau: ${f}`);
});

test('Ein Bier ergibt bei 80-kg-Mann ohne Abbau ca. 0,3 ‰', () => {
  const bac = alcoholGrams(500, 5) * permillePerGram(male);
  assert.ok(bac > 0.28 && bac < 0.38, `BAK ${bac}`);
});

test('Gleiche Menge wirkt bei leichterer Frau stärker', () => {
  assert.ok(permillePerGram(female) > permillePerGram(male));
});

test('Ohne Getränke gibt es keinen Verlauf', () => {
  assert.deepEqual(simulate([], male), []);
  assert.equal(summarize([], male, Date.now()).current, 0);
});

test('Verlauf steigt an, erreicht ein Maximum und fällt auf 0', () => {
  const t0 = Date.UTC(2026, 0, 1, 20);
  const pts = simulate([beer(t0), beer(t0 + 0.5 * H), beer(t0 + H)], male);
  const peak = Math.max(...pts.map((p) => p.bac));
  assert.ok(peak > 0.6 && peak < 1.0, `Peak ${peak}`);
  assert.equal(pts.at(-1).bac, 0);
  assert.equal(bacAt(pts, t0 - H), 0);
});

test('Abbau etwa 0,15 ‰ pro Stunde nach vollständiger Resorption', () => {
  const t0 = Date.UTC(2026, 0, 1, 20);
  const pts = simulate([beer(t0), beer(t0), beer(t0)], male);
  const a = bacAt(pts, t0 + 2 * H);
  const b = bacAt(pts, t0 + 3 * H);
  assert.ok(Math.abs(a - b - 0.15) < 0.005, `Abbau ${a - b}`);
});

test('Voller Magen senkt den Spitzenwert', () => {
  const t0 = Date.UTC(2026, 0, 1, 20);
  const peakOf = (pts) => Math.max(...pts.map((p) => p.bac));
  const empty = peakOf(simulate([beer(t0), beer(t0)], male));
  const full = peakOf(simulate([beer(t0, { fullStomach: true }), beer(t0, { fullStomach: true })], male));
  assert.ok(full < empty);
});

test('Zusammenfassung liefert Zeiten in sinnvoller Reihenfolge', () => {
  const t0 = Date.UTC(2026, 0, 1, 20);
  const drinks = [beer(t0), beer(t0 + 0.5 * H), beer(t0 + H), beer(t0 + 1.5 * H)];
  const now = t0 + 2 * H;
  const s = summarize(drinks, male, now);
  assert.ok(s.current > 0.5, `aktuell ${s.current}`);
  assert.ok(s.below05 > now);
  assert.ok(s.soberAt > s.below05);
  assert.ok(s.soberEarliest < s.soberAt && s.soberAt < s.soberLatest);
});

test('Wenn schon nüchtern, sind die Zeiten null', () => {
  const t0 = Date.UTC(2026, 0, 1, 20);
  const s = summarize([beer(t0)], male, t0 + 12 * H);
  assert.equal(s.current, 0);
  assert.equal(s.soberAt, null);
  assert.equal(s.below05, null);
});

test('Einordnung nach Grenzwerten', () => {
  assert.equal(classify(0).level, 0);
  assert.equal(classify(0.2).level, 1);
  assert.equal(classify(0.4).level, 2);
  assert.equal(classify(0.8).level, 3);
  assert.equal(classify(1.3).level, 4);
  assert.equal(classify(3).level, 6);
});

test('Profilprüfung', () => {
  assert.ok(isValidProfile(male));
  assert.ok(!isValidProfile({ ...male, weightKg: 10 }));
  assert.ok(!isValidProfile(null));
});

test('Trinkdauer: Resorption endet vollständig, Anteil steigt monoton', async () => {
  const { absorbedFraction } = await import('../js/bac.js');
  const t0 = Date.UTC(2026, 0, 1, 20);
  const d = beer(t0, { durationMin: 60 });
  let prev = 0;
  for (let m = 0; m <= 300; m += 5) {
    const f = absorbedFraction(d, t0 + m * 60_000);
    assert.ok(f >= prev - 1e-12 && f <= 1, `m=${m} f=${f}`);
    prev = f;
  }
  assert.ok(prev > 0.999);
  // Stetig am Ende der Trinkdauer
  const a = absorbedFraction(d, t0 + H - 1);
  const b = absorbedFraction(d, t0 + H + 1);
  assert.ok(Math.abs(a - b) < 1e-6);
});

test('Langsam getrunken ergibt niedrigeren Spitzenwert als auf ex', () => {
  const t0 = Date.UTC(2026, 0, 1, 20);
  const peakOf = (pts) => Math.max(...pts.map((p) => p.bac));
  const fast = peakOf(simulate([beer(t0), beer(t0)], male));
  const slow = peakOf(simulate([beer(t0, { durationMin: 90 }), beer(t0, { durationMin: 90 })], male));
  assert.ok(slow < fast, `${slow} < ${fast}`);
});

test('Getränk, das noch getrunken wird, zählt erst anteilig', () => {
  const t0 = Date.UTC(2026, 0, 1, 20);
  const s = summarize([beer(t0, { durationMin: 60 })], male, t0 + 10 * 60_000);
  const sAll = summarize([beer(t0)], male, t0 + 10 * 60_000);
  assert.ok(s.current < sAll.current);
  assert.ok(s.peak.t > t0 + 30 * 60_000);
});

// ---------- Gegenproben zur Genauigkeit ----------
import { eliminationRate, likelyRange, STOMACH, ELIMINATION } from '../js/bac.js';

const seidlR = (p) => (p.sex === 'male'
  ? 0.31608 - 0.004821 * p.weightKg + 0.004632 * p.heightCm
  : 0.31223 - 0.006446 * p.weightKg + 0.004466 * p.heightCm);
const watsonR = (p) => (1.055 * totalBodyWater(p)) / (0.8 * p.weightKg);

test('Gegenprobe: Watson-Verteilungsfaktor stimmt mit Seidl et al. (2000) überein', () => {
  const people = [
    male, female,
    { sex: 'male', age: 45, heightCm: 178, weightKg: 85 },
    { sex: 'male', age: 40, heightCm: 185, weightKg: 110 },
    { sex: 'female', age: 50, heightCm: 170, weightKg: 70 },
    { sex: 'female', age: 25, heightCm: 160, weightKg: 52 },
  ];
  for (const p of people) {
    const dev = Math.abs(watsonR(p) / seidlR(p) - 1);
    assert.ok(dev < 0.05, `${JSON.stringify(p)}: Abweichung ${(dev * 100).toFixed(1)} %`);
  }
});

test('Gegenprobe: Verteilungsvolumen liegt bei den Literaturwerten (M ≈ 0,71, F ≈ 0,58 l/kg)', () => {
  const vd = (p) => totalBodyWater(p) / (0.8 * p.weightKg);
  assert.ok(Math.abs(vd({ sex: 'male', age: 40, heightCm: 178, weightKg: 80 }) - 0.71) < 0.04);
  assert.ok(Math.abs(vd({ sex: 'female', age: 40, heightCm: 166, weightKg: 68 }) - 0.58) < 0.04);
});

test('Gegenprobe: Simulation trifft die Handrechnung nach Widmark (zurückgerechneter Anfangswert)', () => {
  const t0 = Date.UTC(2026, 0, 1, 20);
  const grams = 3 * alcoholGrams(500, 5);
  const c0 = grams * (1 - STOMACH.empty.resorptionDeficit) * (0.8 / (1.055 * totalBodyWater(male)));
  const pts = simulate([beer(t0), beer(t0), beer(t0)], male);
  const c2 = bacAt(pts, t0 + 2 * H);
  const c3 = bacAt(pts, t0 + 3 * H);
  const extrapolated = c2 + 2 * (c2 - c3);
  assert.ok(Math.abs(extrapolated / c0 - 1) < 0.02, `C0 ${c0.toFixed(3)} gegen ${extrapolated.toFixed(3)}`);
});

test('Ohne Abbau bleibt der gesamte aufgenommene Alkohol erhalten', () => {
  const t0 = Date.UTC(2026, 0, 1, 20);
  const drinks = [beer(t0, { durationMin: 45 }), beer(t0 + H, { durationMin: 0, fullStomach: true }), beer(t0 + 2 * H, { durationMin: 120 })];
  const k = permillePerGram(male);
  const expected = alcoholGrams(500, 5) * k * (2 * (1 - STOMACH.empty.resorptionDeficit) + (1 - STOMACH.full.resorptionDeficit));
  const pts = simulate(drinks, male, { elimination: 0 });
  assert.ok(Math.abs(pts.at(-1).bac / expected - 1) < 0.002, `${pts.at(-1).bac} gegen ${expected}`);
});

test('Rechengenauigkeit: feinere Zeitschritte ändern das Ergebnis praktisch nicht', () => {
  const t0 = Date.UTC(2026, 0, 1, 20);
  const drinks = [beer(t0, { durationMin: 30 }), beer(t0 + 40 * 60_000, { durationMin: 25 }), beer(t0 + 90 * 60_000, { durationMin: 30, fullStomach: true })];
  const peakOf = (pts) => Math.max(...pts.map((p) => p.bac));
  const coarse = peakOf(simulate(drinks, male));
  const fine = peakOf(simulate(drinks, male, { stepMin: 0.1 }));
  assert.ok(Math.abs(coarse - fine) < 0.003, `${coarse} gegen ${fine}`);
});

test('Abbau: im geraden Teil 0,15 ‰/h, bei kleinen Werten langsamer, nie schneller als nötig', () => {
  assert.ok(Math.abs(eliminationRate(0.5) - 0.15) < 0.005);
  assert.ok(Math.abs(eliminationRate(1.0) - 0.15) < 0.01);
  assert.ok(eliminationRate(0.05) < 0.1);
  assert.equal(eliminationRate(0), 0);
  assert.ok(Math.abs(eliminationRate(0.5, ELIMINATION.slow) - 0.1) < 0.005);
});

test('Langsam getrunken ergibt einen kleinen Wert, nicht null', () => {
  const t0 = Date.UTC(2026, 0, 1, 20);
  const peak = Math.max(...simulate([beer(t0, { durationMin: 180 })], male).map((p) => p.bac));
  assert.ok(peak > 0.03 && peak < 0.15, `Höchstwert ${peak}`);
});

test('Spanne um den Schätzwert: ± 21 %', () => {
  const r = likelyRange(1);
  assert.ok(Math.abs(r.low - 0.79) < 1e-9 && Math.abs(r.high - 1.21) < 1e-9);
});
