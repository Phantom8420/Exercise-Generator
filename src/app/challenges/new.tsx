import { router } from 'expo-router';
import { useState } from 'react';
import { createChallenge } from '../../db/repo/challenges';
import type { ChallengeKind } from '../../domain/challenges';
import { addDays, today } from '../../domain/dates';
import { TRAINABLE } from '../../domain/training';
import type { Muscle } from '../../domain/types';
import { storeWeight } from '../../domain/units';
import { pickExercise } from '../../state/pick';
import { cap, KIND_LABEL, useUnits } from '../../ui/format';
import { Button, Card, Chip, Chips, Field, Row, Screen, Section, Segmented, Txt } from '../../ui/kit';
import { space } from '../../ui/theme';
import { useWrite } from '../../ui/useData';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export default function NewChallenge() {
  const u = useUnits();
  const write = useWrite();
  const [kind, setKind] = useState<ChallengeKind>('volume');
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [start, setStart] = useState(today());
  const [end, setEnd] = useState(addDays(today(), 29));
  const [muscles, setMuscles] = useState<Muscle[]>([]);
  const [exercises, setExercises] = useState<{ id: string; name: string }[]>([]);
  const [bodyweight, setBodyweight] = useState(true);
  const [dailyKcal, setDailyKcal] = useState('');
  const [kcalMode, setKcalMode] = useState<'at_least' | 'at_most'>('at_most');

  const t = parseFloat(target.replace(',', '.'));
  const kcal = parseFloat(dailyKcal);
  const unit = kind === 'volume' ? u.w : kind === 'reps' ? 'reps' : 'days';
  const valid = t > 0 && ISO.test(start) && ISO.test(end) && end >= start && (kind !== 'calories' || kcal > 0);
  const auto = `${target || '…'} ${unit} ${KIND_LABEL[kind].toLowerCase()}`;

  const save = () =>
    write((db) =>
      createChallenge(db, {
        name: name.trim() || auto,
        kind,
        target: kind === 'volume' ? storeWeight(t, u.units) : t,
        startDate: start,
        endDate: end,
        exerciseIds: exercises.map((e) => e.id),
        muscles,
        countBodyweight: bodyweight,
        dailyKcal: kind === 'calories' ? kcal : null,
        kcalMode: kind === 'calories' ? kcalMode : null,
      }),
    ).then((id) => router.replace(`/challenges/${id}`));

  return (
    <Screen back title="New challenge">
      <Segmented label="Challenge type" value={kind} onChange={setKind} options={(Object.keys(KIND_LABEL) as ChallengeKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
      <Txt color="muted">
        {{
          volume: 'Total weight × reps lifted in the window.',
          reps: 'Total reps in the window.',
          calories: 'Days that meet a daily calorie line, counted from your food log.',
          streak: 'Consecutive days with at least one logged set.',
        }[kind]}
      </Txt>
      <Card style={{ gap: space.m }}>
        <Field label={`Target (${unit})`} value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder={kind === 'volume' ? '100000' : kind === 'reps' ? '1000' : '30'} />
        <Row>
          <Field label="Start" value={start} onChangeText={setStart} style={{ flex: 1 }} />
          <Field label="End" value={end} onChangeText={setEnd} style={{ flex: 1 }} />
        </Row>
        <Row>
          {[7, 30, 90].map((n) => <Button key={n} small kind="secondary" title={`${n} days`} onPress={() => setEnd(addDays(start, n - 1))} />)}
        </Row>
        {kind === 'calories' && (
          <>
            <Segmented label="Calorie direction" value={kcalMode} onChange={setKcalMode} options={[{ value: 'at_most', label: 'At most' }, { value: 'at_least', label: 'At least' }]} />
            <Field label="Daily kcal" value={dailyKcal} onChangeText={setDailyKcal} keyboardType="number-pad" placeholder="2200" />
          </>
        )}
      </Card>

      {(kind === 'volume' || kind === 'reps') && (
        <Section title="Counts toward it">
          <Txt v="caption" color="muted">Leave both empty to count every exercise. Picked exercises win over muscles.</Txt>
          <Chips>
            {TRAINABLE.map((m) => <Chip key={m} label={cap(m)} on={muscles.includes(m)} onPress={() => setMuscles(muscles.includes(m) ? muscles.filter((x) => x !== m) : [...muscles, m])} />)}
          </Chips>
          <Chips>
            {exercises.map((e) => <Chip key={e.id} icon="x" label={e.name} on onPress={() => setExercises(exercises.filter((x) => x.id !== e.id))} />)}
            <Chip icon="plus" label="Exercise" on={false} onPress={() => pickExercise((ex) => setExercises((xs) => (xs.some((x) => x.id === ex.id) ? xs : [...xs, { id: ex.id, name: ex.name }])))} />
          </Chips>
          {kind === 'volume' && <Chip label="Count bodyweight sets at my body weight" on={bodyweight} onPress={() => setBodyweight(!bodyweight)} />}
        </Section>
      )}

      <Field label="Name" value={name} onChangeText={setName} placeholder={auto} />
      <Button title="Start challenge" icon="check" disabled={!valid} onPress={save} />
    </Screen>
  );
}
