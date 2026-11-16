import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DRINKS, CATEGORIES, searchDrinks, sizesFor } from '../js/drinks.js';

test('Datenbank: plausible Werte, keine doppelten Namen', () => {
  assert.ok(DRINKS.length > 150);
  const names = new Set();
  for (const d of DRINKS) {
    assert.ok(CATEGORIES[d.cat], `Kategorie ${d.cat}`);
    assert.ok(d.abv >= 0 && d.abv <= 96, `${d.name} ${d.abv}`);
    assert.ok(d.volumeMl >= 10 && d.volumeMl <= 2000, `${d.name} ${d.volumeMl}`);
    assert.ok(!names.has(d.name), `doppelt: ${d.name}`);
    names.add(d.name);
  }
});

test('Suche findet über Namen, Suchbegriffe und Umlaut-Schreibweisen', () => {
  const first = (q) => searchDrinks(q)[0]?.name;
  assert.equal(first('gin tonic'), 'Gin Tonic');
  assert.equal(first('Kölsch'), 'Kölsch');
  assert.equal(first('koelsch'), 'Kölsch');
  assert.ok(searchDrinks('aeppler').some((d) => d.name === 'Apfelwein'));
  assert.ok(searchDrinks('jäger').some((d) => d.name === 'Jägermeister'));
  assert.ok(searchDrinks('weizen').length >= 5);
  assert.equal(searchDrinks('xyzgibtsnicht').length, 0);
});

test('Kategorie-Filter und Größen', () => {
  assert.ok(searchDrinks('', { cat: 'wein', limit: 999 }).every((d) => d.cat === 'wein'));
  const helles = DRINKS.find((d) => d.name === 'Helles');
  assert.deepEqual(sizesFor(helles), [200, 330, 500, 1000]);
});
