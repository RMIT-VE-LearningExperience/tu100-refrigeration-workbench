'use client';
import { useEffect, useRef } from 'react';
import { ArrowRight, Check, LocateFixed, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MACHINE_STEPS, type MachineProgress } from '@/lib/machine-tutorial';
import { TutorialSpotlight } from './tutorial-spotlight';

export function MachineTutorial({
  progress,
  instruction,
  feedback,
  done,
  targets,
  embedded = false,
  onNext,
  onBack,
  onSkip,
  onClose,
  onReveal,
  onRecover,
  onPractical,
}: {
  progress: MachineProgress;
  instruction: string;
  feedback?: string;
  done: boolean;
  targets: string[];
  embedded?: boolean;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onClose: () => void;
  onReveal: () => void;
  onRecover?: () => void;
  onPractical: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const panel = useRef<HTMLElement>(null);
  const selector = targets.join(', ');
  const complete = progress.step >= MACHINE_STEPS.length;
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [progress.step]);
  useEffect(() => {
    if (embedded) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) onClose();
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [embedded, onClose]);
  useEffect(() => {
    const header = document.querySelector<HTMLElement>('.calm-header');
    const root = document.querySelector<HTMLElement>('main.calm');
    if (!header || !root || !panel.current || embedded) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      root.style.setProperty(
        '--machine-header-height',
        `${header.offsetHeight}px`,
      );
      root.style.setProperty(
        '--machine-coach-height',
        `${panel.current?.offsetHeight ?? 0}px`,
      );
    };
    const observer = new ResizeObserver(() => {
      if (!frame) frame = requestAnimationFrame(measure);
    });
    observer.observe(header);
    observer.observe(panel.current);
    measure();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [embedded]);
  return (
    <section
      ref={panel}
      className={'machine-coach ' + (embedded ? 'is-embedded' : 'is-workspace')}
      aria-label="Guided machine tutorial"
    >
      <TutorialSpotlight
        panel={panel}
        selector={selector}
        embedded={embedded}
        step={progress.step}
        enabled={!complete}
      />
      <div className="machine-coach-copy">
        <p className="machine-coach-progress">
          <span className="machine-ring-key" aria-hidden="true" />
          {complete
            ? 'Walkthrough complete'
            : `Machine tutorial · ${progress.step + 1} of ${MACHINE_STEPS.length}`}
        </p>
        <h2 ref={heading} tabIndex={-1}>
          {complete ? 'Ready to keep exploring' : MACHINE_STEPS[progress.step]}
        </h2>
        <p>
          {complete
            ? 'The example is stopped. At the real unit, follow your teacher’s operating procedure and record the measured readings.'
            : instruction}
        </p>
        <output className="machine-feedback">
          {complete ? (
            progress.skipped.length ? (
              `${progress.skipped.length} step${progress.skipped.length === 1 ? '' : 's'} skipped. You can replay the tutorial any time.`
            ) : (
              'You practised inspection, setup, operation and reading the model.'
            )
          ) : feedback ? (
            <>
              <Check size={15} aria-hidden="true" />
              {feedback}
            </>
          ) : (
            'The amber ring marks the next control.'
          )}
        </output>
      </div>
      <div className="machine-coach-actions">
        {complete ? (
          <>
            <Button onClick={onPractical}>
              At the unit <ArrowRight size={16} />
            </Button>
            <Button variant="outline" onClick={onClose}>
              Explore on my own
            </Button>
          </>
        ) : (
          <>
            <Button onClick={done ? onNext : onReveal}>
              {done ? (
                <>
                  {progress.step === MACHINE_STEPS.length - 1
                    ? 'Finish tutorial'
                    : 'Next step'}{' '}
                  <ArrowRight size={16} />
                </>
              ) : (
                <>
                  <LocateFixed size={16} /> Show the control
                </>
              )}
            </Button>
            <div className="machine-secondary-actions">
              {progress.step > 0 && (
                <Button variant="ghost" onClick={onBack}>
                  Back
                </Button>
              )}
              <Button variant="ghost" onClick={onSkip}>
                Skip step
              </Button>
            </div>
            {onRecover && (
              <button className="machine-recover" onClick={onRecover}>
                Restore tutorial example
              </button>
            )}
          </>
        )}
      </div>
      <Button
        variant="ghost"
        className="machine-exit"
        onClick={onClose}
        aria-label="Exit machine tutorial"
      >
        <X size={18} />
      </Button>
    </section>
  );
}
