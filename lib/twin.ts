/** 3D twin geometry helpers shared with design/3d/build-tu100.py through design/3d/layout.json.
 * World axes follow three.js: x across the panel, y up, z toward the viewer. Metres.
 * Flow paths are illustrative routes along the modelled pipework; they are not measured flow. */
import layout from '../design/3d/layout.json' with { type: 'json' };
import { matchConfiguration, type Valve, type ValveState } from './model.ts';

export type Vec3 = [number, number, number];
export const PANEL = layout.panel;
export const LAYOUT = layout;
type PercentPoint = number[];

export function toWorld(px: number, py: number, d: number): Vec3 {
  return [
    (px / 100 - 0.5) * PANEL.width,
    PANEL.bottom + (1 - py / 100) * PANEL.height,
    d,
  ];
}

const near = (a: Vec3, b: Vec3, tol = 1e-6) =>
  Math.abs(a[0] - b[0]) < tol &&
  Math.abs(a[1] - b[1]) < tol &&
  Math.abs(a[2] - b[2]) < tol;

/** Percent points with optional explicit depth -> world points on two depth layers with jogs where the layer changes.
 * Mirrors pipe_points() in build-tu100.py exactly, so particles ride the modelled pipes. */
export function pipePoints(pts: PercentPoint[]): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i],
      b = pts[i + 1];
    let d: number | null = null;
    if (!(a.length > 2 && b.length > 2)) {
      const horizontal = Math.abs(a[1] - b[1]) < 1e-9;
      d = horizontal ? layout.pipe.horizontal : layout.pipe.vertical;
    }
    const da = a.length > 2 ? a[2] : (d as number);
    const db = b.length > 2 ? b[2] : (d as number);
    const start = toWorld(a[0], a[1], da);
    if (!out.length || !near(out[out.length - 1], start)) out.push(start);
    out.push(toWorld(b[0], b[1], db));
  }
  return out.filter((p, i) => i === 0 || !near(p, out[i - 1]));
}

export type FlowRole =
  | 'discharge'
  | 'condensing'
  | 'liquid'
  | 'mixture'
  | 'evaporating'
  | 'suction'
  | 'vessel';
export type FlowSegment = { id: string; role: FlowRole; points: Vec3[] };

const pipe = (id: string) => {
  const p = layout.pipes.find((x) => x.id === id);
  if (!p) throw new Error('Unknown pipe ' + id);
  return p;
};
const tubeLine = (id: string, leftToRight: boolean): Vec3[] => {
  const t = layout.tubes.find((x) => x.id === id);
  if (!t) throw new Error('Unknown tube ' + id);
  const a = toWorld(t.x1, t.y, t.d),
    b = toWorld(t.x2, t.y, t.d);
  return leftToRight ? [a, b] : [b, a];
};
/** Serpentine through a coil block: 8 passes, U-bends outside the fins, entering at the given row side. */
export function coilPath(id: 'upper' | 'lower', topDown: boolean): Vec3[] {
  const c = layout.coils.find((x) => x.id === id)!;
  const d = c.standoff + c.thickness / 2;
  const rows = Array.from({ length: c.rows }, (_, i) =>
    topDown
      ? c.rowTop + ((c.rowBottom - c.rowTop) * i) / (c.rows - 1)
      : c.rowBottom - ((c.rowBottom - c.rowTop) * i) / (c.rows - 1),
  );
  const pts: Vec3[] = [];
  rows.forEach((y, i) => {
    const [a, b] = i % 2 === 0 ? [c.left, c.right] : [c.right, c.left];
    pts.push(toWorld(a, y, d), toWorld(b, y, d));
  });
  return pts;
}
const rev = (pts: Vec3[]) => [...pts].reverse();
const slicePct = (id: string, from: number, to: number) =>
  pipePoints(pipe(id).pts.slice(from, to + 1));
const split = (id: string, atY: number): [Vec3[], Vec3[]] => {
  const p = pipe(id);
  const [x] = p.pts[0];
  return [
    pipePoints([
      [x, p.pts[0][1]],
      [x, atY],
    ]),
    pipePoints([
      [x, atY],
      [x, p.pts[p.pts.length - 1][1]],
    ]),
  ];
};

