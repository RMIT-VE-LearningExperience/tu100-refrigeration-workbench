'use client';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  Play,
  Square,
  RotateCcw,
  ArrowUpRight,
  Thermometer,
  Info,
  Check,
  SlidersHorizontal,
  CircleHelp,
  ChevronRight,
  Crosshair,
  BookOpen,
} from 'lucide-react';
import { ModelPilot } from '@/components/trainer/model-pilot';
import { Equipment } from '@/components/trainer/equipment';
import { ObservationTubes } from '@/components/trainer/observation-tubes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  CONFIGURATIONS,
  VALVES,
  VALVE_NAMES,
  REFRIGERANTS,
  SETTINGS,
  initialValves,
  statesFromBits,
  simulate,
  nearestConfiguration,
  type Valve,
  type Refrigerant,
} from '@/lib/model';
import properties from '@/lib/properties.json';

const points = [
  ['Tdis', 'Discharge', 'Compressor outlet', 'Tcond + 30 K'],
  [
    'Tco',
    'Condenser outlet',
    'Liquid leaving the coil',
    'Tbubble at Pdis − 5 K',
  ],
  ['Tlro', 'Receiver outlet', 'Liquid receiver outlet', 'Tco − 0.1 K'],
  ['Teo', 'Evaporator outlet', 'Vapour leaving the coil', 'Tevap + 5 K'],
  ['Tacco', 'Accumulator outlet', 'Suction accumulator outlet', 'Teo + 1 K'],
  ['Tsuc', 'Compressor suction', 'Compressor inlet', 'Tevap − 5 K + 15 K'],
  ['Tcondairo', 'Condenser air out', 'Air leaving condenser', 'Tamb + 5 K'],
  ['Tevapairo', 'Evaporator air out', 'Air leaving evaporator', 'Tamb − 5 K'],
] as const;
const groups = [
  { label: 'Flow direction', keys: ['HP1', 'HP2', 'HP3', 'HP4'] },
  { label: 'Liquid receiver', keys: ['LRI', 'LRK', 'LRB'] },
  { label: 'Metering device', keys: ['TXV', 'CTV'] },
  { label: 'Accumulator', keys: ['ACI', 'ACO', 'ACB'] },
] as { label: string; keys: Valve[] }[];
function Gauge({
  name,
  symbol,
  value,
  max = 1200,
  blue = false,
}: {
  name: string;
  symbol: string;
  value: number | undefined;
  max?: number;
  blue?: boolean;
}) {
  const angle = -130 + Math.min(1, Math.max(0, (value ?? 0) / max)) * 260;
  return (
    <div className={'gauge ' + (blue ? 'blue' : '')}>
      <svg
        viewBox="0 -20 140 120"
        role="img"
        aria-label={`${name}: ${value === undefined ? 'no reading' : value.toFixed(1) + ' kPa gauge'}`}
      >
        <path
          d="M 24 78 A 58 58 0 1 1 116 78"
          fill="none"
          stroke="#e0e5df"
          strokeWidth="8"
        />
        {Array.from({ length: 9 }, (_, i) => {
          const a = ((-220 + i * 32.5) * Math.PI) / 180;
          return (
            <line
              key={i}
              x1={(70 + 48 * Math.cos(a)).toFixed(4)}
              y1={(45 + 48 * Math.sin(a)).toFixed(4)}
              x2={(70 + 55 * Math.cos(a)).toFixed(4)}
              y2={(45 + 55 * Math.sin(a)).toFixed(4)}
              stroke="#8c9c94"
              strokeWidth="1"
            />
          );
        })}
        <g
          style={{
            transform: `rotate(${angle}deg)`,
            transformOrigin: '70px 45px',
          }}
          className="needle"
        >
          <path d="M70 1 L73 45 L67 45 Z" fill={blue ? '#347b95' : '#a55242'} />
          <circle cx="70" cy="45" r="5" fill="#233b32" />
        </g>
        <text x="18" y="95">
          0
        </text>
        <text x="112" y="95" textAnchor="end">
          {max}
        </text>
      </svg>
      <strong>{value === undefined ? '—' : value.toFixed(1)}</strong>
      <small>kPa(g) · {symbol}</small>
      <span>{name}</span>
    </div>
  );
}
function PHChart({
  r,
  t,
  receiver,
  active,
  values,
}: {
  r: Refrigerant;
  t: number;
  receiver: boolean;
  active: boolean;
  values: ReturnType<typeof simulate>['values'];
}) {
  const [selectedPoint, setSelectedPoint] = useState(0);
  if (r === 'R454C')
    return (
      <div className="chart-empty">
        <Info />
        <h3>Blend property validation pending</h3>
        <p>
          R454C pressures and temperatures are available. Its enthalpy cycle
          will be enabled after the mixture property model is independently
          validated.
        </p>
        <a
          href="https://www.opteon.com/en/-/media/files/opteon/c-xl20ph-si-xl20-enthalpy-diagram-si.pdf"
          target="_blank"
          rel="noreferrer"
        >
          View the manufacturer’s R454C chart <ArrowUpRight size={14} />
        </a>
      </div>
    );
  const data = properties.fluids[r];
  const lo = Math.min(110, Math.max(0, Math.floor(t * 2))),
    hi = Math.min(110, lo + 1),
    f = t * 2 - lo;
  const get = (
    key:
      | 'suction'
      | 'discharge'
      | 'condenserOutlet'
      | 'receiverOutlet'
      | 'evaporatorOutlet',
  ) =>
    data.samples[lo][key].map((n, i) => n + (data.samples[hi][key][i] - n) * f);
  const evapP =
    data.samples[lo].evaporatorPressure +
    (data.samples[hi].evaporatorPressure -
      data.samples[lo].evaporatorPressure) *
      f;
  const liquid = get(receiver ? 'receiverOutlet' : 'condenserOutlet');
  const cycle = [
    get('suction'),
    get('discharge'),
    get('condenserOutlet'),
    ...(receiver ? [liquid] : []),
    [liquid[0], evapP],
    get('evaporatorOutlet'),
    get('suction'),
  ];
  const allH = data.dome
    .flatMap((d) => [d[0], d[2]])
    .concat(cycle.map((d) => d[0]));
  const hMin = Math.floor((Math.min(...allH) - 20) / 50) * 50,
    hMax = Math.ceil((Math.max(...allH) + 20) / 50) * 50;
  const pMin = 40,
    pMax = 10000;
  const x = (h: number) => 65 + ((h - hMin) / (hMax - hMin)) * 550,
    y = (p: number) =>
      325 -
      ((Math.log10(p) - Math.log10(pMin)) /
        (Math.log10(pMax) - Math.log10(pMin))) *
        280;
  const path = (arr: number[][]) =>
    arr
      .map(
        (p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(2)},${y(p[1]).toFixed(2)}`,
      )
      .join(' ');
  return (
    <div className="ph-chart">
      <div className="chart-title">
        <div>
          <p className="eyebrow">PRESSURE–ENTHALPY</p>
          <h3>The cycle, made visible</h3>
        </div>
        <span>{r} · kPa absolute</span>
      </div>
      <svg
        viewBox="0 0 665 385"
        role="img"
        aria-label={`${r} pressure–enthalpy diagram with saturation dome${active ? ' and calculated steady-state cycle' : ''}`}
      >
        {[100, 200, 500, 1000, 2000, 5000, 10000].map((p) => (
          <g key={p}>
            <line x1="65" x2="615" y1={y(p)} y2={y(p)} stroke="#e2e8e2" />
            <text x="54" y={y(p) + 4} textAnchor="end">
              {p.toLocaleString()}
            </text>
          </g>
        ))}
        {Array.from(
          { length: 7 },
          (_, i) => hMin + ((hMax - hMin) * i) / 6,
        ).map((h) => (
          <g key={h}>
            <line x1={x(h)} x2={x(h)} y1="45" y2="325" stroke="#edf0ec" />
            <text x={x(h)} y="346" textAnchor="middle">
              {h.toFixed(0)}
            </text>
          </g>
        ))}
        <path
          d={
            path(data.dome.map((d) => [d[0], d[1]])) +
            ' ' +
            path(data.dome.map((d) => [d[2], d[1]]))
          }
          fill="none"
          stroke="#90a294"
          strokeWidth="2"
        />
        <text x="290" y="285" fill="#8b9a90">
          LIQUID + VAPOUR
        </text>
        <text x="86" y="150">
          LIQUID
        </text>
        <text x="510" y="150">
          VAPOUR
        </text>
        {active && (
          <>
            <path
              d={path(cycle)}
              stroke="#087253"
              strokeWidth="3"
              fill="none"
              strokeLinejoin="round"
            />
            {[get('suction'), get('discharge'), liquid, [liquid[0], evapP]].map(
              (p, i) => (
                <g
                  key={i}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select cycle point ${i + 1}`}
                  onClick={() => setSelectedPoint(i)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedPoint(i);
                    }
                  }}
                >
                  <circle
                    cx={x(p[0])}
                    cy={y(p[1])}
                    r={selectedPoint === i ? 8 : 5}
                    fill="#087253"
                    stroke="white"
                    strokeWidth="2"
                  />
                  <text
                    x={x(p[0]) + 10}
                    y={y(p[1]) - 9}
                    className="chart-point"
                  >
                    {i + 1}
                  </text>
                </g>
              ),
            )}
          </>
        )}
        <text x="330" y="374" textAnchor="middle">
          Specific enthalpy · kJ/kg
        </text>
        <text transform="translate(15,205) rotate(-90)" textAnchor="middle">
          Pressure · kPa absolute (log scale)
        </text>
      </svg>
      <div className="cycle-legend">
        <span>1 Suction</span>
        <span>2 Discharge</span>
        <span>3 Liquid line</span>
        <span>4 After expansion</span>
      </div>
      <p className="micro">
        {active
          ? 'Ideal isenthalpic expansion; includes the assumed suction-line pressure drop and heat gain.'
          : 'Run a valid configuration to plot the cycle.'}{' '}
        CoolProp 8.0.0 · IIR reference · interpolated at 0.5°C ambient
        intervals. Saturation curves show the available temperature range; the
        critical-point closure is not plotted.
      </p>
      {active && (
        <table className="chart-table">
          <caption>Calculated cycle states</caption>
          <thead>
            <tr>
              <th>Point</th>
              <th>kPa(g)</th>
              <th>kPa abs.</th>
              <th>°C</th>
              <th>h · kJ/kg</th>
            </tr>
          </thead>
          <tbody>
            {[get('suction'), get('discharge'), liquid, [liquid[0], evapP]].map(
              (point, i) => (
                <tr
                  key={i}
                  className={selectedPoint === i ? 'selected-state' : ''}
                >
                  <th>
                    <button
                      onClick={() => setSelectedPoint(i)}
                      aria-pressed={selectedPoint === i}
                    >
                      {
                        ['1 Suction', '2 Discharge', '3 Liquid', '4 Expansion'][
                          i
                        ]
                      }
                    </button>
                  </th>
                  <td>{(point[1] - 101.325).toFixed(1)}</td>
                  <td>{point[1].toFixed(1)}</td>
                  <td>
                    {values
                      ? [
                          values.Tsuc,
                          values.Tdis,
                          receiver ? values.Tlro : values.Tco,
                          values.Tevap,
                        ][i]?.toFixed(1)
                      : '—'}
                  </td>
                  <td>{point[0].toFixed(1)}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function Home() {
  const [valves, setValves] = useState(initialValves);
  const [r, setR] = useState<Refrigerant>('R134a');
  const [ambient, setAmbient] = useState('25');
  const [running, setRunning] = useState(false);
  const [view, setView] = useState<
    'equipment' | 'circuit' | 'cycle' | 'tubes' | 'model'
  >('equipment');
  const [selected, setSelected] = useState<Valve | null>(null);
  const [hotspots, setHotspots] = useState(true);
  const [learn, setLearn] = useState(false);
  const [exercise, setExercise] = useState(false);
  const [answers, setAnswers] = useState({ sh: '', sc: '' });
  const [checked, setChecked] = useState(false);
  const [offline, setOffline] = useState('');
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [mobilePanel, setMobilePanel] = useState('inspect');
  const [undo, setUndo] = useState<ReturnType<typeof initialValves> | null>(
    null,
  );
  const closeTour = () => {
    setTourStep(null);
    try {
      localStorage.setItem('tu100-guided-v2', 'seen');
    } catch {}
  };
  useEffect(() => {
    try {
      if (localStorage.getItem('tu100-guided-v2') !== 'seen') setTourStep(0);
    } catch {
      setTourStep(0);
    }
  }, []);
  useEffect(() => {
    const bar = document.querySelector('.operation-bar');
    if (!bar) return;
    const observer = new ResizeObserver(() =>
      document.documentElement.style.setProperty(
        '--operation-height',
        `${bar.getBoundingClientRect().height}px`,
      ),
    );
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);
  const t = ambient.trim() === '' ? NaN : Number(ambient);
  const model = simulate(r, t, valves, running),
    v = model.values;
  const nearest = nearestConfiguration(valves);
  const snapshot = useRef({ r, t, valves, running });
  snapshot.current = { r, t, valves, running };
  const changeValve = (key: Valve) => {
    setUndo({ ...valves });
    setValves((old) => ({ ...old, [key]: !old[key] }));
    setSelected(key);
    setRunning(false);
    setChecked(false);
  };
  const selectConfig = (id: string) => {
    const c = CONFIGURATIONS.find((c) => c.id === id);
    if (c) {
      setUndo(null);
      setValves(statesFromBits(c.bits));
      setRunning(false);
      setChecked(false);
    }
  };
  const reset = () => {
    setUndo(null);
    setValves(initialValves());
    setR('R134a');
    setAmbient('25');
    setRunning(false);
    setSelected(null);
    setChecked(false);
    setAnswers({ sh: '', sc: '' });
  };
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production')
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => navigator.serviceWorker.ready)
        .then(() => setOffline('Offline package ready'))
        .catch(() => setOffline('Online session'));
  }, []);
  useEffect(() => {
    const context = (
      document as unknown as {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: unknown,
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tools = [
      {
        name: 'read_trainer',
        description:
          'Read current valve states, inputs and simulated measurements.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: () => {
          const s = snapshot.current;
          return { ...s, ...simulate(s.r, s.t, s.valves, s.running) };
        },
      },
      {
        name: 'configure_trainer',
        description:
          'Apply a supported training configuration and ambient temperature; leaves simulation stopped.',
        inputSchema: {
          type: 'object',
          properties: {
            configurationId: {
              type: 'string',
              enum: CONFIGURATIONS.map((c) => c.id),
            },
            ambientC: { type: 'number', minimum: 0, maximum: 55 },
            refrigerant: {
              type: 'string',
              enum: REFRIGERANTS.filter(
                (f) => f !== 'R454C' || SETTINGS.enableR454C,
              ),
            },
          },
          required: ['configurationId', 'ambientC', 'refrigerant'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false },
        execute: (input: unknown) => {
          const a = input as {
            configurationId: string;
            ambientC: number;
            refrigerant: Refrigerant;
          };
          const c = CONFIGURATIONS.find((c) => c.id === a?.configurationId);
          if (
            !c ||
            !Number.isFinite(a.ambientC) ||
            a.ambientC < 0 ||
            a.ambientC > 55 ||
            !REFRIGERANTS.includes(a.refrigerant) ||
            (a.refrigerant === 'R454C' && !SETTINGS.enableR454C)
          )
            throw new Error(
              'Unsupported configuration, refrigerant or ambient temperature.',
            );
          flushSync(() => {
            setValves(statesFromBits(c.bits));
            setAmbient(String(a.ambientC));
            setR(a.refrigerant);
            setRunning(false);
          });
          return { status: 'stopped', configuration: c.name };
        },
      },
      {
        name: 'set_trainer_running',
        description:
          'Start or stop the simulation. Starting requires a valid valve configuration and ambient input.',
        inputSchema: {
          type: 'object',
          properties: { running: { type: 'boolean' } },
          required: ['running'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false },
        execute: (input: unknown) => {
          const a = input as { running: boolean };
          if (typeof a?.running !== 'boolean')
            throw new Error('running must be boolean');
          const s = snapshot.current;
          const result = simulate(s.r, s.t, s.valves, a.running);
          if (a.running && result.status !== 'running')
            throw new Error(
              'Resolve the invalid configuration or ambient input before starting.',
            );
          flushSync(() => setRunning(a.running));
          return result;
        },
      },
    ];
    for (const tool of tools) {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {}
    }
    return () => lifecycle.abort();
  }, []);
  const status =
    model.status === 'running'
      ? 'Simulation running'
      : model.status === 'invalid'
        ? 'Check valve configuration'
        : model.status === 'range'
          ? 'Check ambient temperature'
          : 'Ready to run';
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            R
          </span>
          <div>
            <strong>RMIT</strong>
            <small>VIRTUAL LEARNING LAB</small>
          </div>
        </div>
        <span className="course">
          UEERA0036 <span className="sep">/</span> Refrigeration
        </span>
        <div className="header-help">
          <Button
            variant="ghost"
            className="help-button"
            onClick={() => {
              setTourStep(0);
              setMobilePanel('inspect');
            }}
          >
            <BookOpen size={16} /> Tutorial
          </Button>
          <Button
            variant="ghost"
            className="help-button"
            onClick={() => setLearn(!learn)}
            aria-expanded={learn}
          >
            <CircleHelp size={17} /> Learning guide
          </Button>
        </div>
      </header>
      <div className="operation-bar">
        <div className="workbench-title">
          <h1>
            TU-100 <span>Digital twin</span>
          </h1>
          <span>Steady-state teaching model · Calibration pending</span>
        </div>
        <div className="operation-status" role="status">
          <strong>{status}</strong>
          <span>
            {model.status === 'invalid'
              ? nearest.changes
                  .map(
                    (key) =>
                      `${key}: set ${nearest.configuration.bits[VALVES.indexOf(key)] === '1' ? 'open' : 'closed'}`,
                  )
                  .join(' · ')
              : model.status === 'range'
                ? 'Ambient must be between 0 and 55°C.'
                : model.config?.name}
          </span>
        </div>
        <div className="heading-actions">
          {undo && (
            <Button
              variant="outline"
              onClick={() => {
                setValves(undo);
                setUndo(null);
                setRunning(false);
                setChecked(false);
              }}
            >
              Undo valve
            </Button>
          )}
          <Button variant="ghost" onClick={reset} aria-label="Reset trainer">
            <RotateCcw size={18} />
          </Button>
          <Button
            className={'run-button ' + (running ? 'stop' : '')}
            disabled={model.status === 'invalid' || model.status === 'range'}
            onClick={() => setRunning(!running)}
          >
            {running ? <Square size={14} /> : <Play size={14} />}{' '}
            {running ? 'Stop simulation' : 'Run simulation'}
          </Button>
        </div>
      </div>
      {tourStep !== null && (
        <section className="guided-task" aria-label="Guided first run">
          <div>
            <span className="eyebrow">
              GUIDED FIRST RUN · {tourStep + 1} / 4
            </span>
            <h2>
              {
                [
                  'Start with a working circuit',
                  'Run the unit',
                  'Inspect the refrigerant',
                  'Explain a measurement',
                ][tourStep]
              }
            </h2>
            <p>
              {
                [
                  'Load the R134a cooling preset. Then use the Run button above.',
                  'Press Run simulation above. The measurements show the calculated steady state.',
                  'Open Glass tubes and select Evaporator inlet. Compare its phase with the condenser outlet.',
                  'Open the exercise to calculate superheat and subcooling from the displayed temperatures.',
                ][tourStep]
              }
            </p>
          </div>
          <div className="guided-actions">
            {tourStep === 0 ? (
              <Button
                onClick={() => {
                  reset();
                  setTourStep(1);
                }}
              >
                Load starting circuit
              </Button>
            ) : tourStep === 1 ? (
              <Button
                disabled={!v}
                onClick={() => {
                  setView('tubes');
                  setMobilePanel('inspect');
                  setTourStep(2);
                }}
              >
                Inspect the tubes
              </Button>
            ) : tourStep === 2 ? (
              <Button
                onClick={() => {
                  setExercise(true);
                  setMobilePanel('measure');
                  setTourStep(3);
                }}
              >
                Calculate superheat
              </Button>
            ) : (
              <Button onClick={closeTour}>Finish guide</Button>
            )}
            <Button variant="ghost" onClick={closeTour}>
              Skip guide
            </Button>
          </div>
        </section>
      )}
      <nav className="mobile-navigation" aria-label="Workbench panels">
        {['configure', 'inspect', 'measure'].map((panel) => (
          <Button
            key={panel}
            variant="ghost"
            aria-pressed={mobilePanel === panel}
            onClick={() => setMobilePanel(panel)}
          >
            {panel[0].toUpperCase() + panel.slice(1)}
          </Button>
        ))}
      </nav>
      {learn && (
        <section className="guide">
          <BookOpen size={21} />
          <div>
            <h2>From configuration to understanding</h2>
            <ol>
              <li>
                Choose a preset, or open and close valves to assemble a valid
                circuit.
              </li>
              <li>
                Set ambient temperature and refrigerant. Press Run simulation.
              </li>
              <li>
                Compare gauge pressures with saturation temperatures, then
                calculate superheat and subcooling.
              </li>
              <li>
                Use the cycle view to connect each measurement to a refrigerant
                state.
              </li>
            </ol>
            <p>
              This steady-state emulator supports practical learning. Its
              operating offsets are provisional; physical startup, faults,
              fan-speed changes and AXV operation are not simulated.
            </p>
          </div>
          <Button variant="ghost" onClick={() => setLearn(false)}>
            Close
          </Button>
        </section>
      )}
      <div className="workbench" data-panel={mobilePanel}>
        <aside className="controls">
          <div className="panel-title">
            <SlidersHorizontal size={16} />
            <h2>Configure the unit</h2>
          </div>
          <label className="field-label" htmlFor="preset">
            Start from a configuration
          </label>
          <NativeSelect
            id="preset"
            value={model.config?.id ?? ''}
            onChange={(e) => selectConfig(e.target.value)}
          >
            <NativeSelectOption value="" disabled>
              Custom · configuration incomplete
            </NativeSelectOption>
            {CONFIGURATIONS.map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {c.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <div className="valve-heading">
            <span>VALVE</span>
            <span>POSITION</span>
          </div>
          {groups.map((g) => (
            <section className="valve-group" key={g.label}>
              <h3>{g.label}</h3>
              {g.keys.map((key) => (
                <Button
                  key={key}
                  variant="ghost"
                  className={
                    'valve-row ' + (selected === key ? 'selected' : '')
                  }
                  onClick={() => changeValve(key)}
                  aria-pressed={valves[key]}
                  aria-label={`${key} ${VALVE_NAMES[key]}, ${valves[key] ? 'open' : 'closed'}. Toggle valve.`}
                >
                  <span className="valve-id">{key}</span>
                  <span className="valve-name">{VALVE_NAMES[key]}</span>
                  <span
                    className={
                      'valve-state ' + (valves[key] ? 'open' : 'closed')
                    }
                  >
                    <i />
                    {valves[key] ? 'Open' : 'Closed'}
                  </span>
                </Button>
              ))}
            </section>
          ))}
          <div className="axv-row">
            <span>AXV</span>
            <span>Not simulated</span>
          </div>
          <p className="micro">
            Changing a valve stops the simulation. Set the circuit, then press
            Run.
          </p>
        </aside>
        <section className="visual-workspace">
          <div className="view-toolbar">
            <div className="tabs" aria-label="Trainer views">
              {(
                ['equipment', 'circuit', 'cycle', 'tubes', 'model'] as const
              ).map((tab) => (
                <Button
                  variant="ghost"
                  key={tab}
                  className={view === tab ? 'active' : ''}
                  aria-pressed={view === tab}
                  onClick={() => setView(tab)}
                >
                  {tab === 'equipment'
                    ? 'Equipment'
                    : tab === 'circuit'
                      ? 'Circuit'
                      : tab === 'tubes'
                        ? 'Glass tubes'
                        : tab === 'model'
                          ? '3D pilot'
                          : 'p–h cycle'}
                </Button>
              ))}
            </div>
            {view === 'equipment' && (
              <Button
                variant="ghost"
                className="hotspot-toggle"
                onClick={() => setHotspots(!hotspots)}
                aria-pressed={hotspots}
                aria-label="Show valve hotspots"
              >
                <Crosshair size={17} />
              </Button>
            )}
          </div>
          {selected && (
            <div className="selection-bar">
              <span>
                <strong>{selected}</strong> · {VALVE_NAMES[selected]} ·{' '}
                {valves[selected] ? 'Open' : 'Closed'}
              </span>
              <Button variant="outline" onClick={() => changeValve(selected)}>
                {valves[selected] ? 'Close' : 'Open'} {selected}
              </Button>
            </div>
          )}
          <div className="quick-readings" aria-label="Current pressures">
            <span>
              Condenser <strong>{v ? v.Pdis.toFixed(1) : '—'}</strong>
            </span>
            <span>
              Evaporator <strong>{v ? v.Pevap.toFixed(1) : '—'}</strong>
            </span>
            <span>
              Suction <strong>{v ? v.Psuc.toFixed(1) : '—'}</strong>
            </span>
            <small>kPa(g)</small>
          </div>
          <div
            className={
              'visual-stage ' +
              (view === 'cycle' ? 'chart-stage' : '') +
              (view === 'tubes' ? ' tubes-stage' : '') +
              (view === 'equipment' ? ' equipment-stage' : '')
            }
          >
            {view === 'equipment' ? (
              <Equipment
                valves={valves}
                selected={selected}
                onSelect={setSelected}
                hotspots={hotspots}
                mode={model.config?.mode}
              />
            ) : view === 'circuit' ? (
              <div className="circuit-view">
                <p className="eyebrow">PHYSICAL PIPEWORK REFERENCE</p>
                <img
                  src="/assets/circuit.png"
                  alt="9001 TU-100 refrigeration circuit showing coils, HP1 to HP4 reversing valves, metering alternatives, receiver, accumulator and bypass valves"
                />
                <p className="micro">
                  Original circuit drawing shows the cooling arrangement.{' '}
                  {model.config?.mode === 'Heating'
                    ? 'Your current valve pattern swaps the upper and lower coil roles.'
                    : 'Use the valve panel to configure the circuit.'}
                </p>
                <div className="flow-summary">
                  {model.config ? (
                    <>
                      Compressor <ChevronRight />{' '}
                      {model.config.mode === 'Cooling' ? 'Lower' : 'Upper'} coil
                      (condenser) <ChevronRight />{' '}
                      {model.config.receiver ? 'Receiver → ' : ''}
                      {model.config.meter} <ChevronRight />{' '}
                      {model.config.mode === 'Cooling' ? 'Upper' : 'Lower'} coil
                      (evaporator) <ChevronRight />{' '}
                      {model.config.accumulator ? 'Accumulator → ' : ''} Suction
                    </>
                  ) : (
                    'Complete a valid configuration to trace the selected flow path.'
                  )}
                </div>
              </div>
            ) : view === 'model' ? (
              <ModelPilot />
            ) : view === 'tubes' ? (
              <ObservationTubes model={model} refrigerant={r} />
            ) : (
              <PHChart
                r={r}
                t={Number.isFinite(t) && t >= 0 && t <= 55 ? t : 25}
                receiver={model.config?.receiver ?? true}
                active={!!v}
                values={v}
              />
            )}
          </div>
        </section>
        <aside className="readings">
          {selected && (
            <section className="component-inspector">
              <p className="eyebrow">SELECTED VALVE</p>
              <h2>
                {selected} · {VALVE_NAMES[selected]}
              </h2>
              <p>
                Position:{' '}
                <strong>{valves[selected] ? 'Open' : 'Closed'}</strong>
              </p>
              <Button variant="outline" onClick={() => changeValve(selected)}>
                {valves[selected] ? 'Close' : 'Open'} {selected}
              </Button>
              <p className="micro">Operating a valve stops the simulation.</p>
            </section>
          )}
          <div className="panel-title">
            <Thermometer size={17} />
            <h2>Operating conditions</h2>
          </div>
          <div className="refrigerant-field">
            <label className="field-label" htmlFor="refrigerant">
              Refrigerant
            </label>
            <NativeSelect
              id="refrigerant"
              value={r}
              onChange={(e) => {
                setR(e.target.value as Refrigerant);
                setChecked(false);
              }}
            >
              {REFRIGERANTS.filter(
                (f) => f !== 'R454C' || SETTINGS.enableR454C,
              ).map((f) => (
                <NativeSelectOption key={f}>{f}</NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <p className="micro refrigerant-note">
            {r === 'R134a'
              ? 'Nameplate refrigerant · reference model'
              : 'Simulated comparison · not a retrofit instruction'}
          </p>
          <div className="ambient-label">
            <label className="field-label" htmlFor="ambient">
              Ambient air
            </label>
            <div className="ambient-number">
              <Input
                id="ambient"
                type="number"
                step="0.5"
                min="0"
                max="55"
                value={ambient}
                onChange={(e) => {
                  setAmbient(e.target.value);
                  setChecked(false);
                }}
                aria-invalid={model.status === 'range'}
              />
              <span>°C</span>
            </div>
          </div>
          <input
            aria-label="Ambient air temperature slider"
            className="ambient-slider"
            type="range"
            min="0"
            max="55"
            step="0.5"
            value={Number.isFinite(t) ? Math.min(55, Math.max(0, t)) : 0}
            onChange={(e) => {
              setAmbient(e.target.value);
              setChecked(false);
            }}
          />
          <div className="range-labels">
            <span>0°C</span>
            <span>55°C</span>
          </div>
          <div className="section-label">
            <span>PRESSURE GAUGES</span>
            <span>kPa gauge</span>
          </div>
          <div className="gauges">
            <Gauge
              name="Condenser"
              symbol="Pdis"
              value={v?.Pdis}
              max={r === 'R134a' ? 2400 : r === 'R32' ? 5000 : 3500}
            />
            <Gauge
              name="Evaporator"
              symbol="Pevap"
              value={v?.Pevap}
              max={r === 'R32' ? 3000 : 1800}
            />
            <Gauge
              name="Suction"
              symbol="Psuc"
              value={v?.Psuc}
              max={r === 'R32' ? 3000 : 1800}
              blue
            />
          </div>
          <div className="section-label">
            <span>TEMPERATURE READINGS</span>
            <span>°C</span>
          </div>
          <div className="temperature-list">
            {points.map(([key, name, location, equation]) => (
              <details key={key} className="temperature-row">
                <summary>
                  <span>{name}</span>
                  <strong>
                    {v
                      ? v[key] === null
                        ? 'Bypassed'
                        : v[key].toFixed(1)
                      : '—'}
                  </strong>
                </summary>
                <p>
                  {location}.<br />
                  <code>{equation}</code>
                </p>
              </details>
            ))}
          </div>
          <div className="airflow">
            <span>Coil airflow</span>
            <span>Not validated</span>
          </div>
          <details className="model-note">
            <summary>
              <Info size={14} /> About these readings
            </summary>
            <p>
              Calculated steady-state values, not live sensor readings. Coil TD
              15 K; evaporator SH 5 K; suction SH 15 K; discharge SH 30 K;
              condenser SC 5 K. Air splits and line offsets await calibration on
              the unit.
            </p>
            <p>
              R454C bubble temperature is obtained by inverting the
              bubble-pressure curve at the condenser pressure. All gauge
              readings use kPa(g).
            </p>
            <a
              href="https://coolprop.org/coolprop/HighLevelAPI.html"
              target="_blank"
              rel="noreferrer"
            >
              Property reference ↗
            </a>
          </details>
          <section className="learning-strip">
            <div>
              <p className="eyebrow">PUT THE READINGS TO WORK</p>
              <h2>Can you explain the operating conditions?</h2>
              <p>
                Calculate superheat and subcooling from the same measurements
                you would take in the workshop.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setExercise(!exercise)}
              aria-expanded={exercise}
            >
              {exercise ? 'Close exercise' : 'Try an exercise'}
              <ArrowUpRight size={15} />
            </Button>
          </section>
          {exercise && (
            <section className="exercise">
              <div>
                <h3>Measure. Calculate. Check.</h3>
                <p>
                  Evaporator dew temperature:{' '}
                  <b>{v ? v.Tevap.toFixed(1) + '°C' : 'Run simulation'}</b>
                  <br />
                  Condenser bubble temperature:{' '}
                  <b>{v ? v.Tbubble.toFixed(1) + '°C' : 'Run simulation'}</b>
                </p>
                <p>
                  Evaporator outlet: {v ? `${v.Teo.toFixed(1)}°C` : '—'} ·
                  Condenser outlet: {v ? `${v.Tco.toFixed(1)}°C` : '—'}
                </p>
              </div>
              <label>
                Evaporator superheat (K)
                <Input
                  type="number"
                  step="0.1"
                  value={answers.sh}
                  onChange={(e) => {
                    setAnswers({ ...answers, sh: e.target.value });
                    setChecked(false);
                  }}
                />
              </label>
              <label>
                Condenser subcooling (K)
                <Input
                  type="number"
                  step="0.1"
                  value={answers.sc}
                  onChange={(e) => {
                    setAnswers({ ...answers, sc: e.target.value });
                    setChecked(false);
                  }}
                />
              </label>
              <Button
                disabled={
                  !v || answers.sh.trim() === '' || answers.sc.trim() === ''
                }
                onClick={() => setChecked(true)}
              >
                Check answers
              </Button>
              {checked && (
                <p className="exercise-result" role="status">
                  {v &&
                  Math.abs(Number(answers.sh) - (v.Teo - v.Tevap)) < 0.11 &&
                  Math.abs(Number(answers.sc) - (v.Tbubble - v.Tco)) < 0.11
                    ? 'Correct. Both are 5 K in this fixed-offset teaching model.'
                    : v &&
                        Math.abs(Number(answers.sh) - (v.Teo - v.Tevap)) >= 0.11
                      ? 'Check superheat: subtract evaporator dew temperature from evaporator outlet temperature.'
                      : 'Check subcooling: subtract condenser outlet temperature from condenser bubble temperature.'}
                </p>
              )}
            </section>
          )}
        </aside>
      </div>
      <footer>
        <span>RMIT · CoVE Learning & Teaching Innovation</span>
        <span>
          Steady-state prototype · Calibration pending
          {offline ? ' · ' + offline : ''}
        </span>
      </footer>
    </main>
  );
}
