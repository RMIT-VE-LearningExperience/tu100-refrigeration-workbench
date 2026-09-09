'use client';
/* oxlint-disable react/react-compiler, jsx-a11y/prefer-tag-over-role, next/no-img-element */
// Read browser storage after hydration. Composite live regions contain block feedback;
// local photo crops intentionally use the existing static image without a server optimizer.
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowDown,
  Check,
  CircleHelp,
  RotateCcw,
  ZoomIn,
  Scan,
  Pause,
  Play,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  emptyProgress,
  restoreProgress,
  lessonSetupMatches,
  stageReadings,
  STAGES,
  QUESTIONS,
  type StageId,
} from '@/lib/learning';
import type { simulate } from '@/lib/model';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { TemperaturePractice } from './temperature-practice';
let sessionProgress = emptyProgress();
let sessionProgressReady = false;
let sessionActivity = 'cycle';
let sessionActivityReady = false;

type Props = {
  model: ReturnType<typeof simulate>;
  refrigerant: string;
  ambient: number;
  onRestore: () => void;
  onExplore: () => void;
  onStop: () => void;
};
function CycleActivity({
  model,
  refrigerant,
  ambient,
  onRestore,
  onStop,
  onPractice,
}: Props & { onPractice: () => void }) {
  const [progress, setProgress] = useState(emptyProgress);
  const questionHeading = useRef<HTMLHeadingElement>(null);
  const feedbackRegion = useRef<HTMLDivElement>(null);
  const focusQuestion = () =>
    requestAnimationFrame(() => {
      questionHeading.current?.focus({ preventScroll: true });
      questionHeading.current?.scrollIntoView({ block: 'nearest' });
    });
  const [loaded, setLoaded] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [hint, setHint] = useState(false);
  const [closeup, setCloseup] = useState(false);
  const [motion, setMotion] = useState(true);
  useEffect(() => {
    try {
      const saved = localStorage.getItem('tu100-cycle-activity-v1');
      setProgress(
        sessionProgressReady
          ? sessionProgress
          : saved
            ? restoreProgress(saved)
            : emptyProgress(),
      );
    } catch {
      setProgress(sessionProgress);
      setStorageAvailable(false);
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    sessionProgress = progress;
    sessionProgressReady = true;
    try {
      localStorage.setItem('tu100-cycle-activity-v1', JSON.stringify(progress));
    } catch {
      setStorageAvailable(false);
    }
  }, [progress, loaded]);
  const matching = lessonSetupMatches(refrigerant, ambient, model);
  const active = matching && !!model.values;
  const stage = STAGES.find((s) => s.id === progress.selected);
  const question = QUESTIONS[progress.step];
  const start = () => {
    onRestore();
    setProgress((p) => ({
      ...p,
      started: true,
      solved: p.selected === QUESTIONS[p.step].target,
    }));
  };
  const select = (id: StageId) => {
    setCloseup(false);
    setProgress((p) => ({
      ...p,
      selected: id,
      solved: p.completed || id === QUESTIONS[p.step].target,
    }));
    if (progress.started && active && matchMedia('(max-width: 760px)').matches)
      requestAnimationFrame(() =>
        feedbackRegion.current?.scrollIntoView({ block: 'nearest' }),
      );
  };
  const next = () => {
    if (!progress.solved || !active) return;
    if (progress.step === QUESTIONS.length - 1)
      setProgress((p) => ({ ...p, completed: true }));
    else
      setProgress((p) => ({
        ...p,
        step: p.step + 1,
        selected: null,
        solved: false,
      }));
    setHint(false);
    setCloseup(false);
    focusQuestion();
  };
  const restart = () => {
    setProgress({ ...emptyProgress(), started: true });
    setHint(false);
    setCloseup(false);
    onRestore();
    focusQuestion();
  };
  const feedback =
    progress.selected && progress.started && !progress.completed && active
      ? progress.solved
        ? question.success
        : `${stage?.name}: ${stage?.action.toLowerCase()}. Try another component, or use a hint.`
      : '';
  return (
    <section className="learn" aria-label="Learn refrigeration">
      <div className="learn-heading">
        <div>
          <p className="learn-eyebrow">LEARN THE CYCLE</p>
          <h2 tabIndex={-1}>Follow the refrigerant</h2>
        </div>
        <div className="learn-session">
          <span>R134a · Cooling example</span>
          {active && (
            <Button variant="ghost" onClick={onStop}>
              <Pause size={15} /> Stop example
            </Button>
          )}
        </div>
      </div>
      <div className="learn-workspace">
        <section className="learn-question" aria-label="Current activity">
          <div className="learn-progress">
            <span>
              {progress.completed
                ? 'Activity complete'
                : `Question ${progress.step + 1} of ${QUESTIONS.length}`}
            </span>
            <span className="learn-progress-dots" aria-hidden="true">
              {QUESTIONS.map((_, i) => (
                <i
                  key={i}
                  className={
                    progress.completed || i < progress.step
                      ? 'done'
                      : i === progress.step
                        ? 'current'
                        : ''
                  }
                />
              ))}
            </span>
          </div>
          <h3 ref={questionHeading} tabIndex={-1}>
            {progress.completed
              ? 'You have followed the cycle.'
              : question.prompt}
          </h3>
          <p>
            {progress.completed
              ? 'Absorb heat, compress the vapour, release heat, then lower the pressure. Keep exploring the four components.'
              : progress.started
                ? 'Select a component on the unit or in the cycle below.'
                : 'Start the example, then select a component to see what it does.'}
          </p>
          {!progress.started && (
            <Button className="learn-primary" onClick={start}>
              <Play size={17} /> Start activity
            </Button>
          )}
          {progress.started && !active && (
            <div className="learn-recovery" role="status">
              <p>
                {!matching
                  ? 'The setup has changed. This activity uses R134a at 25°C with the cooling TXV circuit.'
                  : 'The example is stopped. Resume to use its readings and continue.'}
              </p>
              <Button className="learn-primary" onClick={onRestore}>
                {matching ? 'Resume activity' : 'Restore activity setup'}{' '}
                <ArrowRight size={16} />
              </Button>
              <small>Your place is kept.</small>
            </div>
          )}
          <div ref={feedbackRegion} className="learn-feedback" role="status">
            {feedback && (
              <p className={progress.solved ? 'is-correct' : ''}>
                {progress.solved && <Check size={18} />}
                {feedback}
              </p>
            )}
            {hint && !progress.solved && !progress.completed && (
              <p>{question.hint}</p>
            )}
          </div>
          {progress.started && !progress.completed && active && (
            <div className="learn-question-actions">
              {progress.solved ? (
                <Button className="learn-primary" onClick={next}>
                  {progress.step === QUESTIONS.length - 1
                    ? 'Finish activity'
                    : 'Next question'}{' '}
                  <ArrowRight size={17} />
                </Button>
              ) : (
                <Button variant="link" onClick={() => setHint(!hint)}>
                  <CircleHelp size={17} />{' '}
                  {hint ? 'Hide hint' : 'Give me a hint'}
                </Button>
              )}
            </div>
          )}
          {progress.completed && (
            <Button className="learn-primary" onClick={onPractice}>
              Try temperature practice <ArrowRight size={17} />
            </Button>
          )}
          {progress.started && progress.step > 0 && !progress.completed && (
            <Button
              variant="link"
              className="learn-back"
              onClick={() => {
                setProgress((p) => ({
                  ...p,
                  step: p.step - 1,
                  selected: null,
                  solved: false,
                }));
                setHint(false);
                setCloseup(false);
                focusQuestion();
              }}
            >
              Previous question
            </Button>
          )}
        </section>
        <div className="learn-visual">
          <div
            className={
              'learn-photo-window ' + (closeup && stage ? 'is-closeup' : '')
            }
          >
            <div className="learn-photo-toolbar">
              <span>
                {closeup && stage ? stage.name : 'The RMIT training unit'}
              </span>
              <Button
                variant="outline"
                disabled={!stage}
                aria-pressed={closeup}
                onClick={() => setCloseup(!closeup)}
              >
                {closeup ? <Scan size={16} /> : <ZoomIn size={16} />}
                {closeup ? 'Whole unit' : 'Look closer'}
              </Button>
            </div>
            <div className="learn-photo-frame">
              {closeup && stage ? (
                <div
                  className="learn-photo-crop"
                  style={{
                    aspectRatio: `${stage.photo.width * 2400} / ${stage.photo.height * 3800}`,
                    width: `min(100%, calc(var(--learn-photo-height) * ${(stage.photo.width * 2400) / (stage.photo.height * 3800)}))`,
                  }}
                >
                  <img
                    src="/assets/trainer.jpg"
                    alt={`${stage.name}, ${stage.location}, on the RMIT TU-100`}
                    draggable={false}
                    style={{
                      width: `${10000 / stage.photo.width}%`,
                      left: `${(-stage.photo.x * 100) / stage.photo.width}%`,
                      top: `${(-stage.photo.y * 100) / stage.photo.height}%`,
                    }}
                  />
                </div>
              ) : (
                <div className="learn-photo-unit">
                  <img
                    src="/assets/trainer.jpg"
                    alt="RMIT TU-100: upper evaporator coil, lower condenser coil, expansion valve at the upper right and compressor at the bottom right in cooling mode."
                    draggable={false}
                  />
                  {STAGES.map((s, i) => (
                    <Button
                      key={s.id}
                      variant="outline"
                      className={
                        'learn-photo-pin ' +
                        (s.id === progress.selected ? 'is-selected' : '')
                      }
                      style={{ left: `${s.x}%`, top: `${s.y}%` }}
                      aria-label={`Select ${s.name}`}
                      aria-pressed={s.id === progress.selected}
                      onClick={() => select(s.id)}
                    >
                      {i + 1}
                    </Button>
                  ))}
                </div>
              )}
            </div>
            <div className="learn-photo-caption">
              {stage ? (
                <>
                  <strong>{stage.name}</strong>
                  <span>{stage.location}</span>
                </>
              ) : (
                <span>Select one of the four numbered components.</span>
              )}
            </div>
          </div>
          <nav
            className="learn-cycle"
            aria-label="Refrigerant cycle components"
          >
            {STAGES.map((s, i) => (
              <div className="learn-cycle-item" key={s.id}>
                <Button
                  variant="ghost"
                  aria-pressed={s.id === progress.selected}
                  onClick={() => select(s.id)}
                >
                  <span className="learn-cycle-number">{i + 1}</span>
                  <span>{s.name}</span>
                </Button>
                {i < 3 && <ArrowRight size={15} aria-hidden="true" />}
              </div>
            ))}
          </nav>
          <p className="learn-cycle-return">
            <RotateCcw size={13} aria-hidden="true" /> Simplified cycle ·
            evaporator → compressor
          </p>
        </div>
        <section className="learn-context" aria-label="Component explanation">
          {stage ? (
            <>
              <div className="learn-stage-heading">
                <span className="learn-eyebrow">{stage.action}</span>
                <h4>{stage.name}</h4>
              </div>
              <p className="learn-description">{stage.description}</p>
              <div
                className={
                  'learn-phase ' + (active && motion ? 'is-moving' : '')
                }
                aria-label={`${stage.name}: ${stage.phase}. ${stage.heat}. Illustrative phase view.`}
              >
                <div className="learn-phase-label">
                  <span>{stage.phase.split(' → ')[0]}</span>
                  <ArrowRight size={18} />
                  <span>{stage.phase.split(' → ')[1]}</span>
                </div>
                <div className="learn-flow" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <span className={'learn-heat ' + stage.id}>
                  {stage.id === 'evaporator' ? (
                    <ArrowDown size={17} />
                  ) : stage.id === 'condenser' ? (
                    <ArrowRight size={17} />
                  ) : null}
                  {stage.heat}
                </span>
              </div>
              <div className="learn-phase-note">
                <span>Illustrative direction · calculated readings</span>
                <Button
                  variant="ghost"
                  aria-label={
                    motion ? 'Pause flow animation' : 'Play flow animation'
                  }
                  onClick={() => setMotion(!motion)}
                >
                  {motion ? <Pause size={14} /> : <Play size={14} />}
                </Button>
              </div>
              {progress.started && (
                <dl className="learn-readings">
                  {stageReadings(
                    stage.id,
                    active ? model : { ...model, values: null },
                  ).map((reading) => (
                    <div key={reading.label}>
                      <dt>{reading.label}</dt>
                      <dd>
                        {reading.value === undefined
                          ? '—'
                          : reading.value.toFixed(1)}{' '}
                        <small>{reading.unit}</small>
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </>
          ) : (
            <div className="learn-empty">
              <span className="learn-empty-number">01 → 04</span>
              <p>
                Find a part. See its role.
                <br />
                Follow what happens next.
              </p>
            </div>
          )}
          <div className="learn-activity-tools">
            {progress.started && (
              <Button variant="link" onClick={restart}>
                <RotateCcw size={14} /> Restart activity
              </Button>
            )}
            <span>
              {storageAvailable
                ? 'Progress saved on this device'
                : 'Progress available for this session'}
            </span>
          </div>
        </section>
      </div>
    </section>
  );
}

export function LearningWorkspace(props: Props) {
  const activityRoot = useRef<HTMLDivElement>(null);
  const [activity, setActivity] = useState('cycle');
  useEffect(() => {
    try {
      const stored = localStorage.getItem('tu100-learning-activity');
      setActivity(
        sessionActivityReady
          ? sessionActivity
          : ['cycle', 'superheat', 'subcooling'].includes(stored ?? '')
            ? stored!
            : sessionActivity,
      );
    } catch {
      setActivity(sessionActivity);
    }
  }, []);
  const choose = (next: string) => {
    setActivity(next);
    sessionActivity = next;
    sessionActivityReady = true;
    requestAnimationFrame(() => {
      const heading =
        activityRoot.current?.querySelector<HTMLHeadingElement>('.learn h2');
      heading?.focus({ preventScroll: true });
      heading?.scrollIntoView({ block: 'nearest' });
    });
    try {
      localStorage.setItem('tu100-learning-activity', next);
    } catch {}
  };
  return (
    <div ref={activityRoot}>
      <div className="learn-pickerbar">
        <label htmlFor="learning-activity">Activity</label>
        <NativeSelect
          id="learning-activity"
          value={activity}
          onChange={(event) => choose(event.target.value)}
        >
          <NativeSelectOption value="cycle">
            Follow the refrigerant
          </NativeSelectOption>
          <NativeSelectOption value="superheat">
            Practise superheat
          </NativeSelectOption>
          <NativeSelectOption value="subcooling">
            Practise subcooling
          </NativeSelectOption>
        </NativeSelect>
      </div>
      {activity === 'cycle' ? (
        <CycleActivity {...props} onPractice={() => choose('superheat')} />
      ) : (
        <TemperaturePractice
          {...props}
          key={activity}
          kind={activity === 'superheat' ? 'superheat' : 'subcooling'}
          onNext={() =>
            activity === 'superheat' ? choose('subcooling') : choose('cycle')
          }
        />
      )}
    </div>
  );
}
