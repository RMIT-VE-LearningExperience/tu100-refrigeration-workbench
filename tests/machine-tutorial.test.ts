import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newMachineTutorial,
  recordMachineEvent,
  advanceMachineTutorial,
  machineStepDone,
  MACHINE_STEPS,
  MACHINE_TUTORIAL_VISIT_KEY,
  createMachineTutorialVisit,
} from '../lib/machine-tutorial.ts';

const stopped = { running: false, hasReadings: false, setupMatches: true };
const live = { running: true, hasReadings: true, setupMatches: true };

void test('First-visit launch is remembered separately from lesson progress and survives a new page session', () => {
  const saved = new Map([['lesson-progress', 'existing answers']]);
  const storage = {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => {
      saved.set(key, value);
    },
  };
  const visit = createMachineTutorialVisit();
  assert.equal(
    visit(() => storage),
    true,
  );
  assert.equal(
    visit(() => storage),
    false,
  );
  assert.equal(
    createMachineTutorialVisit()(() => storage),
    false,
  );
  assert.equal(saved.get(MACHINE_TUTORIAL_VISIT_KEY), '1');
  assert.equal(saved.get('lesson-progress'), 'existing answers');
});

void test('Denied browser storage still launches once without repeated resets in the page session', () => {
  const unavailable = () => {
    throw new Error('Storage denied');
  };
  const visit = createMachineTutorialVisit();
  assert.equal(visit(unavailable), true);
  assert.equal(visit(unavailable), false);
});

void test('Machine walkthrough requires the intended actions and does not credit unrelated earlier clicks', () => {
  let p = newMachineTutorial();
  p = recordMachineEvent(p, 'hp1');
  p = advanceMachineTutorial(p);
  assert.equal(machineStepDone(p, stopped), false);
  p = recordMachineEvent(p, 'hp1');
  assert.equal(machineStepDone(p, stopped), true);
  p = advanceMachineTutorial(p);
  assert.equal(machineStepDone(p, stopped), false);
  p = recordMachineEvent(p, 'receiver');
  assert.equal(machineStepDone(p, stopped), true);
});

void test('Valve practice requires a valve change before undo, and setup still needs confirmation', () => {
  let p = { ...newMachineTutorial(), step: 3 };
  p = recordMachineEvent(p, 'undo');
  assert.equal(machineStepDone(p, stopped), false);
  p = recordMachineEvent(p, 'valve');
  assert.equal(machineStepDone(p, stopped), false);
  p = recordMachineEvent(p, 'undo');
  assert.equal(machineStepDone(p, stopped), true);
  assert.equal(machineStepDone(p, { ...stopped, setupMatches: false }), false);
  p = advanceMachineTutorial(p);
  assert.equal(machineStepDone(p, stopped), false);
  p = recordMachineEvent(p, 'setup');
  assert.equal(machineStepDone(p, stopped), true);
  assert.equal(machineStepDone(p, { ...stopped, setupMatches: false }), false);
});

void test('Measurements and phase steps require live readings; stopping completes the final action', () => {
  let p = { ...newMachineTutorial(), step: 5 };
  assert.equal(machineStepDone(p, { ...live, hasReadings: false }), false);
  assert.equal(machineStepDone(p, live), true);
  p = advanceMachineTutorial(p);
  p = recordMachineEvent(p, 'reading');
  assert.equal(machineStepDone(p, stopped), false);
  assert.equal(machineStepDone(p, live), true);
  p = advanceMachineTutorial(p);
  p = recordMachineEvent(p, 'tube');
  assert.equal(machineStepDone(p, stopped), false);
  assert.equal(machineStepDone(p, live), true);
  p = advanceMachineTutorial(p);
  assert.equal(machineStepDone(p, live), false);
  assert.equal(machineStepDone(p, stopped), true);
});

void test('Every step has a skip route and skipped actions are recorded without claiming completion', () => {
  let p = newMachineTutorial();
  for (let i = 0; i < MACHINE_STEPS.length; i++)
    p = advanceMachineTutorial(p, true);
  assert.equal(p.step, MACHINE_STEPS.length);
  assert.deepEqual(p.events, {});
  assert.equal(p.skipped.length, MACHINE_STEPS.length);
  p = advanceMachineTutorial(p);
  assert.equal(p.step, MACHINE_STEPS.length);
});
