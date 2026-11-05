import test from 'node:test';
import assert from 'node:assert/strict';
import {
  flowPath,
  pipePoints,
  valveWorld,
  gaugeAngle,
  identify,
  STAGES,
  LAYOUT,
  toWorld,
  type Vec3,
} from '../lib/twin.ts';
import { CONFIGURATIONS, VALVES, statesFromBits, initialValves } from '../lib/model.ts';

const dist = (a: Vec3, b: Vec3) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const nearestOnPath = (points: Vec3[], p: Vec3) => {
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i],
      b = points[i + 1];
    const ab: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const len2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
    const t =
      len2 === 0
        ? 0
        : Math.max(
            0,
            Math.min(
              1,
              ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) /
                len2,
            ),
          );
    best = Math.min(best, dist([a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t], p));
  }
  return best;
};

void test('Pipe layering keeps horizontal and vertical runs on separate depth layers with a jog between them', () => {
  const pts = pipePoints([
    [10, 20],
    [30, 20],
    [30, 40],
  ]);
  assert.equal(pts.length, 4);
  assert.ok(Math.abs(pts[0][2] - LAYOUT.pipe.horizontal) < 1e-9);
  assert.ok(Math.abs(pts[1][2] - LAYOUT.pipe.horizontal) < 1e-9);
  assert.ok(Math.abs(pts[2][2] - LAYOUT.pipe.vertical) < 1e-9);
  assert.deepEqual(pts[1].slice(0, 2), pts[2].slice(0, 2));
  const explicit = pipePoints([
    [10, 20, 0.2],
    [10, 25, 0.2],
    [10, 25, 0.05],
  ]);
  assert.equal(explicit.length, 3);
  for (const p of explicit) assert.ok(p.every(Number.isFinite));
});

void test('Every supported configuration has one continuous illustrative route through only its open valves', () => {
  const discharge = toWorld(93, 80, 0.2),
    suction = toWorld(88, 80, 0.2);
  for (const c of CONFIGURATIONS) {
    const valves = statesFromBits(c.bits);
    const path = flowPath(valves);
    assert.ok(path, c.id);
    const all = path.flatMap((s) => s.points);
    assert.ok(all.every((p) => p.every(Number.isFinite)), c.id);
    assert.ok(dist(all[0], discharge) < 0.01, c.id + ' starts at the discharge port');
    assert.ok(dist(all[all.length - 1], suction) < 0.01, c.id + ' ends at the suction port');
    for (let i = 1; i < path.length; i++)
      assert.ok(
        dist(path[i - 1].points[path[i - 1].points.length - 1], path[i].points[0]) < 0.03,
        `${c.id}: gap between ${path[i - 1].id} and ${path[i].id}`,
      );
    const routed = path.filter((s) => s.role !== 'vessel').flatMap((s) => s.points);
    for (const v of VALVES) {
      const d = nearestOnPath(routed, valveWorld(v));
      if (valves[v]) assert.ok(d < 0.012, `${c.id}: open valve ${v} should be on the route (${d.toFixed(3)} m)`);
      else assert.ok(d > 0.03, `${c.id}: closed valve ${v} must not be on the route (${d.toFixed(3)} m)`);
    }
    const roles = path.map((s) => s.role);
    assert.equal(roles.filter((r) => r === 'condensing').length, 1, c.id);
    assert.equal(roles.filter((r) => r === 'evaporating').length, 1, c.id);
    const condensing = path.find((s) => s.role === 'condensing')!;
    assert.equal(condensing.id, c.mode === 'Cooling' ? 'coil_lower' : 'coil_upper', c.id);
    assert.equal(path.some((s) => s.id === 'receiver'), c.receiver, c.id);
    assert.equal(path.some((s) => s.id === 'accumulator'), c.accumulator, c.id);
    assert.equal(path.some((s) => s.id === 'txv_in'), c.meter === 'TXV', c.id);
    const nonVessel = roles.filter((r) => r !== 'vessel');
    const order = nonVessel.filter((r, i) => i === 0 || nonVessel[i - 1] !== r);
    assert.deepEqual(order, ['discharge', 'condensing', 'liquid', 'mixture', 'evaporating', 'suction'], c.id);
  }
});

void test('Invalid valve states have no route and gauges clamp to their dial', () => {
  const v = initialValves();
  v.HP1 = false;
  assert.equal(flowPath(v), null);
  assert.ok(Math.abs(gaugeAngle(0, 1800) + Math.PI * 0.75) < 1e-9);
  assert.ok(Math.abs(gaugeAngle(1800, 1800) - Math.PI * 0.75) < 1e-9);
  assert.ok(Math.abs(gaugeAngle(99999, 1800) - Math.PI * 0.75) < 1e-9);
  assert.ok(Math.abs(gaugeAngle(null, 1800) + Math.PI * 0.75) < 1e-9);
});

void test('Node names identify valves and components, stages are unique and bound to number keys', () => {
  assert.deepEqual(identify('Valve_HP1_Wheel'), { kind: 'valve', id: 'HP1' });
  assert.deepEqual(identify('Valve_LRB_Body'), { kind: 'valve', id: 'LRB' });
  assert.deepEqual(identify('Valve_AXV_Wheel'), { kind: 'component', id: 'axv' });
  assert.deepEqual(identify('Coil_Upper_Fins'), { kind: 'component', id: 'coil_upper' });
  assert.deepEqual(identify('Tube_LowerTop_Glass'), { kind: 'component', id: 'tube_lower_top' });
  assert.deepEqual(identify('Gauge_Cond_Needle'), { kind: 'component', id: 'gauge_cond' });
  assert.deepEqual(identify('Receiver_Cap.001'), { kind: 'component', id: 'receiver' });
  assert.equal(identify('Panel'), null);
  assert.equal(identify('Pipe_header'), null);
  assert.equal(new Set(STAGES.map((s) => s.id)).size, STAGES.length);
  assert.deepEqual(
    STAGES.map((s) => s.key),
    ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
  );
  for (const s of STAGES) {
    assert.ok(s.explain('Cooling').length > 20);
    assert.ok(s.position[2] > s.target[2], s.id + ' camera sits in front of the panel');
  }
});
