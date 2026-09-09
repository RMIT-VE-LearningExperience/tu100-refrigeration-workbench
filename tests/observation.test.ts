import test from 'node:test';
import assert from 'node:assert/strict';
import {
  simulate,
  initialValves,
  CONFIGURATIONS,
  statesFromBits,
} from '../lib/model.ts';
import { observationStates } from '../lib/observation.ts';
test('Observation roles follow every validated heating and cooling circuit', () => {
  for (const c of CONFIGURATIONS) {
    const model = simulate('R134a', 25, statesFromBits(c.bits), true);
    const tubes = observationStates(model, 'R134a');
    assert.equal(tubes.length, 4);
    assert.equal(
      tubes[0].coil,
      c.mode === 'Heating' ? 'Upper coil' : 'Lower coil',
    );
    assert.equal(
      tubes[2].coil,
      c.mode === 'Heating' ? 'Lower coil' : 'Upper coil',
    );
    assert.deepEqual(
      tubes.map((t) => t.phase),
      ['vapour', 'liquid', 'mixture', 'vapour'],
    );
    assert.equal(tubes[2].pressure, model.values!.Pevap);
    assert.equal(tubes[2].temperature, 10);
    assert.ok(tubes.every((t) => t.active));
  }
});
test('Tube readings stop for stopped, invalid and out-of-range conditions', () => {
  const invalid = { ...initialValves(), HP1: false };
  for (const m of [
    simulate('R134a', 25, initialValves(), false),
    simulate('R134a', 25, invalid, true),
    simulate('R134a', NaN, initialValves(), true),
  ]) {
    for (const tube of observationStates(m, 'R134a')) {
      assert.equal(tube.active, false);
      assert.equal(tube.pressure, undefined);
      assert.equal(tube.temperature, undefined);
    }
  }
});
test('Blend mixture does not claim one fixed evaporation temperature', () => {
  const tubes = observationStates(
    simulate('R454C', 25, initialValves(), true),
    'R454C',
  );
  assert.equal(tubes[2].temperature, undefined);
  assert.ok(tubes[0].temperature !== undefined);
});
