import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { getExercise } from '../db/repo/exercises';
import { deleteSet, equivalenceFor, listDebts, logSet } from '../db/repo/debts';
import { activeDayFor } from '../db/repo/routines';
import { activeSession, deleteSession, endSession, lastSetFor, setsForSession, startSession } from '../db/repo/workouts';
import { today, weekdayOf } from '../domain/dates';
import { displayWeight, storeWeight } from '../domain/units';
import { pickExercise } from '../state/pick';
import { useUnits } from '../ui/format';
import { PhotoHero } from '../media/ExerciseDemo';
import { Button, Card, Divider, Field, Gate, IconButton, ListRow, ProgressBar, Row, Screen, Section, StatRow, Tag, Txt } from '../ui/kit';
import { space } from '../ui/theme';
import { useData, useWrite } from '../ui/useData';
import { Wheel } from '../ui/Wheel';

const REPS = Array.from({ length: 60 }, (_, i) => i + 1);
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

interface Target {
  exerciseId: string;
  debtId: number | null;
}

export default function Workout() {
  const u = useUnits();
  const write = useWrite();
  const now = today();
  const [target, setTarget] = useState<Target | null>(null);
  const [weight, setWeight] = useState('0');
  const [reps, setReps] = useState(10);
  const [restLeft, setRestLeft] = useState(0);
  const [tick, setTick] = useState(Date.now());

  const state = useData(async (db) => {
    const [day, session, debts] = await Promise.all([activeDayFor(db, weekdayOf(now)), activeSession(db), listDebts(db)]);
    const sets = session ? await setsForSession(db, session.id) : [];
    const owed = debts.flatMap((d) => d.allocations.filter((a) => a.day === now).map((a) => ({ debt: d, amount: a.amount })));
    return { day, session, sets, owed };
  });

  const selected = useData(async (db) => {
    if (!target) return null;
    const ex = await getExercise(db, target.exerciseId);
    if (!ex) return null;
    const debt = target.debtId != null ? (await listDebts(db)).find((d) => d.id === target.debtId) ?? null : null;
    const factor = debt ? await equivalenceFor(db, debt.exercise.id, ex.id) : 1;
    return { ex, debt, factor, last: await lastSetFor(db, ex.id) };
  }, [target?.exerciseId, target?.debtId]);

  // Default to the first planned exercise that still has sets left.
  useEffect(() => {
    const d = state.data;
    if (target || !d?.day) return;
    const next = d.day.exercises.find((e) => d.sets.filter((s) => s.exerciseId === e.exerciseId && s.debtId == null).length < e.sets);
    if (next) setTarget({ exerciseId: next.exerciseId, debtId: null });
  }, [state.data, target]);

  // Prefill weight and reps when the selection changes.
  const planned = state.data?.day?.exercises.find((e) => e.exerciseId === target?.exerciseId);
  useEffect(() => {
    const s = selected.data;
    if (!s) return;
    const kg = s.last?.weightKg ?? planned?.targetWeightKg ?? 0;
    setWeight(String(displayWeight(kg, u.units)));
    setReps(s.last?.reps ?? planned?.repMax ?? 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.data?.ex.id]);

  useEffect(() => {
    const t = setInterval(() => {
      setTick(Date.now());
      setRestLeft((r) => Math.max(0, r - 1));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const log = async () => {
    if (!target) return;
    const kg = storeWeight(parseFloat(weight.replace(',', '.')) || 0, u.units);
    await write(async (db) => {
      const sid = state.data?.session?.id ?? (await startSession(db, state.data?.day?.id ?? null, now));
      await logSet(db, sid, target.exerciseId, kg, reps, target.debtId);
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setRestLeft(planned?.restS ?? 90);
  };

  const finish = async () => {
    const s = state.data?.session;
    if (s) await write((db) => (state.data!.sets.length ? endSession(db, s.id) : deleteSession(db, s.id)));
    router.back();
  };

  const step = u.units === 'metric' ? 2.5 : 5;
  const bumpWeight = (d: number) => setWeight(String(Math.max(0, Math.round(((parseFloat(weight) || 0) + d) * 10) / 10)));

  return (
    <Screen
      back
      glow
      title={state.data?.session ? `Workout · ${mmss((tick - Date.parse(state.data.session.startedAt)) / 1000)}` : 'Workout'}
      right={<Button small title="Finish" kind="secondary" onPress={finish} />}
    >
      <Gate state={state}>
        {(d) => {
          const doneFor = (id: string) => d.sets.filter((s) => s.exerciseId === id && s.debtId == null).length;
          return (
            <>
              {selected.data ? (
                <PhotoHero exercise={selected.data.ex} height={300}>
                  {selected.data.debt && (
                    <Tag
                      outline
                      label={`Repaying ${selected.data.debt.exercise.name}${selected.data.factor !== 1 ? ` · ×${selected.data.factor.toFixed(2)}` : ''}`}
                    />
                  )}
                  <Txt v="title" style={{ color: '#FFFFFF', fontSize: 30, lineHeight: 34 }} numberOfLines={2}>{selected.data.ex.name}</Txt>
                  {planned && !selected.data.debt ? (
                    <StatRow
                      light
                      items={[
                        { icon: 'layers', value: `${Math.min(doneFor(planned.exerciseId) + 1, planned.sets)}/${planned.sets}`, label: 'set' },
                        { icon: 'repeat', value: `${planned.repMin}–${planned.repMax}`, label: 'reps' },
                        { icon: 'clock', value: `${planned.restS}s`, label: 'rest' },
                      ]}
                    />
                  ) : selected.data.last ? (
                    <Txt v="label" style={{ color: 'rgba(255,255,255,0.75)' }}>Last time {u.weight(selected.data.last.weightKg)} × {selected.data.last.reps}</Txt>
                  ) : null}
                </PhotoHero>
              ) : null}
              {selected.data ? (
                <Card style={{ gap: space.m }}>
                  <Row gap={space.m} style={{ alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, gap: space.s }}>
                      <Field label={`Weight (${u.w})`} keyboardType="decimal-pad" value={weight} onChangeText={setWeight} selectTextOnFocus />
                      <Row style={{ justifyContent: 'space-between' }}>
                        <IconButton icon="minus" label={`Remove ${step} ${u.w}`} tone="accent" onPress={() => bumpWeight(-step)} />
                        <IconButton icon="plus" label={`Add ${step} ${u.w}`} tone="accent" onPress={() => bumpWeight(step)} />
                      </Row>
                    </View>
                    <View style={{ width: 110, gap: 6 }}>
                      <Txt v="label" color="muted">Reps</Txt>
                      <Wheel values={REPS} value={reps} onChange={setReps} label="Reps" />
                    </View>
                  </Row>
                  <Button title="Log set" icon="check" onPress={log} />
                </Card>
              ) : (
                <Card>
                  <Txt v="heading">Pick something to log</Txt>
                  <Txt color="muted">Choose from today's plan, what you owe, or any exercise.</Txt>
                  <Button title="Choose exercise" icon="search" kind="secondary" onPress={() => pickExercise((ex) => setTarget({ exerciseId: ex.id, debtId: null }))} />
                </Card>
              )}

              {restLeft > 0 && (
                <Card>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Txt v="heading" num accessibilityLiveRegion="polite">Rest {mmss(restLeft)}</Txt>
                    <Button small kind="ghost" title="Skip" onPress={() => setRestLeft(0)} />
                  </Row>
                  <ProgressBar pct={restLeft / (planned?.restS ?? 90)} color="series2" />
                </Card>
              )}

              {d.day && (
                <Section title={`Today · ${d.day.label}`}>
                  <Card>
                    {d.day.exercises.map((e, i) => {
                      const done = doneFor(e.exerciseId);
                      const on = target?.exerciseId === e.exerciseId && target.debtId == null;
                      return (
                        <View key={e.id}>
                          {i > 0 && <Divider />}
                          <ListRow
                            title={e.exercise.name}
                            subtitle={`${done}/${e.sets} sets · ${e.repMin}–${e.repMax} reps`}
                            icon={done >= e.sets ? 'check-circle' : on ? 'chevron-right' : 'circle'}
                            chevron={false}
                            onPress={() => setTarget({ exerciseId: e.exerciseId, debtId: null })}
                          />
                        </View>
                      );
                    })}
                  </Card>
                </Section>
              )}

              {d.owed.length > 0 && (
                <Section title="Owed today">
                  <Card>
                    {d.owed.map((o, i) => (
                      <View key={o.debt.id}>
                        {i > 0 && <Divider />}
                        <ListRow
                          title={o.debt.exercise.name}
                          subtitle={`${u.amount(o.amount, o.debt.metric)} scheduled · ${u.amount(o.debt.owed - o.debt.repaid, o.debt.metric)} left in total`}
                          onPress={() => setTarget({ exerciseId: o.debt.exercise.id, debtId: o.debt.id })}
                          chevron={false}
                          right={
                            <Button
                              small
                              kind="ghost"
                              title="Swap"
                              onPress={() => pickExercise((ex) => setTarget({ exerciseId: ex.id, debtId: o.debt.id }), o.debt.muscle)}
                            />
                          }
                        />
                      </View>
                    ))}
                  </Card>
                </Section>
              )}

              <Button kind="secondary" icon="plus" title="Add another exercise" onPress={() => pickExercise((ex) => setTarget({ exerciseId: ex.id, debtId: null }))} />

              {d.sets.length > 0 && (
                <Section title={`Logged · ${d.sets.length} ${d.sets.length === 1 ? 'set' : 'sets'}`}>
                  <Card>
                    {[...d.sets].reverse().map((s, i) => (
                      <View key={s.id}>
                        {i > 0 && <Divider />}
                        <SetRow setId={s.id} exerciseId={s.exerciseId} weightKg={s.weightKg} reps={s.reps} debt={s.debtId != null} onDelete={() => write((db) => deleteSet(db, s.id))} />
                      </View>
                    ))}
                  </Card>
                </Section>
              )}
            </>
          );
        }}
      </Gate>
    </Screen>
  );
}

function SetRow({ exerciseId, weightKg, reps, debt, onDelete }: { setId: number; exerciseId: string; weightKg: number; reps: number; debt: boolean; onDelete: () => void }) {
  const u = useUnits();
  const ex = useData((db) => getExercise(db, exerciseId), [exerciseId]);
  return (
    <ListRow
      title={ex.data?.name ?? exerciseId}
      subtitle={`${weightKg > 0 ? `${u.weight(weightKg)} × ${reps}` : `${reps} reps`}${debt ? ' · repayment' : ''}`}
      chevron={false}
      right={<IconButton icon="trash-2" label="Delete set" tone="plain" onPress={onDelete} />}
    />
  );
}
