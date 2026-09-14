'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { observationStates } from '@/lib/observation';
import type { simulate } from '@/lib/model';
export function ObservationTubes({
  model,
  refrigerant,
  onSelectTube,
}: {
  model: ReturnType<typeof simulate>;
  refrigerant: string;
  onSelectTube?: (id: string) => void;
}) {
  const [selected, setSelected] = useState('evaporator-in');
  const [paused, setPaused] = useState(false);
  const tubes = observationStates(model, refrigerant);
  return (
    <section
      className={
        'observation-view ' +
        (model.values && !paused ? 'flow-running' : 'flow-paused')
      }
    >
      <div className="observation-heading">
        <div>
          <p className="eyebrow">REFRIGERANT THROUGH THE CYCLE</p>
          <h3>Inside the glass tubes</h3>
        </div>
        <Button
          variant="outline"
          onClick={() => setPaused(!paused)}
          aria-pressed={paused}
        >
          {paused ? 'Resume motion' : 'Pause motion'}
        </Button>
      </div>
      <p className="observation-note">
        Illustrative view · colours show phase, arrows show direction. Bubble
        size and motion are not measured flow data.
      </p>
      {!model.values && (
        <p role="status" className="tube-stopped">
          Run a valid configuration to display the expected refrigerant states.
        </p>
      )}
      <div className="tube-selector" aria-label="Observation tube selection">
        {tubes.map((tube) => (
          <Button
            variant="ghost"
            key={tube.id}
            data-tour-tube={tube.id}
            aria-pressed={selected === tube.id}
            onClick={() => {
              setSelected(tube.id);
              onSelectTube?.(tube.id);
            }}
          >
            {tube.title}
          </Button>
        ))}
      </div>
      {tubes
        .filter((tube) => tube.id === selected)
        .map((tube, index) => (
          <article
            key={tube.id}
            className={'tube-row ' + (tube.active ? tube.phase : 'inactive')}
          >
            <div className="tube-heading">
              <span className="tube-index">
                0{tubes.findIndex((t) => t.id === tube.id) + 1}
              </span>
              <div>
                <h4>{tube.title}</h4>
                <span>{tube.coil}</span>
              </div>
              <strong>
                {tube.active ? tube.state : 'No active simulation'}
              </strong>
            </div>
            <svg
              viewBox="0 0 440 74"
              role="img"
              aria-label={`${tube.title}: ${tube.active ? tube.state : 'no active state'}. Schematic teaching illustration.`}
            >
              <defs>
                <clipPath id={`clip-${tube.id}`}>
                  <rect x="33" y="12" width="374" height="37" rx="8" />
                </clipPath>
              </defs>
              <rect
                x="18"
                y="9"
                width="404"
                height="43"
                rx="10"
                fill="#f9fcf8"
                stroke="#a9bcb0"
                strokeWidth="1.5"
              />
              <g clipPath={`url(#clip-${tube.id})`}>
                <rect
                  x="33"
                  y="12"
                  width="374"
                  height="37"
                  className="phase-fill"
                />
                {tube.active &&
                  tube.phase === 'mixture' &&
                  Array.from({ length: 12 }, (_, i) => (
                    <ellipse
                      key={i}
                      cx={15 + i * 36}
                      cy={22 + (i % 3) * 8}
                      rx={5 + (i % 3) * 2}
                      ry={4 + (i % 2) * 2}
                      className="refrigerant-bubble"
                      style={{ animationDelay: `${-i * 0.17}s` }}
                    />
                  ))}
              </g>
              <path
                d="M40 16 H395"
                stroke="white"
                strokeWidth="3"
                opacity=".85"
              />
              <path
                d="M23 5V56 M31 5V56 M409 5V56 M417 5V56"
                stroke="#7f9689"
                strokeWidth="4"
              />
              {tube.active && (
                <g className="direction-markers" aria-hidden="true">
                  {[100, 200, 300].map((x) => (
                    <path
                      key={x}
                      d={`M${x} 64h25m-5-4 5 4-5 4`}
                      fill="none"
                      stroke="#58836a"
                      strokeWidth="1.5"
                    />
                  ))}
                </g>
              )}
            </svg>
            <div className="tube-values">
              <span>
                {tube.active
                  ? `${tube.pressure?.toFixed(1)} kPa(g)`
                  : '— kPa(g)'}
              </span>
              <span>
                {tube.active
                  ? tube.temperature === undefined
                    ? 'Blend: temperature changes during evaporation'
                    : `${tube.temperature.toFixed(1)}°C`
                  : '— °C'}
              </span>
            </div>
            <p>{tube.explanation}</p>
          </article>
        ))}
      <p className="tube-footnote">
        Clear liquid and clear vapour may look similar through real glass. Use
        pressure, temperature and circuit location to identify the state. This
        view represents ideal steady operation; actual sight-glass appearance
        also depends on oil, load and flow conditions.{' '}
        <a
          href="https://iconnecttraining.com/training-units/tu-100-basic-refrigeration-trainer/"
          target="_blank"
          rel="noreferrer"
        >
          About the trainer ↗
        </a>
      </p>
    </section>
  );
}
