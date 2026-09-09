import type { simulate } from './model';
export function observationStates(
  model: ReturnType<typeof simulate>,
  refrigerant: string,
) {
  const v = model.values,
    heating = model.config?.mode === 'Heating';
  return [
    {
      id: 'condenser-in',
      title: 'Condenser inlet',
      coil: heating ? 'Upper coil' : 'Lower coil',
      phase: 'vapour',
      state: 'Hot superheated vapour',
      explanation:
        'The compressor delivers high-pressure vapour. Heat rejection in the condenser cools it and then condenses it into liquid.',
      pressure: v?.Pdis,
      temperature: v?.Tdis,
    },
    {
      id: 'condenser-out',
      title: 'Condenser outlet',
      coil: heating ? 'Upper coil' : 'Lower coil',
      phase: 'liquid',
      state: 'Subcooled liquid',
      explanation:
        'After condensing and subcooling, the refrigerant is liquid. A full liquid tube can look clear; steady bubbles are not expected in this ideal operating state.',
      pressure: v?.Pdis,
      temperature: v?.Tco,
    },
    {
      id: 'evaporator-in',
      title: 'Evaporator inlet',
      coil: heating ? 'Lower coil' : 'Upper coil',
      phase: 'mixture',
      state: 'Liquid + vapour mixture',
      explanation:
        'The metering device drops the pressure. Some liquid flashes into vapour; the remaining liquid absorbs heat and boils as it passes through the evaporator.',
      pressure: v?.Pevap,
      temperature: refrigerant === 'R454C' ? undefined : v?.Tevap,
    },
    {
      id: 'evaporator-out',
      title: 'Evaporator outlet',
      coil: heating ? 'Lower coil' : 'Upper coil',
      phase: 'vapour',
      state: 'Superheated vapour',
      explanation:
        'The liquid has evaporated. The vapour gains superheat before returning towards the compressor. Vapour itself is generally not visible.',
      pressure: v?.Pevap,
      temperature: v?.Teo,
    },
  ].map((tube) => ({
    ...tube,
    coil: model.config ? tube.coil : 'Configuration required',
    active: !!v,
  }));
}
