import test from 'node:test';
import assert from 'node:assert/strict';
import { convertUnits } from '../js/convert.js';
import { normalizeDistance, normalizePace, normalizeTime, normalizeVelocity, parseDigitsToPace, parseDigitsToTime } from '../js/normalize.js';
import { parseGPX, segmentRoute } from '../js/gpx.js';
import { totalZoneDuration } from '../js/multi-pace.js';
import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';

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

test('route segmentation preserves total distance and interpolates elevation', () => {
  const segments = segmentRoute([{ lat: 0, lon: 0, ele: 10, distanceKm: 0 }, { lat: 0, lon: 1, ele: 40, distanceKm: 0.25 }]);
  assert.deepEqual(segments.map(s => s.distanceKm), [0.1, 0.1, 0.05]);
  assert.deepEqual(segments.map(s => s.elevationDelta), [12, 12, 6]);
  assert.equal(segments.reduce((sum, s) => sum + s.distanceKm, 0), 0.25);
});

test('parses the supplied GPX and rejects malformed or out-of-range routes', async () => {
  const window = new JSDOM('').window;
  globalThis.DOMParser = window.DOMParser;
  const fixture = await readFile(new URL('../test.gpx', import.meta.url), 'utf8');
  assert.throws(() => parseGPX(fixture), /45km or less/);
  const xml = new DOMParser().parseFromString(fixture, 'application/xml');
  [...xml.getElementsByTagNameNS('*', 'trkpt')].slice(50).forEach(node => node.remove());
  const route = parseGPX(new window.XMLSerializer().serializeToString(xml));
  assert.ok(route.totalKm > 5 && route.totalKm < 45);
  assert.equal(route.hasElevation, true);
  assert.ok(Math.abs(segmentRoute(route.points).reduce((sum, s) => sum + s.distanceKm, 0) - route.totalKm) < 0.001);
  assert.throws(() => parseGPX('<gpx>'), /Could not parse/);
  assert.throws(() => parseGPX('<gpx><trkpt lat="0" lon="0"/><trkpt lat="0.001" lon="0"/></gpx>'), /at least 5km/);
  assert.throws(() => parseGPX('<gpx><trkpt lat="0" lon="0"/><trkpt lat="1" lon="0"/></gpx>'), /45km or less/);
});

test('multi-zone total uses each zone distance and its own pace', () => {
  const segments = [{startKm: 0, endKm: 1}, {startKm: 1, endKm: 2}, {startKm: 2, endKm: 3}];
  const zones = [{startIndex: 0, endIndex: 0, paceSeconds: 300}, {startIndex: 1, endIndex: 2, paceSeconds: 360}];
  assert.equal(totalZoneDuration(zones, segments, {totalKm: 3}), 1020);
  assert.equal(totalZoneDuration([{...zones[0], paceSeconds: null}], segments, {totalKm: 3}), null);
});
