'use client';
/* oxlint-disable react/react-compiler, jsx-a11y/prefer-tag-over-role */
// Reads matchMedia and localStorage after hydration; the 3D scene module is loaded on demand so the
// Learn and Practical surfaces never pay for three.js. Live regions hold block content, and the
// component card is a non-modal panel over the canvas, so role attributes are kept.
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { Eye, EyeOff, Palette, Play, Square, Waves, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { COMPONENTS, FLOW_STYLE, STAGES, THEMES, type StageId, type TwinTheme } from '@/lib/twin';
import { VALVE_NAMES, type Valve, type ValveState, type simulate } from '@/lib/model';
import { observationStates } from '@/lib/observation';
import { stageReadings } from '@/lib/learning';
import type { Pick } from './twin-scene';

const TwinScene = lazy(() => import('./twin-scene'));
const THEME_KEY = 'tu100-twin-theme';
const FLOW_KEY = 'tu100-twin-flow';
const TOUR_HOLD_MS = 4500;

type Props = {
  valves: ValveState;
  model: ReturnType<typeof simulate>;
  refrigerant: string;
  running: boolean;
  selected: Valve | null;
  onSelect: (v: Valve) => void;
  showLabels: boolean;
  onToggleLabels: () => void;
  focusRequest: number;
  tutorial?: ReactNode;
};
type Reading = { label: string; value: number | null | undefined; unit: string };

export function TwinView(props: Props) {
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [theme, setTheme] = useState<TwinTheme>('workshop');
  const [flow, setFlow] = useState(false);
  const [stage, setStage] = useState<StageId | null>('whole');
  const [tour, setTour] = useState(false);
  const [picked, setPicked] = useState<Pick>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const t = localStorage.getItem(THEME_KEY) as TwinTheme | null;
      if (t && t in THEMES) setTheme(t);
      setFlow(localStorage.getItem(FLOW_KEY) === '1');
    } catch {}
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(motion.matches);
    update();
    motion.addEventListener('change', update);
    if (!document.createElement('canvas').getContext('webgl2')) setFailed(true);
    return () => motion.removeEventListener('change', update);
  }, []);

  const chooseTheme = (next: TwinTheme) => {
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}
  };
  const toggleFlow = () => {
    const next = !flow;
    setFlow(next);
    try {
      localStorage.setItem(FLOW_KEY, next ? '1' : '0');
    } catch {}
  };
  const goStage = (id: StageId) => {
    setStage(id);
    setPicked(null);
  };

  useEffect(() => {
    if (!tour) return;
    const index = STAGES.findIndex((s) => s.id === stage);
    const timer = window.setTimeout(() => {
      if (index >= STAGES.length - 1) setTour(false);
      else setStage(STAGES[index + 1].id);
    }, TOUR_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [tour, stage]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable)
      )
        return;
      const s = STAGES.find((x) => x.key === e.key);
      if (s) {
        setTour(false);
        goStage(s.id);
      } else if (e.key === 'Escape' && picked) setPicked(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [picked]);

  const mode = props.model.config?.mode;
  const heating = mode === 'Heating';
  const stageInfo = STAGES.find((s) => s.id === stage);
  const v = props.model.values;
  const component = picked?.kind === 'component' ? COMPONENTS[picked.id] : null;

  const readings: Reading[] = (() => {
    if (!picked || picked.kind !== 'component') return [];
    const tubeMap: Record<string, string> = heating
      ? { tube_upper_top: 'condenser-in', tube_upper_bottom: 'condenser-out', tube_lower_top: 'evaporator-out', tube_lower_bottom: 'evaporator-in' }
      : { tube_lower_top: 'condenser-in', tube_lower_bottom: 'condenser-out', tube_upper_top: 'evaporator-out', tube_upper_bottom: 'evaporator-in' };
    if (picked.id in tubeMap) {
      const t = observationStates(props.model, props.refrigerant).find((x) => x.id === tubeMap[picked.id]);
      return t
        ? [
            { label: t.title, value: undefined, unit: t.state },
            { label: 'Pressure', value: t.pressure, unit: 'kPa(g)' },
            { label: 'Temperature', value: t.temperature, unit: '°C' },
          ]
        : [];
    }
    if (picked.id === 'coil_upper' || picked.id === 'coil_lower') {
      const condenser = (picked.id === 'coil_lower') !== heating;
      return stageReadings(condenser ? 'condenser' : 'evaporator', props.model);
    }
    if (picked.id === 'compressor') return stageReadings('compressor', props.model);
    if (picked.id === 'txv' || picked.id === 'captube') return stageReadings('meter', props.model);
    if (picked.id === 'receiver') return [{ label: 'Receiver outlet', value: v?.Tlro, unit: '°C' }];
    if (picked.id === 'accumulator') return [{ label: 'Accumulator outlet', value: v?.Tacco, unit: '°C' }];
    if (picked.id === 'gauge_cond') return [{ label: 'Condenser pressure', value: v?.Pdis, unit: 'kPa(g)' }];
    if (picked.id === 'gauge_evap') return [{ label: 'Evaporator pressure', value: v?.Pevap, unit: 'kPa(g)' }];
    if (picked.id === 'gauge_suc') return [{ label: 'Suction pressure', value: v?.Psuc, unit: 'kPa(g)' }];
    return [];
  })();
  const role = (() => {
    if (!picked || picked.kind !== 'component') return '';
    if (!mode) return 'Choose a supported setup to see this part’s role.';
    const c = props.model.config!;
    switch (picked.id) {
      case 'coil_upper':
        return heating ? 'Condenser in heating mode: rejects heat to the air.' : 'Evaporator in cooling mode: absorbs heat from the air.';
      case 'coil_lower':
        return heating ? 'Evaporator in heating mode: absorbs heat from the air.' : 'Condenser in cooling mode: rejects heat to the air.';
      case 'receiver':
        return c.receiver ? 'In circuit: liquid passes through LRI and LRK.' : 'Bypassed through LRB in this setup.';
      case 'accumulator':
        return c.accumulator ? 'In circuit: vapour passes through ACI and ACO.' : 'Bypassed through ACB in this setup.';
      case 'txv':
        return c.meter === 'TXV' ? 'Active metering device in this setup.' : 'Closed in this setup; the capillary tube meters instead.';
      case 'captube':
        return c.meter === 'CTV' ? 'Active metering device in this setup.' : 'Closed in this setup; the TXV meters instead.';
      case 'axv':
        return 'Present on the unit, not part of the eight modelled configurations.';
      default:
        return '';
    }
  })();

  return (
    <div ref={root} className="twin-root">
      <div className="zoom-toolbar twin-toolbar" data-tour="zoom">
        <Button variant="ghost" aria-pressed={props.showLabels} onClick={props.onToggleLabels}>
          {props.showLabels ? <Eye size={15} /> : <EyeOff size={15} />} Labels {props.showLabels ? 'on' : 'off'}
        </Button>
        <Button
          variant="ghost"
          aria-pressed={flow}
          onClick={toggleFlow}
          title={props.running && v ? 'Illustrative refrigerant route, not measured flow' : 'Run the example to animate the flow'}
        >
          <Waves size={15} /> Flow {flow ? 'on' : 'off'}
        </Button>
        <details className="twin-theme">
          <summary aria-label="Theme">
            <Palette size={15} /> {THEMES[theme].name}
          </summary>
          <div>
            {(Object.keys(THEMES) as TwinTheme[]).map((t) => (
              <button key={t} aria-pressed={theme === t} onClick={() => chooseTheme(t)}>
                {THEMES[t].name}
              </button>
            ))}
          </div>
        </details>
      </div>
      <div className={'twin-stage-wrap theme-' + theme}>
        {failed ? (
          <div className="twin-fallback" role="alert">
            <p>
              3D needs WebGL 2, which this browser or device does not provide. The Photo, Glass tubes and Circuit
              views still work.
            </p>
          </div>
        ) : mounted ? (
          <Suspense fallback={<p role="status" className="twin-loading">Loading the 3D twin…</p>}>
            <TwinScene
              valves={props.valves}
              model={props.model}
              refrigerant={props.refrigerant}
              running={props.running}
              selected={props.selected}
              picked={picked}
              stage={stage}
              flow={flow}
              labels={props.showLabels}
              theme={theme}
              focusRequest={props.focusRequest}
              reducedMotion={reducedMotion}
              onPick={(pick) => {
                setTour(false);
                if (pick?.kind === 'valve') {
                  setPicked(null);
                  props.onSelect(pick.id);
                } else setPicked(pick);
              }}
              onUserMove={() => {
                setTour(false);
                setStage(null);
              }}
              onReady={() => setReady(true)}
            />
          </Suspense>
        ) : (
          <p role="status" className="twin-loading">
            Preparing the 3D twin…
          </p>
        )}
        {!ready && mounted && !failed && (
          <p className="twin-loading twin-loading-overlay" role="status">
            Loading the unit geometry…
          </p>
        )}
        {stageInfo && (
          <div className="twin-coach" role="status">
            <strong>
              {stageInfo.key} · {stageInfo.name}
            </strong>
            <span>{stageInfo.explain(mode)}</span>
          </div>
        )}
        {picked && component && (
          <div className="twin-card" role="dialog" aria-label={component.name}>
            <div className="twin-card-head">
              <strong>{component.name}</strong>
              <button aria-label="Close" onClick={() => setPicked(null)}>
                <X size={16} />
              </button>
            </div>
            {role && <p>{role}</p>}
            {readings.length > 0 && (
              <dl>
                {readings.map((r) => (
                  <div key={r.label}>
                    <dt>{r.label}</dt>
                    <dd>
                      {r.value === undefined && r.unit && !r.unit.includes('°') && !r.unit.includes('kPa')
                        ? ''
                        : typeof r.value === 'number'
                          ? r.value.toFixed(1)
                          : '—'}{' '}
                      <small>{r.unit}</small>
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            <small>{v ? 'Calculated teaching values' : 'Run the example for readings'}</small>
          </div>
        )}
        {flow && props.running && v && (
          <ul className="twin-legend" aria-label="Flow overlay key">
            {(['discharge', 'condensing', 'liquid', 'mixture', 'evaporating', 'suction'] as const).map((r) => (
              <li key={r}>
                <i style={{ background: FLOW_STYLE[r].colour }} aria-hidden="true" /> {FLOW_STYLE[r].label}
              </li>
            ))}
          </ul>
        )}
        {props.tutorial}
      </div>
      <nav className="twin-stagebar" aria-label="Stages">
        {STAGES.map((s) => (
          <button
            key={s.id}
            aria-pressed={stage === s.id}
            onClick={() => {
              setTour(false);
              goStage(s.id);
            }}
          >
            <kbd>{s.key}</kbd> {s.name}
          </button>
        ))}
        <button
          className="twin-tour"
          aria-pressed={tour}
          onClick={() => {
            if (tour) setTour(false);
            else {
              setTour(true);
              goStage('whole');
            }
          }}
        >
          {tour ? <Square size={13} /> : <Play size={13} />} {tour ? 'Stop tour' : 'Tour'}
        </button>
      </nav>
      <p className="photo-caption">
        Illustrative 3D twin built from photographs and published dimensions · not a survey · flow and phase are
        teaching animations, not measurements
        {props.selected ? ` · ${props.selected}: ${VALVE_NAMES[props.selected]}` : ''}
      </p>
    </div>
  );
}