type Zone = 'pre' | 'coilLower' | 'mid' | 'meter' | 'mid2' | 'coilUpper' | 'post';
const COOLING_ROLES: Record<Zone, FlowRole> = {
  pre: 'discharge',
  coilLower: 'condensing',
  mid: 'liquid',
  meter: 'liquid',
  mid2: 'mixture',
  coilUpper: 'evaporating',
  post: 'suction',
};
const HEATING_ROLES: Record<Zone, FlowRole> = {
  post: 'discharge',
  coilUpper: 'condensing',
  mid2: 'liquid',
  meter: 'liquid',
  mid: 'mixture',
  coilLower: 'evaporating',
  pre: 'suction',
};

/** The refrigerant route for the current valve state, as ordered segments from the compressor discharge
 * port back to its suction port. Null when the valves do not form a supported configuration. */
export function flowPath(valves: ValveState): FlowSegment[] | null {
  const config = matchConfiguration(valves);
  if (!config) return null;
  const heating = config.mode === 'Heating';
  const seg = (id: string, role: FlowRole, points: Vec3[]): FlowSegment => ({
    id,
    role,
    points,
  });
  const vesselLine = (id: string, a: PercentPoint, b: PercentPoint) =>
    seg(id, 'vessel', [toWorld(a[0], a[1], a[2]), toWorld(b[0], b[1], b[2])]);

  // A: compressor discharge to the valve block tap of the condenser coil.
  const A: FlowSegment[] = heating
    ? [
        seg('disc_riser', 'discharge', pipePoints(pipe('disc_riser').pts)),
        seg('lineA_right', 'discharge', rev(pipePoints(pipe('lineA_right').pts))),
      ]
    : [
        seg('disc_riser', 'discharge', slicePct('disc_riser', 0, 4)),
        seg('lineB_right', 'discharge', rev(pipePoints(pipe('lineB_right').pts))),
      ];

  // B: the coil loop in cooling order, from the lower tap (CB) to the upper tap (CA), tagged by zone.
  const [meterIn, meterOut] = split(config.meter === 'TXV' ? 'txv_branch' : 'ctv_branch', 28.7);
  const header =
    config.meter === 'TXV'
      ? pipePoints(pipe('header').pts)
      : pipePoints([
          [48, 15],
          [61.8, 15],
        ]);
  const B: { zone: Zone; id: string; points: Vec3[] }[] = [
    { zone: 'pre', id: 'lower_trunk', points: pipePoints(pipe('lower_trunk').pts) },
    { zone: 'pre', id: 'tube_lower_top', points: tubeLine('lower_top', false) },
    { zone: 'pre', id: 'lower_left_in', points: pipePoints(pipe('lower_left_in').pts) },
    { zone: 'coilLower', id: 'coil_lower', points: coilPath('lower', true) },
    { zone: 'mid', id: 'lower_left_out', points: pipePoints(pipe('lower_left_out').pts) },
    { zone: 'mid', id: 'tube_lower_bottom', points: tubeLine('lower_bottom', true) },
    { zone: 'mid', id: 'lower_liquid', points: pipePoints(pipe('lower_liquid').pts) },
    ...(config.receiver
      ? [
          { zone: 'mid' as Zone, id: 'rec_in', points: pipePoints(pipe('rec_in').pts) },
          { zone: 'mid' as Zone, id: 'receiver', points: vesselLine('receiver', [51, 81.5, 0.17], [51, 93.5, 0.17]).points },
          { zone: 'mid' as Zone, id: 'rec_out', points: pipePoints(pipe('rec_out').pts) },
        ]
      : [{ zone: 'mid' as Zone, id: 'rec_bypass', points: pipePoints(pipe('rec_bypass').pts) }]),
    { zone: 'mid', id: 'rec_to_dryer', points: pipePoints(pipe('rec_to_dryer').pts) },
    { zone: 'mid', id: 'dryer', points: vesselLine('dryer', [59, 54, 0.05], [59, 47.3, 0.05]).points },
    { zone: 'mid', id: 'dryer_up', points: pipePoints(pipe('dryer_up').pts) },
    { zone: 'mid', id: 'header', points: header },
    { zone: 'meter', id: config.meter === 'TXV' ? 'txv_in' : 'ctv_in', points: meterIn },
    { zone: 'mid2', id: config.meter === 'TXV' ? 'txv_out' : 'ctv_out', points: meterOut },
    ...(config.meter === 'TXV'
      ? [{ zone: 'mid2' as Zone, id: 'collector_txv', points: pipePoints(pipe('collector_txv').pts) }]
      : []),
    { zone: 'mid2', id: 'collector', points: pipePoints(pipe('collector').pts) },
    { zone: 'mid2', id: 'tube_upper_bottom', points: tubeLine('upper_bottom', false) },
    { zone: 'mid2', id: 'upper_left_in', points: pipePoints(pipe('upper_left_in').pts) },
    { zone: 'coilUpper', id: 'coil_upper', points: coilPath('upper', false) },
    { zone: 'post', id: 'upper_left_out', points: pipePoints(pipe('upper_left_out').pts) },
    { zone: 'post', id: 'tube_upper_top', points: tubeLine('upper_top', true) },
    { zone: 'post', id: 'upper_trunk', points: pipePoints(pipe('upper_trunk').pts) },
  ];
  const roles = heating ? HEATING_ROLES : COOLING_ROLES;
  const loop = (heating ? [...B].reverse() : B).map((b) =>
    seg(b.id, b.id === 'receiver' || b.id === 'dryer' ? 'vessel' : roles[b.zone], heating ? rev(b.points) : b.points),
  );

  // C: the evaporator coil's valve block tap back to the compressor suction.
  const C: FlowSegment[] = [
    heating
      ? seg('lineB_left', 'suction', pipePoints(pipe('lineB_left').pts))
      : seg('lineA_left', 'suction', pipePoints(pipe('lineA_left').pts)),
    seg('suc_header', 'suction', heating ? slicePct('suc_header', 1, 2) : pipePoints(pipe('suc_header').pts)),
    ...(config.accumulator
      ? [
          seg('acc_in', 'suction', pipePoints(pipe('acc_in').pts)),
          seg('accumulator', 'vessel', [
            toWorld(65, 71.5, 0.06),
            toWorld(65, 82, 0.06),
            toWorld(69, 82, 0.06),
            toWorld(69, 71.5, 0.06),
          ]),
          seg('acc_out', 'suction', pipePoints(pipe('acc_out').pts)),
        ]
      : [seg('acc_bypass', 'suction', pipePoints(pipe('acc_bypass').pts))]),
    seg('suc_to_comp', 'suction', pipePoints(pipe('suc_to_comp').pts)),
  ];
  return [...A, ...loop, ...C];
}

