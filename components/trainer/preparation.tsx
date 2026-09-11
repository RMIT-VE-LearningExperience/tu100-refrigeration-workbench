'use client';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CycleMap, PartReference } from './practical-reference';
import { STAGES, type StageId } from '@/lib/learning';

export function PreparationStart({
  onStart,
  onPractical,
}: {
  onStart: () => void;
  onPractical: () => void;
}) {
  const [part, setPart] = useState<StageId>('compressor');
  const stage = STAGES.find((s) => s.id === part)!;
  return (
    <section className="student-space preparation-start">
      <div className="student-title">
        <p className="learn-eyebrow">BEFORE CLASS</p>
        <h2 tabIndex={-1}>Get to know the refrigeration cycle</h2>
        <p>
          Prepare to find the four main parts and explain the readings you’ll
          use in class.
        </p>
      </div>
      <div className="preparation-layout">
        <div>
          <div className="prep-path">
            <span>1 · Meet the parts</span>
            <span>2 · Choose & use readings</span>
            <span>3 · Take it to class</span>
          </div>
          <h3>Heat moves. Refrigerant keeps circulating.</h3>
          <p>
            Start at the compressor and follow the loop. Select a part to see
            its job.
          </p>
          <CycleMap selected={part} onSelect={setPart} />
          <div className="prep-explanation" aria-live="polite">
            <strong>
              {stage.name} · {stage.action}
            </strong>
            <p>{stage.description}</p>
            <span>{stage.phase}</span>
          </div>
          <Button className="student-primary" onClick={onStart}>
            Find the parts on the unit <ArrowRight />
          </Button>
          <p className="student-note">
            A supported practice activity. No timer or grade.
          </p>
        </div>
        <div className="prep-photo">
          <PartReference compact activePart={part} />
        </div>
      </div>
      <footer className="student-reference-footer">
        Already beside the trainer?
        <Button variant="link" onClick={onPractical}>
          Go to practical reference <ArrowRight />
        </Button>
      </footer>
    </section>
  );
}

export function PreparationHandover({
  onPractical,
  onReview,
}: {
  onPractical: () => void;
  onReview: () => void;
}) {
  const [selected, setSelected] = useState('');
  const correct = selected === 'evidence';
  return (
    <section className="student-space handover">
      <div className="student-title">
        <p className="learn-eyebrow">TAKE IT TO CLASS</p>
        <h2 tabIndex={-1}>Connect the example to the real unit</h2>
        <p>
          Use component recognition and temperature differences to explain what
          you observe in class.
        </p>
      </div>
      <h3>The glass section looks clear. What can you conclude?</h3>
      <div className="handover-options">
        {[
          ['liquid', 'It must contain liquid.'],
          ['vapour', 'It must contain vapour.'],
          [
            'evidence',
            'I need the circuit location, pressure and temperature.',
          ],
        ].map(([id, label]) => (
          <Button
            key={id}
            variant="outline"
            aria-pressed={selected === id}
            onClick={() => setSelected(id)}
          >
            {label}
          </Button>
        ))}
      </div>
      <output className="student-feedback">
        {selected &&
          (correct
            ? 'Yes. Clear liquid and clear vapour can look similar. Use several observations to explain the phase.'
            : 'Appearance alone is not enough. Clear liquid and clear vapour can look similar; consider what other evidence you need.')}
      </output>
      <div className="handover-tasks">
        <h3>Beside the trainer</h3>
        <ol>
          <li>
            Locate the four components and explain where heat enters and leaves.
          </li>
          <li>
            Ask your teacher to identify the outlet and pressure measurement
            points.
          </li>
          <li>
            Use your actual readings in the class worksheet. Describe one
            agreement or difference from the example.
          </li>
        </ol>
      </div>
      <Button className="student-primary" onClick={onPractical}>
        Open my practical reference <ArrowRight />
      </Button>
      <Button variant="link" onClick={onReview}>
        Review the parts
      </Button>
      <p className="student-note">
        Preparation is practice, not a practical competency result. You can
        reopen the reference any time.
      </p>
    </section>
  );
}
