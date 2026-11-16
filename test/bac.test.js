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
