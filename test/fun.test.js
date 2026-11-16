import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUIPS, TWISTERS, pick, katerForecast, tempoVerdict, runningComment, drinksSinceWater } from '../js/fun.js';

test('Für jede der 7 Stufen gibt es Sprüche; die höchste Stufe ist ernst', () => {
  assert.equal(QUIPS.length, 7);
  for (const list of QUIPS) assert.ok(list.length >= 1);
  assert.equal(QUIPS[6].length, 1);
  assert.match(QUIPS[6][0], /Hilfe/);
});

test('pick wiederholt den letzten Eintrag nicht', () => {
  for (let i = 0; i < 50; i++) assert.notEqual(pick(TWISTERS, TWISTERS[0]), TWISTERS[0]);
  assert.equal(pick(['a'], 'a'), 'a');
});

test('Kater-Wetterbericht steigt mit dem Höchstwert', () => {
  const levels = [0.1, 0.4, 0.8, 1.2, 2.0].map((b) => katerForecast(b, 4, 0).level);
  assert.deepEqual(levels, [0, 1, 2, 3, 4]);
});

test('Wasser macht den Kater eine Stufe milder, aber nicht den Orkan', () => {
  assert.equal(katerForecast(0.8, 4, 2).level, 1);
  assert.equal(katerForecast(0.8, 4, 2).milder, true);
  assert.equal(katerForecast(0.8, 4, 1).level, 2);
  assert.equal(katerForecast(2.0, 8, 8).level, 4);
  assert.equal(katerForecast(0.1, 1, 1).milder, false);
});

test('Trinktempo lobt langsames Trinken', () => {
  assert.match(tempoVerdict(5, 30), /Sturzflug/);
  assert.match(tempoVerdict(30, 30), /Schönes Tempo/);
  assert.match(tempoVerdict(70, 30), /Genießer/);
  assert.equal(tempoVerdict(5, 0), '');
});

test('Kommentar zur Stoppuhr und Getränke seit dem letzten Wasser', () => {
  assert.equal(runningComment(1, 30), 'frisch gezapft');
  assert.equal(runningComment(45, 30), 'wird langsam warm');
  const drinks = [{ abv: 5, time: 10 }, { abv: 5, time: 20 }, { abv: 0, time: 25 }, { abv: 12, time: 30 }];
  assert.equal(drinksSinceWater(drinks, []), 3);
  assert.equal(drinksSinceWater(drinks, [15]), 2);
});