/** Valve positions in world space (the handwheel pivot, roughly), for highlights and tests. */
export function valveWorld(id: Valve | 'AXV'): Vec3 {
  const v = layout.valves.find((x) => x.id === id)!;
  if ('bench' in v && v.bench) return toWorld(v.x, v.y, v.d as number);
  return toWorld(v.x, v.y, v.axis === 'x' ? layout.pipe.horizontal : layout.pipe.vertical);
}

export const FLOW_STYLE: Record<FlowRole, { colour: string; speed: number; label: string }> = {
  discharge: { colour: '#e2552f', speed: 0.55, label: 'Hot high-pressure vapour' },
  condensing: { colour: '#e08a5c', speed: 0.4, label: 'Condensing: vapour to liquid' },
  liquid: { colour: '#2f6fd1', speed: 0.3, label: 'High-pressure liquid' },
  mixture: { colour: '#4fb8c9', speed: 0.5, label: 'Low-pressure liquid and vapour mixture' },
  evaporating: { colour: '#7ccfd8', speed: 0.45, label: 'Evaporating: liquid to vapour' },
  suction: { colour: '#9bb7e8', speed: 0.6, label: 'Low-pressure vapour returning' },
  vessel: { colour: '#8a8f99', speed: 0.3, label: 'Inside a vessel' },
};

/** Needle angle in radians for a gauge: -135° at zero, +135° at the scale maximum, clamped. */
export function gaugeAngle(value: number | null | undefined, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return -Math.PI * 0.75;
  const t = Math.min(1, Math.max(0, value / max));
  return -Math.PI * 0.75 + t * Math.PI * 1.5;
}

export type StageId =
  | 'whole'
  | 'compressor'
  | 'reversing'
  | 'coil_lower'
  | 'receiver'
  | 'metering'
  | 'coil_upper'
  | 'accumulator'
  | 'gauges';
