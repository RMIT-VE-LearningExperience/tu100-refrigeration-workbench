'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { type Valve } from '@/lib/model';
const pins: Partial<Record<Valve, [number, number]>> = {
  CTV: [61.8, 28.7],
  TXV: [85.5, 28.7],
  HP1: [73.8, 44],
  HP2: [85.5, 44],
  HP3: [73.8, 50.3],
  HP4: [85.5, 50.3],
  ACI: [61.8, 66.5],
  ACO: [85.5, 66.5],
  ACB: [85.5, 60.5],
  LRI: [38, 89.5],
  LRK: [44, 89.5],
};
export function Equipment({
  valves,
  selected,
  onSelect,
  hotspots,
  onToggleHotspots,
  mode,
}: {
  valves: Record<Valve, boolean>;
  selected: Valve | null;
  onSelect: (v: Valve) => void;
  hotspots: boolean;
  onToggleHotspots: () => void;
  mode?: string;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState({ width: 340, height: 538 });
  const drag = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const width = Math.min(
        el.clientWidth - 16,
        ((el.clientHeight - 16) * 2400) / 3800,
      );
      setFit({ width, height: (width * 3800) / 2400 });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  function scale(next: number) {
    const el = viewport.current;
    if (!el) return;
    const point = selected && pins[selected];
    const cx = point
      ? point[0] / 100
      : (el.scrollLeft + el.clientWidth / 2) /
        Math.max(fit.width * zoom, el.clientWidth);
    const cy = point
      ? point[1] / 100
      : (el.scrollTop + el.clientHeight / 2) /
        Math.max(fit.height * zoom, el.clientHeight);
    setZoom(next);
    requestAnimationFrame(() =>
      el.scrollTo({
        left: cx * fit.width * next - el.clientWidth / 2,
        top: cy * fit.height * next - el.clientHeight / 2,
        behavior: 'instant',
      }),
    );
  }
  return (
    <>
      <div className="zoom-toolbar">
        <Button
          variant="ghost"
          aria-pressed={hotspots}
          onClick={onToggleHotspots}
        >
          Labels {hotspots ? 'on' : 'off'}
        </Button>
        <div>
          <Button
            variant="ghost"
            disabled={zoom <= 1}
            onClick={() => scale(Math.max(1, zoom - 0.5))}
            aria-label="Zoom out"
          >
            −
          </Button>
          <output aria-live="polite">{Math.round(zoom * 100)}%</output>
          <Button
            variant="ghost"
            disabled={zoom >= 3}
            onClick={() => scale(Math.min(3, zoom + 0.5))}
            aria-label="Zoom in"
          >
            +
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setZoom(1);
              viewport.current?.scrollTo(0, 0);
            }}
          >
            Fit
          </Button>
        </div>
      </div>
      <div
        ref={viewport}
        className="equipment-canvas"
        tabIndex={0}
        role="region"
        aria-label="Trainer photo. Use zoom buttons, then drag or scroll to pan."
        onPointerDown={(e) => {
          if (
            e.pointerType !== 'mouse' ||
            (e.target as HTMLElement).closest('button')
          )
            return;
          drag.current = {
            x: e.clientX,
            y: e.clientY,
            left: e.currentTarget.scrollLeft,
            top: e.currentTarget.scrollTop,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d) {
            e.currentTarget.scrollLeft = d.left - (e.clientX - d.x);
            e.currentTarget.scrollTop = d.top - (e.clientY - d.y);
          }
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <div
          className="equipment-surface"
          style={{
            width: Math.max(fit.width * zoom, fit.width),
            minWidth: '100%',
            minHeight: '100%',
          }}
        >
          <div
            className="equipment-photo"
            style={{ width: fit.width * zoom, height: fit.height * zoom }}
          >
            <img
              draggable={false}
              src="/assets/trainer.jpg"
              alt="RMIT Imperial TU-100 refrigeration training unit"
            />
            {Object.entries(pins)
              .filter(([key]) => hotspots || key === selected)
              .map(([key, [x, y]]) => (
                <button
                  key={key}
                  className={
                    'pin ' +
                    (valves[key as Valve] ? 'open ' : '') +
                    (selected === key ? 'selected' : '')
                  }
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    ...(key === 'LRI'
                      ? { transform: 'translate(-100%, -50%)' }
                      : key === 'LRK'
                        ? { transform: 'translate(0, -50%)' }
                        : {}),
                  }}
                  onClick={() => onSelect(key as Valve)}
                  aria-label={`Inspect ${key}, ${valves[key as Valve] ? 'open' : 'closed'}`}
                  aria-pressed={selected === key}
                >
                  {key}
                </button>
              ))}
            {hotspots && (
              <>
                <span className="coil-label top-coil">
                  {mode
                    ? mode === 'Cooling'
                      ? 'EVAPORATOR'
                      : 'CONDENSER'
                    : 'UPPER COIL'}
                </span>
                <span className="coil-label bottom-coil">
                  {mode
                    ? mode === 'Cooling'
                      ? 'CONDENSER'
                      : 'EVAPORATOR'
                    : 'LOWER COIL'}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      <p className="photo-caption">
        RMIT unit · Photo reference · Scroll or drag to pan when enlarged
      </p>
    </>
  );
}
