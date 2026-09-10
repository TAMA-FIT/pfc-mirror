import assert from 'node:assert/strict';
import { alcoholTotal, shouldShowAlcohol, alcoholUiModel } from '../candidate-modules/features/alcohol.js';

const noAlcohol = [{A:0},{A:0}];
assert.equal(alcoholTotal(noAlcohol), 0);
assert.equal(shouldShowAlcohol(noAlcohol), false);

const drinking = [{A:13.7},{A:7.1}];
assert.equal(Math.round(alcoholTotal(drinking)*10)/10, 20.8);
assert.equal(shouldShowAlcohol(drinking), true);

const model = alcoholUiModel(drinking);
assert.equal(model.visible, true);
assert.equal(model.grams, 20.8);
assert.equal(model.estimatedKcal, 146);

console.log('alcohol.test.mjs: OK');
