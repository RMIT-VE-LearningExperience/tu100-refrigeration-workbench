'use client';
/* oxlint-disable next/no-img-element */
import { useState } from 'react';
import { ArrowRight, ZoomIn, Scan } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { STAGES, type StageId } from '@/lib/learning';

export const PART_CODES = ['CP', 'CD', 'TXV', 'EV'];
export function CycleMap({
  selected,
  onSelect,
}: {
  selected?: StageId;
  onSelect?: (id: StageId) => void;
}) {
  return (
    <nav
      className="student-cycle-map"
      aria-label="Cooling cycle, returning to the compressor"
    >
      {STAGES.map((stage, index) => (
        <div key={stage.id}>
          <Button
            variant="ghost"
            aria-pressed={selected === stage.id}
            onClick={() => onSelect?.(stage.id)}
          >
            <span className="part-code">{PART_CODES[index]}</span>
            <strong>{stage.name}</strong>
            <small>{stage.action}</small>
          </Button>
          <ArrowRight aria-hidden="true" />
        </div>
      ))}
      <p>Vapour returns to the compressor ↻</p>
    </nav>
  );
}

export function PartReference({
  compact = false,
  activePart,
}: {
  compact?: boolean;
  activePart?: StageId;
}) {
  const [localSelected, setSelected] = useState<StageId>('evaporator');
  const selected = activePart ?? localSelected;
  const [zoom, setZoom] = useState(false);
  const [heating, setHeating] = useState(false);
  const stage = STAGES.find((s) => s.id === selected)!;
  const photoStage =
    heating && selected === 'evaporator'
      ? STAGES[1]
      : heating && selected === 'condenser'
        ? STAGES[3]
        : stage;
  const location =
    selected === 'evaporator'
      ? heating
        ? 'Lower coil · heating mode'
        : 'Upper coil · cooling mode'
      : selected === 'condenser'
        ? heating
          ? 'Upper coil · heating mode'
          : 'Lower coil · cooling mode'
        : stage.location;
  const choose = (id: StageId) => {
    setSelected(id);
    setZoom(false);
  };
  return (
    <div className={'part-reference ' + (compact ? 'is-compact' : '')}>
      <div className="part-reference-controls">
        <div className="student-segments" aria-label="Choose a component">
          {STAGES.map((s) => (
            <Button
              key={s.id}
              variant="ghost"
              aria-pressed={selected === s.id}
              onClick={() => choose(s.id)}
            >
              {s.name}
            </Button>
          ))}
        </div>
        {!compact && (
          <label htmlFor="reference-mode">
            Reference mode{' '}
            <NativeSelect
              id="reference-mode"
              value={heating ? 'heating' : 'cooling'}
              onChange={(e) => setHeating(e.target.value === 'heating')}
            >
              <NativeSelectOption value="cooling">Cooling</NativeSelectOption>
              <NativeSelectOption value="heating">Heating</NativeSelectOption>
            </NativeSelect>
          </label>
        )}
      </div>
      <div className="part-reference-grid">
        <div className="reference-photo">
          <Button
            variant="outline"
            className="reference-zoom"
            aria-pressed={zoom}
            onClick={() => setZoom(!zoom)}
          >
            {zoom ? <Scan /> : <ZoomIn />}
            {zoom ? 'Whole unit' : 'Look closer'}
          </Button>
          {zoom ? (
            <div
              className="reference-crop"
              style={{
                aspectRatio: `${photoStage.photo.width * 2400} / ${photoStage.photo.height * 3800}`,
              }}
            >
              <img
                src="/assets/trainer.jpg"
                alt={`${stage.name} close-up on the actual trainer`}
                style={{
                  width: `${10000 / photoStage.photo.width}%`,
                  left: `${(-photoStage.photo.x * 100) / photoStage.photo.width}%`,
                  top: `${(-photoStage.photo.y * 100) / photoStage.photo.height}%`,
                }}
              />
            </div>
          ) : (
            <div className="reference-whole">
              <img
                src="/assets/trainer.jpg"
                alt="The RMIT TU-100 refrigeration trainer"
              />
              <span
                className="reference-highlight"
                style={{ left: `${photoStage.x}%`, top: `${photoStage.y}%` }}
                aria-hidden="true"
              >
                {PART_CODES[STAGES.findIndex((s) => s.id === selected)]}
              </span>
            </div>
          )}
          <p className="reference-photo-label">
            {stage.name} · {location}
            {compact && selected !== 'evaporator' && selected !== 'condenser'
              ? ' · cooling example'
              : ''}
          </p>
        </div>
        <section className="reference-explanation" aria-live="polite">
          <p className="learn-eyebrow">{stage.action}</p>
          <h3>{stage.name}</h3>
          <p className="reference-location">{location}</p>
          <p>{stage.description}</p>
          <div className="reference-phase">
            <span>{stage.phase.split(' → ')[0]}</span>
            <ArrowRight aria-hidden="true" />
            <span>{stage.phase.split(' → ')[1]}</span>
          </div>
          <p className="reference-prompt">
            <strong>At the unit</strong>Find this component, then trace where
            the refrigerant goes next. Explain its role to your partner.
          </p>
          {selected === 'meter' && (
            <p className="student-note">
              The highlighted TXV body meters the refrigerant. The red branch
              isolation handle is a different part.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

export function ReadingReference({
  kind,
}: {
  kind: 'superheat' | 'subcooling';
}) {
  const sh = kind === 'superheat';
  return (
    <div className="reading-reference">
      <div className="reading-pair">
        <div>
          <span className="reading-source">OUTLET TEMPERATURE</span>
          <h3>{sh ? 'Evaporator outlet' : 'Condenser outlet'}</h3>
          <p>
            Read the pipe temperature where{' '}
            {sh
              ? 'vapour leaves the evaporator'
              : 'liquid leaves the condenser'}
            .
          </p>
        </div>
        <span className="reading-plus">and</span>
        <div>
          <span className="reading-source">SATURATION REFERENCE</span>
          <h3>{sh ? 'Evaporator dew point' : 'Condenser bubble point'}</h3>
          <p>
            Use the {sh ? 'evaporator' : 'condenser'} pressure and the correct
            refrigerant pressure–temperature reference. Choose the{' '}
            {sh ? 'dew' : 'bubble'} value.
          </p>
        </div>
      </div>
      <div className="reference-equation">
        <strong>{sh ? 'Superheat' : 'Subcooling'} (K)</strong>
        <span>=</span>
        <p>
          {sh
            ? 'Outlet temperature − dew-point temperature'
            : 'Bubble-point temperature − outlet temperature'}
        </p>
      </div>
      <p>
        {sh
          ? 'The difference describes how far the outlet vapour is above its saturation temperature.'
          : 'The difference describes how far the outlet liquid is below its saturation temperature.'}{' '}
        A 1°C difference equals 1 K.
      </p>
      <p className="student-note">
        These are circuit locations, not verified probe positions. Ask your
        teacher to identify the measurement points and use matching pressure
        units and refrigerant data. Follow the class procedure when taking
        readings.
      </p>
    </div>
  );
}

export function PracticalReference({
  onSimulate,
}: {
  onSimulate: (view?: 'equipment' | 'tubes') => void;
}) {
  const [task, setTask] = useState('parts');
  const [kind, setKind] = useState<'superheat' | 'subcooling'>('superheat');
  return (
    <section className="student-space" aria-label="Practical reference">
      <div className="student-title">
        <p className="learn-eyebrow">DURING PRACTICAL WORK</p>
        <h2 tabIndex={-1}>At the unit</h2>
        <p>Find a part, choose your readings, or compare what you see.</p>
      </div>
      <div className="student-segments task-nav" aria-label="Practical task">
        {[
          ['parts', 'Find a component'],
          ['readings', 'Use readings'],
          ['observe', 'Compare observations'],
        ].map(([id, label]) => (
          <Button
            key={id}
            variant="ghost"
            aria-pressed={task === id}
            onClick={() => setTask(id)}
          >
            {label}
          </Button>
        ))}
      </div>
      <div hidden={task !== 'parts'}>
        <PartReference />
      </div>
      {task === 'readings' ? (
        <>
          <div className="student-segments">
            <Button
              variant="ghost"
              aria-pressed={kind === 'superheat'}
              onClick={() => setKind('superheat')}
            >
              Superheat
            </Button>
            <Button
              variant="ghost"
              aria-pressed={kind === 'subcooling'}
              onClick={() => setKind('subcooling')}
            >
              Subcooling
            </Button>
          </div>
          <ReadingReference kind={kind} />
        </>
      ) : task === 'observe' ? (
        <div className="student-observe">
          <h3>Look, then explain</h3>
          <ol>
            <li>
              <strong>Locate the glass section.</strong> Identify which
              component comes before and after it.
            </li>
            <li>
              <strong>Predict the phase.</strong> Should this point contain
              liquid, vapour, or a mixture?
            </li>
            <li>
              <strong>Compare your observation.</strong> Use the circuit
              location, temperature and pressure together. Clear liquid and
              clear vapour can look similar.
            </li>
          </ol>
          <Button onClick={() => onSimulate('tubes')}>
            Open illustrative glass tubes <ArrowRight />
          </Button>
          <p className="student-note">
            The animation shows expected phases. It does not measure the real
            flow or reproduce every bubble you may see.
          </p>
        </div>
      ) : null}
      <footer className="student-reference-footer">
        Reference only · App values are calculated examples. Record actual
        measurements in your class worksheet.
        <Button variant="link" onClick={() => onSimulate('equipment')}>
          Open simulator
        </Button>
      </footer>
    </section>
  );
}
