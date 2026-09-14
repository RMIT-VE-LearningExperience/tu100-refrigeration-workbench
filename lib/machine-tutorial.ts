export const MACHINE_STEPS = [
  'Look around the unit',
  'Inspect before you operate',
  'Find the receiver bypass',
  'Try a virtual valve',
  'Choose a supported setup',
  'Run the example',
  'Read the measurements',
  'Look inside the glass tubes',
  'Stop and take it to class',
] as const;

export const MACHINE_TUTORIAL_VISIT_KEY = 'tu100-machine-tutorial-seen-v1';

// A page-session fallback also prevents repeated launches when storage is denied.
export function createMachineTutorialVisit() {
  let seenInSession = false;
  return (getStorage: () => Pick<Storage, 'getItem' | 'setItem'>) => {
    if (seenInSession) return false;
    seenInSession = true;
    try {
      const storage = getStorage();
      if (storage.getItem(MACHINE_TUTORIAL_VISIT_KEY) === '1') return false;
      storage.setItem(MACHINE_TUTORIAL_VISIT_KEY, '1');
    } catch {
      // The tutorial still works when browser storage is unavailable.
    }
    return true;
  };
}

export type MachineEvent =
  | 'hp1'
  | 'receiver'
  | 'valve'
  | 'undo'
  | 'setup'
  | 'reading'
  | 'tube';
export type MachineProgress = {
  step: number;
  events: Partial<Record<MachineEvent, boolean>>;
  skipped: number[];
};
export const newMachineTutorial = (): MachineProgress => ({
  step: 0,
  events: {},
  skipped: [],
});
const eventSteps: Record<MachineEvent, number> = {
  hp1: 1,
  receiver: 2,
  valve: 3,
  undo: 3,
  setup: 4,
  reading: 6,
  tube: 7,
};
export function recordMachineEvent(
  progress: MachineProgress,
  event: MachineEvent,
): MachineProgress {
  if (
    eventSteps[event] !== progress.step ||
    (event === 'undo' && !progress.events.valve)
  )
    return progress;
  return { ...progress, events: { ...progress.events, [event]: true } };
}
export function advanceMachineTutorial(
  progress: MachineProgress,
  skip = false,
): MachineProgress {
  return {
    ...progress,
    step: Math.min(MACHINE_STEPS.length, progress.step + 1),
    skipped:
      skip && !progress.skipped.includes(progress.step)
        ? [...progress.skipped, progress.step]
        : progress.skipped,
  };
}
export function machineStepDone(
  progress: MachineProgress,
  state: { running: boolean; hasReadings: boolean; setupMatches: boolean },
): boolean {
  const { events, step } = progress;
  switch (step) {
    case 0:
      return true;
    case 1:
      return !!events.hp1;
    case 2:
      return !!events.receiver;
    case 3:
      return !!events.undo && state.setupMatches;
    case 4:
      return !!events.setup && state.setupMatches;
    case 5:
      return state.running && state.hasReadings;
    case 6:
      return !!events.reading && state.hasReadings;
    case 7:
      return !!events.tube && state.hasReadings;
    case 8:
      return !state.running;
    default:
      return true;
  }
}