export type Stage = {
  id: StageId;
  key: string;
  name: string;
  position: Vec3;
  target: Vec3;
  /** GLB node name prefixes to ring-highlight while the stage is active. */
  parts: string[];
  explain: (mode?: 'Cooling' | 'Heating') => string;
};
export const STAGES: Stage[] = [
  {
    id: 'whole',
    key: '1',
    name: 'Whole unit',
    position: [-1.05, 1.75, 3.05],
    target: [0.05, 1.2, 0.05],
    parts: [],
    explain: () =>
      'One panel, two coils, twelve hand valves. Drag to orbit, scroll to zoom, press 1 to 9 to visit each part.',
  },
  {
    id: 'compressor',
    key: '2',
    name: 'Compressor',
    position: [0.62, 1.05, 1.05],
    target: [0.35, 0.74, 0.2],
    parts: ['Compressor'],
    explain: () =>
      'The hermetic compressor raises the vapour pressure and sends hot vapour up the discharge line on the right edge.',
  },
  {
    id: 'reversing',
    key: '3',
    name: 'Reversing valves',
    position: [0.3, 1.42, 0.8],
    target: [0.26, 1.31, 0.05],
    parts: ['Valve_HP1', 'Valve_HP2', 'Valve_HP3', 'Valve_HP4'],
    explain: (mode) =>
      mode === 'Heating'
        ? 'HP2 and HP3 are open: discharge goes to the upper coil and the lower coil returns to suction.'
        : 'HP1 and HP4 are open: discharge goes to the lower coil and the upper coil returns to suction.',
  },
  {
    id: 'coil_lower',
    key: '4',
    name: 'Lower coil',
    position: [-0.5, 1.1, 1.0],
    target: [-0.19, 1.03, 0.08],
    parts: ['Coil_Lower', 'Tube_LowerTop', 'Tube_LowerBottom', 'Tray_Lower'],
    explain: (mode) =>
      mode === 'Heating'
        ? 'In heating the lower coil is the evaporator: refrigerant boils here and absorbs heat from the air.'
        : 'In cooling the lower coil is the condenser: vapour enters at the top tube, rejects heat and leaves the bottom tube as liquid.',
  },
  {
    id: 'receiver',
    key: '5',
    name: 'Receiver',
    position: [-0.3, 1.0, 1.05],
    target: [-0.02, 0.72, 0.2],
    parts: ['Receiver', 'Valve_LRB', 'Valve_LRI', 'Valve_LRK'],
    explain: () =>
      'Liquid can pass through the receiver (LRI in, LRK out) or bypass it through LRB. The close-up photo verifies which handwheel is which.',
  },
  {
    id: 'metering',
    key: '6',
    name: 'Metering devices',
    position: [0.28, 1.85, 0.8],
    target: [0.22, 1.7, 0.05],
    parts: ['TXV', 'AXV', 'CapTube', 'Valve_TXV', 'Valve_CTV', 'Valve_AXV'],
    explain: () =>
      'The thermostatic expansion valve or the capillary tube drops the pressure. Only one of TXV or CTV is open in a supported setup; AXV is not modelled.',
  },
  {
    id: 'coil_upper',
    key: '7',
    name: 'Upper coil',
    position: [-0.5, 1.8, 1.0],
    target: [-0.19, 1.73, 0.08],
    parts: ['Coil_Upper', 'Tube_UpperTop', 'Tube_UpperBottom', 'Tray_Upper'],
    explain: (mode) =>
      mode === 'Heating'
        ? 'In heating the upper coil is the condenser: it rejects heat to the room air.'
        : 'In cooling the upper coil is the evaporator: the mixture enters at the bottom tube, boils, and leaves the top tube as vapour.',
  },
  {
    id: 'accumulator',
    key: '8',
    name: 'Accumulator',
    position: [0.38, 1.05, 0.8],
    target: [0.16, 1.0, 0.08],
    parts: ['Accumulator', 'Valve_ACI', 'Valve_ACO', 'Valve_ACB'],
    explain: () =>
      'Returning vapour can pass through the accumulator (ACI in, ACO out), which protects the compressor from liquid, or bypass it through ACB.',
  },
  {
    id: 'gauges',
    key: '9',
    name: 'Gauges',
    position: [0.0, 1.4, 1.15],
    target: [0.08, 1.3, 0.05],
    parts: ['Gauge_Cond', 'Gauge_Evap', 'Gauge_Suc'],
    explain: () =>
      'Three gauges follow the model: condenser pressure beside the filter-dryer, evaporator pressure at the top, suction pressure beside ACB. All in kPa(g).',
  },
];

