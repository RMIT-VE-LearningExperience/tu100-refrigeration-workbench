'use client';
/* oxlint-disable react/react-compiler, jsx-a11y/prefer-tag-over-role */
// Restore device-local answers after hydration. The HTML temperature diagram and
// multi-paragraph live feedback require composite accessible regions.
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, CircleHelp, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { lessonSetupMatches } from '@/lib/learning';
import { ReadingReference } from './practical-reference';
import type { simulate } from '@/lib/model';
type Kind = 'superheat' | 'subcooling';
const sessionAnswers: Partial<Record<Kind, string>> = {};
export function clearPracticeAnswers() {
  delete sessionAnswers.superheat;
  delete sessionAnswers.subcooling;
  try {
    localStorage.removeItem('tu100-answer-superheat');
    localStorage.removeItem('tu100-answer-subcooling');
  } catch {}
}
export function TemperaturePractice({
  model,
  refrigerant,
  ambient,
  kind,
  onRestore,
  onNext,
}: {
  model: ReturnType<typeof simulate>;
  refrigerant: string;
  ambient: number;
  kind: Kind;
  onRestore: () => void;
  onNext: () => void;
}) {
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);
  const [hint, setHint] = useState(false);
  const [worked, setWorked] = useState(false);
  const [independent, setIndependent] = useState(false);
  const [pair, setPair] = useState<string[]>([]);
  const [pairChecked, setPairChecked] = useState(false);
  const taskHeading = useRef<HTMLHeadingElement>(null);
  const focusTask = () =>
    requestAnimationFrame(() => {
      taskHeading.current?.focus({ preventScroll: true });
      taskHeading.current?.scrollIntoView({ block: 'nearest' });
    });
  useEffect(() => {
    try {
      const saved = localStorage.getItem('tu100-answer-' + kind);
      setAnswer(sessionAnswers[kind] ?? saved ?? '');
    } catch {
      setAnswer(sessionAnswers[kind] ?? '');
    }
  }, [kind]);
  const matching = lessonSetupMatches(refrigerant, ambient, model);
  const active = independent || (matching && !!model.values);
  const v = active ? model.values : null;
  const sh = kind === 'superheat';
  const name = sh ? 'Superheat' : 'Subcooling';
  const upper = independent ? (sh ? 18 : 40) : sh ? v?.Teo : v?.Tbubble;
  const lower = independent ? (sh ? 10 : 33) : sh ? v?.Tevap : v?.Tco;
  const expected =
    upper === undefined || lower === undefined ? undefined : upper - lower;
  const correct =
    checked &&
    answer.trim() !== '' &&
    expected !== undefined &&
    Number.isFinite(Number(answer)) &&
    Math.abs(Number(answer) - expected) < 0.11;
  const requiredPair = sh
    ? ['Evaporator outlet', 'Evaporator dew point']
    : ['Condenser outlet', 'Condenser bubble point'];
  const pairCorrect =
    pairChecked &&
    pair.length === 2 &&
    requiredPair.every((label) => pair.includes(label));
  const upperLabel = sh ? 'Evaporator outlet' : 'Condenser bubble point';
  const lowerLabel = sh ? 'Evaporator dew point' : 'Condenser outlet';
  const format = (n: number | undefined) =>
    n === undefined ? '—' : n.toFixed(1);
  const meaning = sh
    ? 'The outlet vapour is above the evaporator dew point.'
    : 'The outlet liquid is below the condenser bubble point.';
  return (
    <section className="learn learn-practice" aria-label={`${name} practice`}>
      <div className="learn-heading">
        <div>
          <p className="learn-eyebrow">TEMPERATURE PRACTICE</p>
          <h2 tabIndex={-1}>Choose the readings. Find the gap.</h2>
        </div>
        <span className="learn-session">
          {independent
            ? 'New teaching example · not live readings'
            : 'R134a · Supported cooling example'}
        </span>
      </div>
      <div className="learn-practice-grid">
        <div
          className="learn-gap-visual"
          role="img"
          aria-label={
            active
              ? `${upperLabel} ${format(upper)} degrees Celsius. ${lowerLabel} ${format(lower)} degrees Celsius. Find the difference in kelvin.`
              : 'Start the example to display the two temperatures.'
          }
        >
          <p>{sh ? 'Evaporator · upper coil' : 'Condenser · lower coil'}</p>
          <div className="learn-temperature-gap">
            <div className="learn-temperature-line" aria-hidden="true" />
            <div className="learn-temperature-point upper">
              <i aria-hidden="true" />
              <div>
                <strong>
                  {format(upper)}
                  <small>°C</small>
                </strong>
                <span>{upperLabel}</span>
              </div>
            </div>
            <div className="learn-gap-value">
              {active && (correct || worked) ? `${format(expected)} K` : '? K'}
              <span>temperature difference</span>
            </div>
            <div className="learn-temperature-point lower">
              <i aria-hidden="true" />
              <div>
                <strong>
                  {format(lower)}
                  <small>°C</small>
                </strong>
                <span>{lowerLabel}</span>
              </div>
            </div>
          </div>
          <small>
            {independent
              ? 'Separate arithmetic example · outlet and saturation temperatures supplied'
              : 'Calculated teaching values'}
          </small>
        </div>
        <section className="learn-practice-question">
          <p className="learn-eyebrow">{name}</p>
          <h3 ref={taskHeading} tabIndex={-1}>
            {pairCorrect
              ? 'How big is the gap?'
              : 'Which two readings do you need?'}
          </h3>
          <p>
            {sh
              ? 'Compare the outlet vapour with the evaporator dew point.'
              : 'Compare the liquid outlet with the condenser bubble point.'}
          </p>
          <details className="reading-help">
            <summary>Where do these readings come from?</summary>
            <ReadingReference kind={kind} />
          </details>
          {!active ? (
            <div className="learn-recovery">
              <p>
                {matching
                  ? 'Start the cooling example to see the two temperatures.'
                  : 'This practice uses R134a at 25°C with the cooling TXV circuit. Restore it to continue.'}
              </p>
              <Button className="learn-primary" onClick={onRestore}>
                <Play size={16} />{' '}
                {matching ? 'Start example' : 'Restore practice setup'}
              </Button>
              <small>Your answer is kept.</small>
            </div>
          ) : !pairCorrect ? (
            <div className="reading-selection">
              <p>Select two readings for {name.toLowerCase()}.</p>
              {[
                'Evaporator outlet',
                'Condenser bubble point',
                'Condenser outlet',
                'Evaporator dew point',
              ].map((label) => (
                <Button
                  key={label}
                  variant="outline"
                  aria-pressed={pair.includes(label)}
                  onClick={() => {
                    setPair((previous) =>
                      previous.includes(label)
                        ? previous.filter((p) => p !== label)
                        : [...previous, label],
                    );
                    setPairChecked(false);
                  }}
                >
                  {label}
                </Button>
              ))}
              <Button
                className="learn-primary"
                onClick={() => {
                  setPairChecked(true);
                  if (
                    pair.length === 2 &&
                    requiredPair.every((label) => pair.includes(label))
                  )
                    focusTask();
                }}
              >
                Check my readings
              </Button>
              <div role="status" className="student-feedback">
                {pairChecked &&
                  !pairCorrect &&
                  (pair.length !== 2
                    ? 'Choose exactly two readings: an outlet temperature and its saturation reference.'
                    : sh
                      ? 'Use the evaporator outlet and evaporator dew point. Condenser readings describe the other coil.'
                      : 'Use the condenser outlet and condenser bubble point. Evaporator readings describe the other coil.')}
              </div>
            </div>
          ) : (
            <>
              <p className="selected-reading-pair" role="status">
                Readings selected: {requiredPair.join(' and ')}
              </p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setChecked(true);
                }}
                noValidate
              >
                <label htmlFor="practice-answer">{name} (K)</label>
                <Input
                  id="practice-answer"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={answer}
                  placeholder="Enter the difference"
                  aria-invalid={checked && !correct}
                  aria-describedby="practice-feedback practice-units"
                  onChange={(event) => {
                    setAnswer(event.target.value);
                    if (!independent) sessionAnswers[kind] = event.target.value;
                    try {
                      if (!independent)
                        localStorage.setItem(
                          'tu100-answer-' + kind,
                          event.target.value,
                        );
                    } catch {}
                    setChecked(false);
                    setWorked(false);
                  }}
                />
                <Button type="submit" className="learn-primary">
                  Check answer
                </Button>
              </form>
              <div
                id="practice-feedback"
                className="learn-feedback"
                role="status"
              >
                {checked && (
                  <p className={correct ? 'is-correct' : ''}>
                    {correct ? (
                      <>
                        <Check size={17} />
                        Correct — {format(expected)} K. {meaning}
                      </>
                    ) : answer.trim() === '' ? (
                      'Enter the temperature difference, or use a hint.'
                    ) : (
                      `Try ${format(upper)} − ${format(lower)}. Enter the difference, rather than either temperature.`
                    )}
                  </p>
                )}
                {hint && !worked && !correct && (
                  <p>
                    Subtract the lower temperature from the higher:{' '}
                    {format(upper)} − {format(lower)} = ? K.
                  </p>
                )}
                {worked && (
                  <p>
                    {format(upper)} − {format(lower)} = {format(expected)} K.{' '}
                    {meaning}
                  </p>
                )}
              </div>
              {!correct && !worked && (
                <div className="learn-practice-help">
                  <Button variant="link" onClick={() => setHint(!hint)}>
                    <CircleHelp size={16} />
                    {hint ? 'Hide hint' : 'Give me a hint'}
                  </Button>
                  {(hint || checked) && (
                    <Button
                      variant="link"
                      onClick={() => {
                        setChecked(false);
                        setWorked(true);
                      }}
                    >
                      Show worked example
                    </Button>
                  )}
                </div>
              )}
              {(correct || worked) && (
                <>
                  <p className="student-note">
                    {worked
                      ? 'Worked example viewed.'
                      : independent
                        ? 'New example answered.'
                        : 'Supported example answered.'}
                  </p>
                  <Button
                    className="learn-primary"
                    onClick={() => {
                      if (independent) onNext();
                      else {
                        setIndependent(true);
                        setAnswer('');
                        setChecked(false);
                        setWorked(false);
                        setHint(false);
                        setPair([]);
                        setPairChecked(false);
                        focusTask();
                      }
                    }}
                  >
                    {independent
                      ? sh
                        ? 'Continue to subcooling'
                        : 'Take it to class'
                      : 'Try a different example'}{' '}
                    <ArrowRight size={16} />
                  </Button>
                </>
              )}
              <Button
                variant="link"
                onClick={() => {
                  setPair([]);
                  setPairChecked(false);
                  setChecked(false);
                  focusTask();
                }}
              >
                Choose readings again
              </Button>
              <p id="practice-units" className="learn-practice-units">
                A temperature difference of 1°C has the same size as 1 K.
              </p>
            </>
          )}
        </section>
      </div>
    </section>
  );
}
