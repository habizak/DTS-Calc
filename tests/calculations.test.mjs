import test from 'node:test';
import assert from 'node:assert/strict';
import { convertUnits } from '../js/convert.js';
import { normalizeDistance, normalizePace, normalizeTime, normalizeVelocity, parseDigitsToPace, parseDigitsToTime } from '../js/normalize.js';

test('normalizes time and pace inputs, carrying seconds and bounding values', () => {
  assert.equal(parseDigitsToTime('123456'), '12:34:56');
  assert.equal(parseDigitsToTime('abc'), null);
  assert.equal(parseDigitsToPace('530'), '05:30');
  assert.equal(parseDigitsToPace('5:30'), null);
  assert.equal(normalizeTime('1:59:70'), '02:00:10');
  assert.equal(normalizePace('5:60'), '06:00');
  assert.equal(normalizePace('99:00'), '20:59');
  assert.equal(normalizeDistance('-1'), '0.00');
  assert.equal(normalizeDistance('1,5'), '1.50');
  assert.equal(normalizeVelocity('200'), '99.99');
  assert.equal(normalizeVelocity('invalid'), '0.00');
});

test('converts distance, speed and pace in both directions', () => {
  const fields = { distanceInput: { value: '10' }, speedInput: { value: '12' }, paceInput: { value: '05:00' }, normalizePace };
  convertUnits('METRIC', 'IMPERIAL', fields);
  assert.equal(fields.distanceInput.value, '6.21');
  assert.equal(fields.speedInput.value, '7.46');
  assert.equal(fields.paceInput.value, '08:03');
  convertUnits('IMPERIAL', 'METRIC', fields);
  assert.equal(fields.distanceInput.value, '9.99'); // conversion rounds the displayed values
  assert.equal(fields.speedInput.value, '12.01');
  assert.equal(fields.paceInput.value, '05:00');
});
