'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
export const TOUR_STEPS = [
  {
    title: 'Begin with a working circuit',
    body: 'Operating setup holds the refrigerant, temperature and valve configuration. Load the R134a cooling example to begin.',
    target: '.calm-setup-link',
    action: 'Load example',
  },
  {
    title: 'Run the simulation',
    body: 'Press the highlighted Run button. The pressures and temperatures will show the calculated steady state.',
    target: '.calm-run',
    action: 'Next',
  },
  {
    title: 'Find and inspect HP1',
    body: 'Select the reversing-valve group to zoom in, then select HP1. Inspection does not operate the valve.',
    target: '[data-valve="HP1"], .marker-group',
    action: 'Next',
  },
  {
    title: 'Your selected component',
    body: 'This control opens or closes HP1. Changing a valve stops the simulation. Leave it open for this walkthrough; Zoom to component helps you inspect it.',
    target: '.calm-valve-action',
    action: 'Next',
  },
  {
    title: 'Change your view',
    body: 'Choose Glass tubes from this selector to see the refrigerant states.',
    target: '#view',
    action: 'Next',
  },
  {
    title: 'Connect phase and measurements',
    body: 'At the evaporator inlet, the model shows a liquid–vapour mixture. Read its pressure and temperature below the tube. Bubbles are illustrative, not measured flow.',
    target: '.tube-values',
    action: 'Try a calculation',
  },
  {
    title: 'Use the readings',
    body: 'Enter the temperature difference in each white field, then select Check answers. The subtraction is shown beside each field.',
    target: '.calm-exercise',
    action: 'Finish tutorial',
  },
] as const;
export function GuidedTour({
  step,
  canAdvance,
  onNext,
  onBack,
  onClose,
}: {
  step: number;
  canAdvance: boolean;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const [box, setBox] = useState<DOMRect | null>(null);
  const [size, setSize] = useState({ width: 1200, height: 800 });
  const card = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(240);
  const s = TOUR_STEPS[step];
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [onClose]);
  useLayoutEffect(() => {
    let frame = 0;
    let last = '';
    let scrolled = false;
    const update = () => {
      const targets = [...document.querySelectorAll<HTMLElement>(s.target)];
      const el = targets.find(
        (e) =>
          e.getBoundingClientRect().width > 0 &&
          e.getBoundingClientRect().height > 0,
      );
      if (el) {
        const raw = el.getBoundingClientRect();
        let left = Math.max(0, raw.left),
          top = Math.max(0, raw.top),
          right = Math.min(innerWidth, raw.right),
          bottom = Math.min(innerHeight, raw.bottom);
        for (
          let parent = el.parentElement;
          parent;
          parent = parent.parentElement
        ) {
          const style = getComputedStyle(parent);
          const clip = parent.getBoundingClientRect();
          if (/auto|scroll|hidden|clip/.test(style.overflowY)) {
            top = Math.max(top, clip.top);
            bottom = Math.min(bottom, clip.bottom);
          }
          if (/auto|scroll|hidden|clip/.test(style.overflowX)) {
            left = Math.max(left, clip.left);
            right = Math.min(right, clip.right);
          }
        }
        const rect = new DOMRect(
          left,
          top,
          Math.max(0, right - left),
          Math.max(0, bottom - top),
        );
        if (!scrolled) {
          el.scrollIntoView({
            block: 'nearest',
            inline: 'nearest',
            behavior: 'instant',
          });
          scrolled = true;
        }
        const key = [
          rect.x,
          rect.y,
          rect.width,
          rect.height,
          innerWidth,
          innerHeight,
        ]
          .map((n) => Math.round(n))
          .join(',');
        if (key !== last) {
          last = key;
          setBox(rect);
          setSize({ width: innerWidth, height: innerHeight });
        }
      } else setBox(null);
      frame = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(frame);
  }, [s.target, step]);
  useLayoutEffect(() => {
    const el = card.current;
    if (!el) return;
    const observer = new ResizeObserver(() =>
      setHeight(el.getBoundingClientRect().height),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    card.current?.focus({ preventScroll: true });
  }, [step]);
  if (typeof document === 'undefined') return null;
  const width = Math.min(340, size.width - 24),
    pad = 12;
  let left = box
    ? Math.min(size.width - width - pad, Math.max(pad, box.left))
    : pad;
  let top = box ? box.bottom + 16 : 90;
  if (box && top + height > size.height - pad) {
    if (box.top - height - 16 >= 72) top = box.top - height - 16;
    else if (box.left - width - 20 >= pad) {
      left = box.left - width - 20;
      top = Math.max(80, Math.min(size.height - height - pad, box.top));
    } else {
      top = 76;
      left = pad;
    }
  }
  if (box && step === 6 && size.width > 760) {
    left = Math.max(pad, box.left - width - 20);
    top = Math.max(80, Math.min(size.height - height - pad, box.top));
  }
  if (size.width <= 760 && [0, 3, 6].includes(step)) {
    top = 76;
    left = 12;
  }
  top = Math.max(pad, Math.min(top, size.height - height - pad));
  return createPortal(
    <div className="guided-overlay">
      {box && (
        <div
          className="guided-spotlight"
          aria-hidden="true"
          style={{
            left: Math.max(2, box.left - 6),
            top: Math.max(2, box.top - 6),
            width: box.width + 12,
            height: box.height + 12,
          }}
        />
      )}
      <section
        ref={card}
        tabIndex={-1}
        className="guided-coach"
        aria-label="Guided tutorial"
        style={{ left, top, width }}
      >
        <div className="guided-coach-progress">
          <span>
            STEP {step + 1} OF {TOUR_STEPS.length}
          </span>
          <button onClick={onClose} aria-label="Close tutorial">
            ×
          </button>
        </div>
        <div aria-live="polite">
          <h2>{s.title}</h2>
          <p>{s.body}</p>
        </div>
        {!canAdvance && (
          <p className="guided-wait">
            {step === 1
              ? 'Press Run to continue.'
              : step === 2
                ? 'Select HP1 to continue.'
                : step === 4
                  ? 'Choose Glass tubes to continue.'
                  : 'Check both answers to finish.'}
          </p>
        )}
        {!canAdvance && (
          <button
            className="guided-focus"
            onClick={() => {
              const selector = step === 6 ? '.calm-exercise input' : s.target;
              document
                .querySelector<HTMLElement>(selector)
                ?.focus({ preventScroll: true });
            }}
          >
            Go to highlighted control
          </button>
        )}
        <div className="guided-coach-actions">
          <Button variant="ghost" disabled={step === 0} onClick={onBack}>
            Back
          </Button>
          <Button disabled={!canAdvance} onClick={onNext}>
            {s.action}
          </Button>
        </div>
        <button className="guided-skip" onClick={onClose}>
          Skip tutorial
        </button>
      </section>
    </div>,
    document.body,
  );
}
