import type { simulate } from './model';
export type StageId = 'compressor' | 'condenser' | 'meter' | 'evaporator';
export const STAGES = [
  {
    id: 'compressor',
    name: 'Compressor',
    action: 'Raise pressure',
    location: 'Bottom right',
    x: 89,
    y: 84,
    phase: 'Vapour → hot vapour',
    description:
      'The compressor raises the pressure of the returning vapour and delivers hot vapour to the condenser.',
    heat: 'Work enters',
    photo: { x: 75, y: 77, width: 25, height: 21 },
  },
  {
    id: 'condenser',
    name: 'Condenser',
    action: 'Release heat',
    location: 'Lower coil · cooling mode',
    x: 29,
    y: 65,
    phase: 'Vapour → liquid',
    description:
      'Refrigerant releases heat to the surrounding air. It condenses into liquid, then subcools before leaving.',
    heat: 'Heat out',
    photo: { x: 9, y: 57, width: 41, height: 22 },
  },
  {
    id: 'meter',
    name: 'Expansion valve',
    action: 'Lower pressure',
    location: 'TXV body · upper right',
    x: 82,
    y: 16,
    phase: 'Liquid → liquid + vapour',
    description:
      'The TXV lowers the refrigerant pressure. Some liquid flashes into vapour before entering the evaporator.',
    heat: 'Pressure drops',
    photo: { x: 73, y: 9, width: 22, height: 18 },
  },
  {
    id: 'evaporator',
    name: 'Evaporator',
    action: 'Absorb heat',
    location: 'Upper coil · cooling mode',
    x: 29,
    y: 17,
    phase: 'Liquid + vapour → vapour',
    description:
      'The remaining liquid absorbs heat and boils. The vapour gains superheat before leaving the evaporator.',
    heat: 'Heat in',
    photo: { x: 9, y: 7, width: 41, height: 24 },
  },
] as const;
export const QUESTIONS = [
  {
    prompt: 'Where does refrigerant absorb heat?',
    target: 'evaporator',
    hint: 'Look for the coil where liquid boils as heat enters the refrigerant.',
    success:
      'Yes — the evaporator absorbs heat. In cooling mode, this is the upper coil.',
  },
  {
    prompt: 'What raises the vapour pressure?',
    target: 'compressor',
    hint: 'Find the component that uses work to compress the returning vapour.',
    success:
      'Yes — the compressor raises the vapour pressure and sends hot vapour to the condenser.',
  },
  {
    prompt: 'Where does refrigerant release heat?',
    target: 'condenser',
    hint: 'Look for the coil where vapour condenses into liquid.',
    success:
      'Yes — the condenser releases heat to the air. In cooling mode, this is the lower coil.',
  },
  {
    prompt: 'What lowers the pressure before the evaporator?',
    target: 'meter',
    hint: 'Find the metering device between the high- and low-pressure sides.',
    success:
      'Yes — the expansion valve lowers the pressure. Some liquid flashes into vapour, and the cycle continues.',
  },
] as const;
export type LessonProgress = {
  version: 1;
  started: boolean;
  step: number;
  completed: boolean;
  selected: StageId | null;
  solved: boolean;
};
export const emptyProgress = (): LessonProgress => ({
  version: 1,
  started: false,
  step: 0,
  completed: false,
  selected: null,
  solved: false,
});
export function restoreProgress(raw: string | null): LessonProgress {
  try {
    const p = JSON.parse(raw ?? 'null');
    if (
      p?.version !== 1 ||
      typeof p.started !== 'boolean' ||
      !Number.isInteger(p.step) ||
      p.step < 0 ||
      p.step >= QUESTIONS.length ||
      typeof p.completed !== 'boolean' ||
      typeof p.solved !== 'boolean' ||
      (p.selected !== null && !STAGES.some((s) => s.id === p.selected))
    )
      return emptyProgress();
    if (!p.started) return emptyProgress();
    return {
      version: 1,
      started: true,
      step: p.completed ? QUESTIONS.length - 1 : p.step,
      completed: p.completed,
      selected: p.selected,
      solved:
        p.completed || (p.solved && p.selected === QUESTIONS[p.step].target),
    };
  } catch {
    return emptyProgress();
  }
}
export function lessonSetupMatches(
  r: string,
  ambient: number,
  model: ReturnType<typeof simulate>,
) {
  return r === 'R134a' && ambient === 25 && model.config?.id === 'cool-txv-all';
}
export function stageReadings(
  id: StageId,
  model: Pick<ReturnType<typeof simulate>, 'values'>,
) {
  const v = model.values;
  const readings = {
    compressor: [
      { label: 'Discharge temperature', value: v?.Tdis, unit: '°C' },
      { label: 'Discharge pressure', value: v?.Pdis, unit: 'kPa(g)' },
    ],
    condenser: [
      { label: 'Liquid outlet', value: v?.Tco, unit: '°C' },
      { label: 'Condenser pressure', value: v?.Pdis, unit: 'kPa(g)' },
    ],
    meter: [
      { label: 'Before TXV', value: v?.Pdis, unit: 'kPa(g)' },
      { label: 'After TXV', value: v?.Pevap, unit: 'kPa(g)' },
    ],
    evaporator: [
      { label: 'Evaporator outlet', value: v?.Teo, unit: '°C' },
      { label: 'Evaporator pressure', value: v?.Pevap, unit: 'kPa(g)' },
    ],
  };
  return readings[id];
}
