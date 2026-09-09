'use client';
/* oxlint-disable react/react-compiler, jsx-a11y/prefer-tag-over-role */
// Restore device-local answers after hydration. The HTML temperature diagram and
// multi-paragraph live feedback require composite accessible regions.
import { useEffect, useState } from 'react';
import { ArrowRight, Check, CircleHelp, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { lessonSetupMatches } from '@/lib/learning';
import type { simulate } from '@/lib/model';
type Kind = 'superheat' | 'subcooling';
const sessionAnswers: Partial<Record<Kind, string>> = {};
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
  useEffect(() => {
    try {
      const saved = localStorage.getItem('tu100-answer-' + kind);
      setAnswer(sessionAnswers[kind] ?? saved ?? '');
    } catch {
      setAnswer(sessionAnswers[kind] ?? '');
    }
  }, [kind]);
  const matching = lessonSetupMatches(refrigerant, ambient, model);
  const active = matching && !!model.values;
  const v = active ? model.values : null;
  const sh = kind === 'superheat';
  const name = sh ? 'Superheat' : 'Subcooling';
  const upper = sh ? v?.Teo : v?.Tbubble;
  const lower = sh ? v?.Tevap : v?.Tco;
  const expected =
    upper === undefined || lower === undefined ? undefined : upper - lower;
  const correct =
    checked &&
    answer.trim() !== '' &&
    expected !== undefined &&
    Number.isFinite(Number(answer)) &&
    Math.abs(Number(answer) - expected) < 0.11;
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
          <h2 tabIndex={-1}>Read the temperature gap</h2>
        </div>
        <span className="learn-session">R134a · Cooling example</span>
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
          <small>Calculated teaching values</small>
        </div>
        <section className="learn-practice-question">
          <p className="learn-eyebrow">{name}</p>
          <h3>How big is the gap?</h3>
          <p>
            {sh
              ? 'Compare the outlet vapour with the evaporator dew point.'
              : 'Compare the liquid outlet with the condenser bubble point.'}
          </p>
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
          ) : (
            <>
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
                    sessionAnswers[kind] = event.target.value;
                    try {
                      localStorage.setItem(
                        'tu100-answer-' + kind,
                        event.target.value,
                      );
                    } catch {}
                    setChecked(false);
                    setWorked(false);
                  }}
                />
                {!correct && (
                  <Button type="submit" className="learn-primary">
                    Check answer
                  </Button>
                )}
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
                <Button className="learn-primary" onClick={onNext}>
                  {sh ? 'Try subcooling' : 'Back to the cycle'}{' '}
                  <ArrowRight size={16} />
                </Button>
              )}
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
