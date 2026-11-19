import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarize, classify } from '../js/bac.js';
import { buildNotification, sparkline } from '../js/notify.js';

const H = 3600_000;
const male = { sex: 'male', age: 30, heightCm: 180, weightKg: 80 };
const beer = (time) => ({ id: String(time), name: 'Bier', volumeMl: 500, abv: 5, time, durationMin: 20, fullStomach: false });

test('Verlaufsbalken: höchster Wert ist der volle Block, 0 der kleinste', () => {
  assert.equal(sparkline([0, 0.5, 1], 1), '▁▅█');
  assert.equal(sparkline([0, 0], 0).length, 2);
});

test('Ohne Getränke gibt es keine Mitteilung', () => {
  const now = Date.UTC(2026, 0, 1, 20);
  assert.equal(buildNotification(summarize([], male, now), now, 'Stocknüchtern'), null);
});

test('Fahrplan enthält Stand, Uhrzeiten, Stundenwerte und Verlaufsbalken', () => {
  const t0 = Date.UTC(2026, 0, 1, 20);
  const drinks = [beer(t0), beer(t0 + 0.5 * H), beer(t0 + H), beer(t0 + 1.5 * H)];
  const now = t0 + 2 * H;
  const s = summarize(drinks, male, now);
  const note = buildNotification(s, now, classify(s.current).label);
  assert.match(note.title, /^\d,\d\d ‰ um \d\d:\d\d · /);
  assert.match(note.body, /Unter 0,5 ‰ ab \d\d:\d\d · nüchtern ab \d\d:\d\d/);
  assert.match(note.body, /\d+ Uhr \d,\d\d/);
  assert.match(note.body, /[▁▂▃▄▅▆▇█]{10} bis \d\d:\d\d/);
});

test('Kurz nach dem Trinken steht der kommende Höchstwert drin', () => {
  const t0 = Date.UTC(2026, 0, 1, 20);
  const now = t0 + 2 * 60_000;
  const s = summarize([{ ...beer(t0), durationMin: 30 }, { ...beer(t0), durationMin: 30 }], male, now);
  const note = buildNotification(s, now, 'x');
  assert.match(note.body, /^Steigt noch bis \d,\d\d ‰ um \d\d:\d\d/);
});

test('Wieder nüchtern: Mitteilung wird nicht mehr gebraucht', () => {
  const t0 = Date.UTC(2026, 0, 1, 20);
  const now = t0 + 12 * H;
  assert.equal(buildNotification(summarize([beer(t0)], male, now), now, 'Stocknüchtern'), null);
});
