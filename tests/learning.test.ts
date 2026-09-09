import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyProgress,
  restoreProgress,
  lessonSetupMatches,
  stageReadings,
  STAGES,
} from '../lib/learning.ts';
import {
  simulate,
  initialValves,
  CONFIGURATIONS,
  statesFromBits,
} from '../lib/model.ts';

void test('Saved lesson progress survives return visits and rejects malformed state', () => {
  const saved = {
    version: 1,
    started: true,
    step: 2,
    selected: 'condenser',
    solved: true,
    completed: false,
  };
  assert.deepEqual(restoreProgress(JSON.stringify(saved)), saved);
  assert.equal(
    restoreProgress(JSON.stringify({ ...saved, selected: 'compressor' }))
      .solved,
    false,
  );
  for (const raw of [
    null,
    'broken',
    '{}',
    JSON.stringify({ ...saved, step: 99 }),
    JSON.stringify({ ...saved, selected: 'missing' }),
    JSON.stringify({ ...saved, version: 2 }),
  ]) {
    assert.deepEqual(restoreProgress(raw), emptyProgress());
  }
});

void test('Lesson setup identifies changes that need recovery without equating Stop with an invalid circuit', () => {
  const base = initialValves();
  assert.equal(
    lessonSetupMatches('R134a', 25, simulate('R134a', 25, base, false)),
    true,
  );
  assert.equal(
    lessonSetupMatches('R32', 25, simulate('R32', 25, base, true)),
    false,
  );
  assert.equal(
    lessonSetupMatches('R134a', 30, simulate('R134a', 30, base, true)),
    false,
  );
  assert.equal(
    lessonSetupMatches(
      'R134a',
      25,
      simulate('R134a', 25, { ...base, HP1: false }, true),
    ),
    false,
  );
  assert.equal(
    lessonSetupMatches(
      'R134a',
      25,
      simulate('R134a', 25, statesFromBits(CONFIGURATIONS[1].bits), true),
    ),
    false,
  );
});

void test('Linked stage readings preserve physical locations and blank all readings when stopped', () => {
  const model = simulate('R134a', 25, initialValves(), true);
  assert.equal(stageReadings('evaporator', model)[0].value, model.values!.Teo);
  assert.equal(stageReadings('condenser', model)[0].value, model.values!.Tco);
  assert.deepEqual(
    stageReadings('meter', model).map((r) => r.value),
    [model.values!.Pdis, model.values!.Pevap],
  );
  const stopped = simulate('R134a', 25, initialValves(), false);
  for (const stage of STAGES)
    assert.ok(
      stageReadings(stage.id, stopped).every((r) => r.value === undefined),
    );
});
