'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { clusterMarkers } from '@/lib/markers';
import { VALVE_NAMES, type Valve } from '@/lib/model';
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
  focusRequest,
  inspected,
}: {
  valves: Record<Valve, boolean>;
  selected: Valve | null;
  onSelect: (v: Valve) => void;
  hotspots: boolean;
  onToggleHotspots: () => void;
  mode?: string;
  focusRequest: number;
  inspected: boolean;
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
  function scale(next: number, target?: [number, number], focusId?: string) {
    const el = viewport.current;
    if (!el) return;
    const oldWidth = fit.width * zoom,
      oldHeight = fit.height * zoom;
    const point = target || (selected && pins[selected]);
    const cx = point
      ? point[0] / 100
      : (el.scrollLeft +
          el.clientWidth / 2 -
          Math.max(0, (el.clientWidth - oldWidth) / 2)) /
        oldWidth;
    const cy = point
      ? point[1] / 100
      : (el.scrollTop +
          el.clientHeight / 2 -
          Math.max(0, (el.clientHeight - oldHeight) / 2)) /
        oldHeight;
    setZoom(next);
    requestAnimationFrame(() => {
      el.scrollTo({
        left:
          Math.max(0, (el.clientWidth - fit.width * next) / 2) +
          cx * fit.width * next -
          el.clientWidth / 2,
        top:
          Math.max(0, (el.clientHeight - fit.height * next) / 2) +
          cy * fit.height * next -
          el.clientHeight / 2,
        behavior: 'instant',
      });
      if (focusId)
        el.querySelector<HTMLButtonElement>(`[data-valve="${focusId}"]`)?.focus(
          { preventScroll: true },
        );
    });
  }
  useEffect(() => {
    if (focusRequest && selected && pins[selected]) scale(3, pins[selected]);
  }, [focusRequest]);
  const targets = Object.entries(pins)
    .filter(([id]) => hotspots || id.startsWith('HP') || id === selected)
    .map(([id, [x, y]]) => ({ id, x, y }));
  const clusters = clusterMarkers(targets, fit.width * zoom, fit.height * zoom);
  return (
    <>
      {!inspected && (
        <p className="equipment-instruction">
          Select a marked component to inspect it.
        </p>
      )}
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
            disabled={zoom >= 6}
            onClick={() => scale(Math.min(6, zoom + 0.5))}
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
            {clusters.map((group) =>
              group.members.length > 1 ? (
                <button
                  key={group.members.map((p) => p.id).join('-')}
                  className={
                    'component-marker marker-group ' +
                    (group.members.some((p) => p.id === selected)
                      ? 'is-selected'
                      : '')
                  }
                  style={{ left: `${group.x}%`, top: `${group.y}%` }}
                  aria-label={`Zoom to ${group.members.map((p) => p.id).join(', ')}`}
                  onClick={() =>
                    scale(
                      Math.min(6, zoom + 1),
                      [group.x, group.y],
                      group.members[0].id,
                    )
                  }
                >
                  <span className="marker-dot">{group.members.length}</span>
                  <span className="marker-caption">
                    {group.members.every((p) => p.id.startsWith('HP'))
                      ? 'Reversing valves'
                      : 'Valve group'}
                  </span>
                  <span className="marker-tooltip">
                    Zoom in to select a valve
                  </span>
                </button>
              ) : (
                group.members.map(({ id, x, y }) => (
                  <button
                    key={id}
                    data-valve={id}
                    className={
                      'component-marker ' +
                      (selected === id ? 'is-selected ' : '') +
                      (hotspots ? 'show-label' : '')
                    }
                    style={{ left: `${x}%`, top: `${y}%` }}
                    onClick={() => onSelect(id as Valve)}
                    aria-label={`Inspect ${id}, ${valves[id as Valve] ? 'open' : 'closed'}`}
                    aria-pressed={selected === id}
                  >
                    <span className="marker-dot" />
                    <span className="marker-caption">{id}</span>
                    <span className="marker-tooltip">
                      {id} · {VALVE_NAMES[id as Valve]}
                    </span>
                  </button>
                ))
              ),
            )}
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
