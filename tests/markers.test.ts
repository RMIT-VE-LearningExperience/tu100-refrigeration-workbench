import test from 'node:test';
import assert from 'node:assert/strict';
import { clusterMarkers } from '../lib/markers.ts';
const valves = [
  { id: 'HP1', x: 73.8, y: 44 },
  { id: 'HP2', x: 85.5, y: 44 },
  { id: 'HP3', x: 73.8, y: 50.3 },
  { id: 'HP4', x: 85.5, y: 50.3 },
];
test('Crowded reversing valves group at whole-unit scale and separate when enlarged', () => {
  const groups = clusterMarkers(valves, 340, 538);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].members.length, 4);
  const enlarged = clusterMarkers(valves, 680, 1076);
  assert.equal(enlarged.length, 4);
  assert.ok(enlarged.every((g) => g.members.length === 1));
});
test('Each marker appears once and small-screen groups stay selectable', () => {
  const points = [
    ...valves,
    { id: 'TXV', x: 85.5, y: 28.7 },
    { id: 'CTV', x: 61.8, y: 28.7 },
  ];
  for (const width of [180, 240, 340, 680, 1020]) {
    const groups = clusterMarkers(points, width, (width * 3800) / 2400);
    assert.deepEqual(
      groups.flatMap((g) => g.members.map((m) => m.id)).sort(),
      points.map((p) => p.id).sort(),
    );
    for (let i = 0; i < groups.length; i++)
      for (let j = i + 1; j < groups.length; j++) {
        assert.ok(
          Math.abs(((groups[i].x - groups[j].x) * width) / 100) >= 44 ||
            Math.abs(
              ((groups[i].y - groups[j].y) * width * 3800) / 2400 / 100,
            ) >= 44,
        );
      }
  }
});
