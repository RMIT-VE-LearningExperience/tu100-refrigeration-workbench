'use client';
import { createElement, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
type Viewer = HTMLElement & {
  cameraOrbit: string;
  cameraTarget: string;
  fieldOfView: string;
  jumpCameraToGoal: () => void;
};
const focuses = {
  whole: { target: '0m 0m 0m', orbit: '-20deg 80deg 2.2m' },
  coil: { target: '-0.19m 0.16m 0.085m', orbit: '-15deg 80deg 1.35m' },
  tube: { target: '0.39m 0.16m 0.085m', orbit: '-20deg 85deg 0.65m' },
  valve: { target: '0.39m -0.28m 0.15m', orbit: '-20deg 80deg 0.55m' },
};
export function ModelPilot() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [focus, setFocus] = useState<keyof typeof focuses>('whole');
  const ref = useRef<Viewer | null>(null);
  useEffect(() => {
    let alive = true;
    import('@google/model-viewer')
      .then(() => {
        if (alive) setReady(true);
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fail = () => setError(true),
      done = () => setLoaded(true);
    el.addEventListener('error', fail);
    el.addEventListener('load', done);
    return () => {
      el.removeEventListener('error', fail);
      el.removeEventListener('load', done);
    };
  }, [ready]);
  function select(value: keyof typeof focuses) {
    setFocus(value);
    if (ref.current) {
      ref.current.cameraTarget = focuses[value].target;
      ref.current.cameraOrbit = focuses[value].orbit;
    }
  }
  return (
    <section className="model-pilot">
      <p className="eyebrow">OPTIONAL · SPATIAL INSPECTION</p>
      <h2>Explore a coil assembly</h2>
      <p className="micro">
        Illustrative geometry, not a measured replica. This isolated section
        demonstrates 3D inspection; use the equipment photo for the actual unit.
      </p>
      <div className="model-controls">
        {(['whole', 'coil', 'tube', 'valve'] as const).map((key) => (
          <Button
            variant="ghost"
            key={key}
            aria-pressed={focus === key}
            onClick={() => select(key)}
          >
            {key === 'whole'
              ? 'Fit assembly'
              : key === 'coil'
                ? 'Coil'
                : key === 'tube'
                  ? 'Glass tube'
                  : 'Valve'}
          </Button>
        ))}
      </div>
      {error ? (
        <p role="alert">
          3D could not load on this device. The Equipment, Circuit and Glass
          tubes views remain available.
        </p>
      ) : ready ? (
        createElement('model-viewer', {
          ref,
          src: '/models/tu100-component-pilot.glb',
          alt: 'Illustrative coil, glass observation tube and hand valve mounted on a panel. This is not a measured reconstruction.',
          'camera-controls': true,
          'touch-action': 'pan-y',
          'camera-orbit': focuses.whole.orbit,
          'camera-target': focuses.whole.target,
          'shadow-intensity': '0.5',
          'interaction-prompt': 'none',
          'min-camera-orbit': 'auto 10deg 0.2m',
          'max-camera-orbit': 'auto 170deg 4m',
          'environment-image': 'neutral',
          exposure: '1.1',
          style: { width: '100%', height: '440px', background: '#eaf0e5' },
        })
      ) : (
        <p role="status">Loading 3D inspection…</p>
      )}
      {ready && !loaded && !error && (
        <p role="status" className="micro">
          Preparing the model…
        </p>
      )}
      <p className="micro">
        Drag to orbit · Pinch or scroll to zoom · Select a component above to
        focus. The 3D pilot does not operate the simulated valves.
      </p>
      <details>
        <summary>Why use this view?</summary>
        <p>
          Find the pipe passing through the fins. How do the fins help the coil
          exchange heat with the air? Separate coil fins, copper pipe, glass,
          fittings and valve parts can be inspected from different angles.
          Full-unit dimensions, tube positions and hidden pipe connections need
          verification before this becomes an interactive replica.
        </p>
      </details>
    </section>
  );
}
