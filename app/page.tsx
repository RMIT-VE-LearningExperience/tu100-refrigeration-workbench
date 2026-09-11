'use client';
import './calm.css';
import './learn.css';
import './student.css';
import { PracticalReference } from '@/components/trainer/practical-reference';
import { LearningWorkspace } from '@/components/trainer/learning-workspace';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  Play,
  Square,
  ArrowUpRight,
  Info,
  SlidersHorizontal,
  ChevronRight,
} from 'lucide-react';
import { ModelPilot } from '@/components/trainer/model-pilot';
import { Equipment } from '@/components/trainer/equipment';
import { ObservationTubes } from '@/components/trainer/observation-tubes';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
        role="group"
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
                  <circle cx={x(p[0])} cy={y(p[1])} r={16} fill="transparent" />
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
                        [
                          'State 1 · Suction',
                          'State 2 · Discharge',
                          'State 3 · Liquid',
                          'State 4 · Expansion',
                        ][i]
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
  const [focusRequest, setFocusRequest] = useState(0);
  const [inspected, setInspected] = useState(false);
  const [hotspots, setHotspots] = useState(false);
  const [offline, setOffline] = useState('');
  const [surface, setSurface] = useState<'learn' | 'practical' | 'explore'>(
    'learn',
  );
  const [dialog, setDialog] = useState<'settings' | 'readings' | 'info' | null>(
    null,
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [undo, setUndo] = useState<ReturnType<typeof initialValves> | null>(
    null,
  );
  const focusDestination = () =>
    requestAnimationFrame(() => {
      const heading = document.querySelector<HTMLElement>('main h2, main h3');
      heading?.setAttribute('tabindex', '-1');
      heading?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  const openPractical = () => {
    setSurface('practical');
    setDialog(null);
    setSheetOpen(false);
    focusDestination();
  };
  const openSimulation = (next: 'equipment' | 'tubes' = 'equipment') => {
    setView(next);
    chooseMode(false);
  };
  const chooseMode = (guided: boolean) => {
    setSurface(guided ? 'learn' : 'explore');
    focusDestination();
    setDialog(null);
    setSheetOpen(false);
  };
  useEffect(() => {
    const query = matchMedia('(max-width: 760px)');
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
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
  };
  const selectConfig = (id: string) => {
    const c = CONFIGURATIONS.find((c) => c.id === id);
    if (c) {
      setUndo(null);
      setValves(statesFromBits(c.bits));
      setRunning(false);
    }
  };
  const reset = () => {
    setUndo(null);
    setValves(initialValves());
    setR('R134a');
    setAmbient('25');
    setRunning(false);
    setSelected(null);
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
  const related = selected?.startsWith('LR')
    ? ['Tco', 'Tlro']
    : selected?.startsWith('AC')
      ? ['Teo', 'Tsuc']
      : selected === 'TXV' || selected === 'CTV'
        ? ['Tco', 'Teo']
        : ['Tdis', 'Teo'];
  const selectValve = (key: Valve) => {
    setInspected(true);
    setSelected(key);
    setSheetOpen(true);
  };
  const temperatureRows = (keys?: readonly string[]) => (
    <div className="temperature-list">
      {points
        .filter(([key]) => !keys || keys.includes(key))
        .map(([key, name, location, equation]) => (
          <details key={key} className="temperature-row">
            <summary>
              <span>{name}</span>
              <strong>
                {v
                  ? v[key] === null
                    ? 'Bypassed'
                    : v[key].toFixed(1) + '°C'
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
  );
  const inspector = (
    <>
      <p className="calm-kicker">INSPECT THE UNIT</p>
      <h2>{selected ? selected : 'Choose a component'}</h2>
      <label className="sr-only" htmlFor="component">
        Component
      </label>
      <NativeSelect
        id="component"
        value={selected ?? ''}
        onChange={(e) => selectValve(e.target.value as Valve)}
      >
        <NativeSelectOption value="" disabled>
          Select a valve…
        </NativeSelectOption>
        {groups.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.keys.map((key) => (
              <NativeSelectOption key={key} value={key}>
                {key} · {VALVE_NAMES[key]}
              </NativeSelectOption>
            ))}
          </optgroup>
        ))}
      </NativeSelect>
      {selected ? (
        <div className="calm-component">
          <p>{VALVE_NAMES[selected]}</p>
          <div className="calm-valve-action">
            <span className="calm-position">
              <i className={valves[selected] ? 'is-open' : ''} />
              {valves[selected] ? 'Open' : 'Closed'}
            </span>
            <Button variant="outline" onClick={() => changeValve(selected)}>
              {valves[selected] ? 'Close' : 'Open'} {selected}
            </Button>
          </div>
          {selected !== 'LRB' && (
            <button
              className="calm-text-button"
              onClick={() => {
                setView('equipment');
                setFocusRequest((n) => n + 1);
                setSheetOpen(false);
              }}
            >
              Zoom to component <ArrowUpRight size={14} />
            </button>
          )}
          <p className="calm-small">Operating a valve stops the simulation.</p>
          <p className="calm-kicker">RELATED MEASUREMENTS</p>
          {temperatureRows(related)}
        </div>
      ) : (
        <p className="calm-hint">
          Select a marker on the photograph, or choose a valve here. Group
          markers zoom in to reveal individual valves.
        </p>
      )}
      <section className="calm-pressures" aria-label="Pressure readings">
        <div className="calm-section-heading">
          <span>Model pressures</span>
          <small>kPa(g)</small>
        </div>
        <div className="calm-pressure-row">
          {[
            ['Condenser', v?.Pdis],
            ['Evaporator', v?.Pevap],
            ['Suction', v?.Psuc],
          ].map(([name, value]) => (
            <div key={name as string}>
              <span>{name}</span>
              <strong>
                {typeof value === 'number' ? value.toFixed(1) : '—'}
              </strong>
            </div>
          ))}
        </div>
        <button
          className="calm-text-button"
          onClick={() => setDialog('readings')}
        >
          All readings <ArrowUpRight size={14} />
        </button>
      </section>
      <button className="calm-setup-link" onClick={() => setDialog('settings')}>
        <SlidersHorizontal size={16} />
        <span>
          <strong>Operating setup</strong>
          <small>
            {r} · {ambient || '—'}°C · {model.config?.mode ?? 'Custom circuit'}
          </small>
        </span>
        <ChevronRight size={16} />
      </button>
    </>
  );
  const restoreActivity = () => {
    setValves(initialValves());
    setR('R134a');
    setAmbient('25');
    setRunning(true);
    setUndo(null);
  };
  return (
    <main className="calm" data-surface={surface}>
      <header className="calm-header">
        <div className="calm-brand">
          <span>R</span>
          <h1>
            TU-100 <small>Learning companion</small>
          </h1>
        </div>
        <nav className="calm-mode-nav" aria-label="Workspace">
          <Button
            variant="ghost"
            aria-pressed={surface === 'learn'}
            onClick={() => chooseMode(true)}
          >
            Before class
          </Button>
          <Button
            variant="ghost"
            aria-pressed={surface === 'practical'}
            onClick={openPractical}
          >
            At the unit
          </Button>
          <Button
            variant="ghost"
            aria-pressed={surface === 'explore'}
            onClick={() => chooseMode(false)}
          >
            Simulate
          </Button>
        </nav>
        <div className="calm-header-actions">
          <span
            className={'calm-status ' + (v ? 'running' : '')}
            role="status"
            hidden={surface !== 'explore'}
          >
            {model.status === 'invalid'
              ? 'Check valves'
              : model.status === 'range'
                ? 'Check temperature'
                : v
                  ? 'Example running'
                  : 'Example ready'}
          </span>
          {surface === 'explore' && (
            <Button
              className="calm-run"
              disabled={model.status === 'invalid' || model.status === 'range'}
              onClick={() => setRunning(!running)}
            >
              {running ? <Square size={14} /> : <Play size={14} />}{' '}
              {running ? 'Stop' : 'Run'}
            </Button>
          )}
          <details className="calm-menu">
            <summary aria-label="More options">•••</summary>
            <div
              onClick={(e) => {
                const button = (e.target as HTMLElement).closest('button');
                if (button)
                  e.currentTarget.closest('details')?.removeAttribute('open');
              }}
            >
              <button onClick={() => chooseMode(surface !== 'learn')}>
                {surface === 'explore'
                  ? 'Learn the cycle'
                  : 'Explore equipment'}
              </button>
              <button onClick={() => setDialog('settings')}>
                Operating setup
              </button>
              <button onClick={reset}>Reset trainer</button>
              <button onClick={() => setDialog('info')}>
                About this model
              </button>
            </div>
          </details>
        </div>
      </header>
      {surface === 'explore' && ['invalid', 'range'].includes(model.status) && (
        <div className="calm-error" role="alert">
          <span>
            {model.status === 'range'
              ? 'Enter an ambient temperature from 0 to 55°C.'
              : `To restore a valid circuit: ${nearest.changes.map((key) => `${key} ${nearest.configuration.bits[VALVES.indexOf(key)] === '1' ? 'open' : 'closed'}`).join(', ')}.`}
          </span>
          {undo ? (
            <Button
              variant="outline"
              onClick={() => {
                setValves(undo);
                setUndo(null);
                setRunning(false);
              }}
            >
              Undo valve
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setDialog('settings')}>
              Review setup
            </Button>
          )}
        </div>
      )}
      {surface === 'learn' ? (
        <LearningWorkspace
          model={model}
          refrigerant={r}
          ambient={t}
          onRestore={restoreActivity}
          onExplore={() => chooseMode(false)}
          onPractical={openPractical}
          onStop={() => setRunning(false)}
        />
      ) : surface === 'explore' ? (
        <div
          className={
            'calm-workspace ' + (view !== 'equipment' ? 'visual-only' : '')
          }
        >
          <section className="calm-visual">
            <div className="calm-viewbar">
              <label className="sr-only" htmlFor="view">
                View
              </label>
              <NativeSelect
                id="view"
                value={view}
                onChange={(e) => setView(e.target.value as typeof view)}
              >
                {[
                  ['equipment', 'Equipment'],
                  ['tubes', 'Glass tubes'],
                  ['circuit', 'Circuit reference'],
                  ['cycle', 'p–h cycle'],
                  ['model', '3D inspection · optional'],
                ].map(([value, label]) => (
                  <NativeSelectOption key={value} value={value}>
                    {label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <span className="calm-view-caption">
                <button
                  className="calm-tutorial-entry"
                  onClick={() => chooseMode(true)}
                >
                  Prepare for class
                </button>
              </span>
            </div>
            <p className="simulation-context">
              Calculated teaching model · {r} · {ambient}°C ambient ·{' '}
              {model.config?.mode ?? 'Custom circuit'}. Values are not live
              measurements.
            </p>
            {view !== 'equipment' && (
              <div className="simulation-tools">
                <Button variant="outline" onClick={() => setDialog('settings')}>
                  Example setup
                </Button>
                <Button variant="outline" onClick={() => setDialog('readings')}>
                  Model readings
                </Button>
              </div>
            )}
            <div
              className={
                'calm-stage ' + (view === 'equipment' ? 'is-equipment' : '')
              }
            >
              {view === 'equipment' ? (
                <Equipment
                  focusRequest={focusRequest}
                  inspected={inspected}
                  valves={valves}
                  selected={selected}
                  onSelect={selectValve}
                  hotspots={hotspots}
                  onToggleHotspots={() => setHotspots(!hotspots)}
                  mode={model.config?.mode}
                />
              ) : view === 'tubes' ? (
                <ObservationTubes model={model} refrigerant={r} />
              ) : view === 'model' ? (
                <ModelPilot />
              ) : view === 'cycle' ? (
                <PHChart
                  r={r}
                  t={Number.isFinite(t) && t >= 0 && t <= 55 ? t : 25}
                  receiver={model.config?.receiver ?? true}
                  active={!!v}
                  values={v}
                />
              ) : (
                <div className="circuit-view">
                  <img
                    src="/assets/circuit.png"
                    alt="TU-100 cooling circuit reference with reversing valves, metering devices, receiver and accumulator"
                  />
                  <p className="micro">
                    Cooling reference drawing.{' '}
                    {model.config?.mode === 'Heating'
                      ? 'Heating swaps the upper and lower coil roles.'
                      : ''}
                  </p>
                  <div className="flow-summary">
                    {model.config
                      ? `Compressor → ${model.config.mode === 'Cooling' ? 'Lower' : 'Upper'} coil (condenser) → ${model.config.receiver ? 'Receiver → ' : ''}${model.config.meter} → ${model.config.mode === 'Cooling' ? 'Upper' : 'Lower'} coil (evaporator) → ${model.config.accumulator ? 'Accumulator → ' : ''}Suction`
                      : 'Choose a valid circuit to trace its flow.'}
                  </div>
                </div>
              )}
            </div>
          </section>
          {view === 'equipment' && (
            <aside
              className={'calm-inspector ' + (sheetOpen ? 'sheet-open' : '')}
            >
              <button
                className="calm-sheet-toggle"
                aria-expanded={sheetOpen}
                aria-controls="inspector-content"
                onClick={() => setSheetOpen(!sheetOpen)}
              >
                <span>
                  {selected
                    ? `${selected} · ${VALVE_NAMES[selected]}`
                    : 'Inspect & measure'}
                </span>
                <span>
                  {sheetOpen ? 'Close' : 'Open'} {sheetOpen ? '⌄' : '⌃'}
                </span>
              </button>
              {(!isMobile || sheetOpen) && (
                <div id="inspector-content" className="calm-inspector-content">
                  {inspector}
                </div>
              )}
            </aside>
          )}
        </div>
      ) : null}
      <div hidden={surface !== 'practical'}>
        <PracticalReference onSimulate={openSimulation} />
      </div>
      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDialog(null);
          }
        }}
      >
        <DialogContent className="calm-dialog">
          <DialogTitle>
            {dialog === 'settings'
              ? 'Operating setup'
              : dialog === 'readings'
                ? 'All readings'
                : 'About this model'}
          </DialogTitle>
          <DialogDescription>
            {dialog === 'settings'
              ? 'Configure the circuit and operating conditions.'
              : dialog === 'readings'
                ? 'Calculated values for the current circuit. Select a temperature to see its explanation.'
                : 'A steady-state teaching emulator, not live sensor data.'}
          </DialogDescription>
          {dialog === 'settings' ? (
            <div className="calm-settings">
              <label htmlFor="preset">Configuration</label>
              <NativeSelect
                id="preset"
                value={model.config?.id ?? ''}
                onChange={(e) => selectConfig(e.target.value)}
              >
                <NativeSelectOption value="" disabled>
                  Custom · check valves
                </NativeSelectOption>
                {CONFIGURATIONS.map((c) => (
                  <NativeSelectOption key={c.id} value={c.id}>
                    {c.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <label htmlFor="refrigerant">Refrigerant</label>
              <NativeSelect
                id="refrigerant"
                value={r}
                onChange={(e) => {
                  setR(e.target.value as Refrigerant);
                }}
              >
                {REFRIGERANTS.filter(
                  (f) => f !== 'R454C' || SETTINGS.enableR454C,
                ).map((f) => (
                  <NativeSelectOption key={f}>{f}</NativeSelectOption>
                ))}
              </NativeSelect>
              <p>
                {r === 'R134a'
                  ? 'R134a is the refrigerant on the physical unit.'
                  : 'Virtual comparison only; not a physical-unit retrofit.'}
              </p>
              <label htmlFor="ambient">Ambient air · °C</label>
              <Input
                id="ambient"
                type="number"
                min="0"
                max="55"
                step=".5"
                value={ambient}
                onChange={(e) => {
                  setAmbient(e.target.value);
                }}
                aria-invalid={model.status === 'range'}
              />
              {model.status === 'range' && (
                <p role="alert">Enter a number from 0 to 55°C.</p>
              )}
              <Button onClick={() => setDialog(null)}>Done</Button>
            </div>
          ) : dialog === 'readings' ? (
            <>
              <div className="gauges">
                <Gauge
                  name="Condenser"
                  symbol="Pdis"
                  value={v?.Pdis}
                  max={r === 'R32' ? 5000 : 3500}
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
              {temperatureRows()}
            </>
          ) : (
            <div className="calm-about">
              <p>
                The model supports eight valve configurations. Its operating
                offsets are provisional and require calibration against the RMIT
                unit.
              </p>
              <p>
                Startup, faults, fan-speed changes and AXV operation are not
                simulated. The 3D pilot is illustrative geometry, not a measured
                replica.
              </p>
              <details>
                <summary>Model assumptions</summary>
                <p>
                  Coil TD 15 K; evaporator SH 5 K; suction SH 15 K; discharge SH
                  30 K; condenser SC 5 K. Gauge readings use kPa(g). R454C uses
                  separate dew and bubble curves.
                </p>
                <a
                  href="https://coolprop.org/coolprop/HighLevelAPI.html"
                  target="_blank"
                  rel="noreferrer"
                >
                  Property reference ↗
                </a>
              </details>
              <p>
                {offline ||
                  'Offline package prepares after loading the published app.'}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