/** Selectable non-valve components: node prefix -> id. Valves are identified by their Valve_<id> prefix. */
export const COMPONENTS: Record<
  string,
  { name: string; prefixes: string[]; anchor: string; stage: StageId }
> = {
  coil_upper: { name: 'Upper coil', prefixes: ['Coil_Upper', 'Tray_Upper'], anchor: 'Anchor_Coil_Upper', stage: 'coil_upper' },
  coil_lower: { name: 'Lower coil', prefixes: ['Coil_Lower', 'Tray_Lower'], anchor: 'Anchor_Coil_Lower', stage: 'coil_lower' },
  tube_upper_top: { name: 'Upper coil · top tube', prefixes: ['Tube_UpperTop'], anchor: 'Anchor_Tube_UpperTop', stage: 'coil_upper' },
  tube_upper_bottom: { name: 'Upper coil · bottom tube', prefixes: ['Tube_UpperBottom'], anchor: 'Anchor_Tube_UpperBottom', stage: 'coil_upper' },
  tube_lower_top: { name: 'Lower coil · top tube', prefixes: ['Tube_LowerTop'], anchor: 'Anchor_Tube_LowerTop', stage: 'coil_lower' },
  tube_lower_bottom: { name: 'Lower coil · bottom tube', prefixes: ['Tube_LowerBottom'], anchor: 'Anchor_Tube_LowerBottom', stage: 'coil_lower' },
  compressor: { name: 'Compressor', prefixes: ['Compressor'], anchor: 'Anchor_Compressor', stage: 'compressor' },
  receiver: { name: 'Receiver', prefixes: ['Receiver'], anchor: 'Anchor_Receiver', stage: 'receiver' },
  accumulator: { name: 'Accumulator', prefixes: ['Accumulator'], anchor: 'Anchor_Accumulator', stage: 'accumulator' },
  dryer: { name: 'Filter-dryer', prefixes: ['Dryer', 'SightGlass'], anchor: 'Anchor_Dryer', stage: 'gauges' },
  txv: { name: 'Thermostatic expansion valve', prefixes: ['TXV'], anchor: 'Anchor_Metering', stage: 'metering' },
  axv: { name: 'Automatic expansion valve (not modelled)', prefixes: ['AXV', 'Valve_AXV'], anchor: 'Anchor_Metering', stage: 'metering' },
  captube: { name: 'Capillary tube', prefixes: ['CapTube'], anchor: 'Anchor_Metering', stage: 'metering' },
  gauge_cond: { name: 'Condenser pressure gauge', prefixes: ['Gauge_Cond'], anchor: 'Anchor_Gauges', stage: 'gauges' },
  gauge_evap: { name: 'Evaporator pressure gauge', prefixes: ['Gauge_Evap'], anchor: 'Anchor_Gauges', stage: 'gauges' },
  gauge_suc: { name: 'Suction pressure gauge', prefixes: ['Gauge_Suc'], anchor: 'Anchor_Gauges', stage: 'gauges' },
};

/** Map a GLB node name to what it belongs to. */
export function identify(
  name: string,
): { kind: 'valve'; id: Valve } | { kind: 'component'; id: string } | null {
  const valve = /^Valve_([A-Z0-9]+)(_|$)/.exec(name);
  if (valve && valve[1] !== 'AXV') return { kind: 'valve', id: valve[1] as Valve };
  for (const [id, c] of Object.entries(COMPONENTS))
    if (c.prefixes.some((p) => name === p || name.startsWith(p + '_') || name.startsWith(p + '.')))
      return { kind: 'component', id };
  return null;
}

export type TwinTheme = 'workshop' | 'night' | 'blueprint';
export const THEMES: Record<
  TwinTheme,
  { name: string; background: string; fog: string; ground: string; sun: number; ambient: number; ink: string }
> = {
  workshop: { name: 'Workshop', background: '#e9edf1', fog: '#d6dce4', ground: '#e3e8ee', sun: 2.2, ambient: 0.65, ink: '#18212f' },
  night: { name: 'Night', background: '#1b2130', fog: '#141a26', ground: '#232b3b', sun: 1.3, ambient: 0.35, ink: '#eef2f8' },
  blueprint: { name: 'Blueprint', background: '#1d3b6e', fog: '#183260', ground: '#224680', sun: 1.6, ambient: 0.5, ink: '#f2f6ff' },
};
