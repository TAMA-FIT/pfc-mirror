import assert from 'node:assert/strict';
import { calculateTarget } from '../candidate-modules/features/targets.js';

const std = calculateTarget(2000, 'std');
assert.equal(std.cal, 2000);
assert.equal(std.p, 150);
assert.equal(std.f, 44.4);
assert.equal(std.c, 250);

const lowfat = calculateTarget(1600, 'lowfat');
assert.equal(lowfat.p, 120);
assert.equal(lowfat.f, 17.8);
assert.equal(lowfat.c, 240);

const muscle = calculateTarget(2400, 'muscle');
assert.equal(muscle.p, 240);
assert.equal(muscle.f, 53.3);
assert.equal(muscle.c, 240);

const keto = calculateTarget(1200, 'keto');
assert.equal(keto.p, 90);
assert.equal(keto.f, 80);
assert.equal(keto.c, 30);

console.log('targets.test.mjs: OK');
