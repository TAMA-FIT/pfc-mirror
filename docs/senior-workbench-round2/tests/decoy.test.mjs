import assert from 'node:assert/strict';
import { generateRealisticHistory, generateRealisticBody, stripDummyRows } from '../candidate-modules/dev/realistic-decoy.js';

const hist = generateRealisticHistory({
  days: 30,
  targetCal: 2000,
  seed: 12345,
  includeAlcohol: true,
  today: new Date('2026-09-08T12:00:00')
});

assert.equal(hist.length, 30);
assert.ok(hist.every(x => x.isDummy === true));
assert.ok(hist.every(x => x.l.every(r => r.isDummy === true)));
const cals = hist.map(x => Math.round(x.s.Cal));
assert.ok(new Set(cals).size > 10, 'calorie totals should vary');
assert.ok(hist.some(x => x.s.A > 0), 'some alcohol days should exist');

const body = generateRealisticBody({
  days: 90,
  seed: 12345,
  startWeight: 72,
  startFat: 22,
  today: new Date('2026-09-08T12:00:00')
});

assert.equal(body.length, 90);
assert.ok(body.every(x => x.isDummy === true));
assert.ok(new Set(body.map(x => x.w)).size > 20, 'weight should fluctuate');

const mixed = [{isDummy:true,id:1},{id:2},{isDummy:false,id:3}];
assert.deepEqual(stripDummyRows(mixed).map(x => x.id), [2,3]);

console.log('decoy.test.mjs: OK');
