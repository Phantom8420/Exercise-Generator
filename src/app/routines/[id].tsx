import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  addRoutineExercise,
  deleteDay,
  deleteRoutine,
  getRoutine,
  moveRoutineExercise,
  removeRoutineExercise,
  renameRoutine,
  setActiveRoutine,
  updateDay,
  updateRoutineExercise,
  upsertDay,
  type RoutineDay,
  type RoutineExercise,
} from '../../db/repo/routines';
import { estimatedMinutes } from '../../domain/generator';
import { GOAL_PARAMS } from '../../domain/training';
import { GOAL_LABEL, SPLIT_LABEL, WEEKDAYS, type Goal } from '../../domain/types';
import { displayWeight, storeWeight } from '../../domain/units';
import { pickExercise } from '../../state/pick';
import { useUnits } from '../../ui/format';
import { Button, Card, Divider, Field, Gate, Icon, IconButton, ListRow, Row, Screen, Segmented, Stepper, Tag, Txt } from '../../ui/kit';
import { space } from '../../ui/theme';
import { useData, useWrite } from '../../ui/useData';

export default function RoutineEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const write = useWrite();
  const state = useData(async (db) => {
    const r = await getRoutine(db, Number(id));
    if (!r) throw new Error('Routine not found.');
    return r;
  }, [id]);
  const [name, setName] = useState<string | null>(null);

  return (
    <Screen back title={state.data?.routine.name ?? 'Routine'}>
      <Gate state={state}>
        {({ routine, days }) => (
          <>
            <Card>
              <Field
                label="Name"
                value={name ?? routine.name}
                onChangeText={setName}
                onEndEditing={() => name?.trim() && write((db) => renameRoutine(db, routine.id, name.trim()))}
              />
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt v="caption" color="muted">{SPLIT_LABEL[routine.split]} · {GOAL_LABEL[routine.goal]}</Txt>
                {routine.isActive ? <Tag label="Active" strong /> : <Button small title="Make active" onPress={() => write((db) => setActiveRoutine(db, routine.id))} />}
              </Row>
            </Card>
            {WEEKDAYS.map((w, i) => {
              const day = days.find((d) => d.weekday === i);
              return day ? (
                <DayCard key={w} day={day} goal={routine.goal} />
              ) : (
                <Card key={w} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Txt v="label" color="muted">{w} · Rest</Txt>
                  <Button small kind="secondary" icon="plus" title="Train" onPress={() => write((db) => upsertDay(db, routine.id, i, {}))} />
                </Card>
              );
            })}
            <Button
              kind="danger"
              title="Delete routine"
              icon="trash-2"
              onPress={async () => {
                await write((db) => deleteRoutine(db, routine.id));
                router.back();
              }}
            />
          </>
        )}
      </Gate>
    </Screen>
  );
}

function DayCard({ day, goal }: { day: RoutineDay; goal: Goal }) {
  const write = useWrite();
  const [open, setOpen] = useState<number | null>(null);
  const [label, setLabel] = useState(day.label);
  const p = GOAL_PARAMS[goal];
  return (
    <Card style={{ gap: space.m }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt v="heading">{WEEKDAYS[day.weekday]}</Txt>
        <Txt v="label" color="muted" num>~{estimatedMinutes(day.exercises)} / {day.minutes} min</Txt>
      </Row>
      <Field label="Label" value={label} onChangeText={setLabel} onEndEditing={() => label.trim() && write((db) => updateDay(db, day.id, { label: label.trim() }))} />
      <Segmented
        label={`${WEEKDAYS[day.weekday]} intensity`}
        value={day.intensity}
        onChange={(intensity) => write((db) => updateDay(db, day.id, { intensity }))}
        options={[{ value: 'low', label: 'Low' }, { value: 'moderate', label: 'Mod' }, { value: 'high', label: 'High' }, { value: 'extreme', label: 'Extreme' }]}
      />
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt v="label" color="muted">Session length</Txt>
        <Stepper label="minutes" value={day.minutes} step={5} min={10} format={(v) => `${v} min`} onChange={(minutes) => write((db) => updateDay(db, day.id, { minutes }))} />
      </Row>
      {day.exercises.map((e, i) => (
        <View key={e.id}>
          {i > 0 && <Divider />}
          <ListRow
            title={e.exercise.name}
            subtitle={`${e.sets} × ${e.repMin}–${e.repMax} · rest ${e.restS}s`}
            chevron={false}
            onPress={() => setOpen(open === e.id ? null : e.id)}
            right={<Icon name={open === e.id ? 'chevron-up' : 'chevron-down'} color="muted" />}
          />
          {open === e.id && <ExerciseEditor e={e} first={i === 0} last={i === day.exercises.length - 1} />}
        </View>
      ))}
      <Row>
        <Button
          small
          kind="secondary"
          icon="plus"
          title="Add exercise"
          style={{ flex: 1 }}
          onPress={() => pickExercise((ex) => write((db) => addRoutineExercise(db, day.id, { exerciseId: ex.id, sets: p.setsPerExercise, repMin: p.repMin, repMax: p.repMax, restS: p.restS })))}
        />
        <Button small kind="ghost" title="Make rest day" onPress={() => write((db) => deleteDay(db, day.id))} />
      </Row>
    </Card>
  );
}

function ExerciseEditor({ e, first, last }: { e: RoutineExercise; first: boolean; last: boolean }) {
  const write = useWrite();
  const u = useUnits();
  const [weight, setWeight] = useState(e.targetWeightKg != null ? String(displayWeight(e.targetWeightKg, u.units)) : '');
  const set = (patch: Parameters<typeof updateRoutineExercise>[2]) => write((db) => updateRoutineExercise(db, e.id, patch));
  return (
    <View style={{ gap: space.s, paddingBottom: space.m }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt v="label" color="muted">Sets</Txt>
        <Stepper label="sets" value={e.sets} min={1} onChange={(sets) => set({ sets })} />
      </Row>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt v="label" color="muted">Min reps</Txt>
        <Stepper label="minimum reps" value={e.repMin} min={1} onChange={(repMin) => set({ repMin, repMax: Math.max(repMin, e.repMax) })} />
      </Row>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt v="label" color="muted">Max reps</Txt>
        <Stepper label="maximum reps" value={e.repMax} min={e.repMin} onChange={(repMax) => set({ repMax })} />
      </Row>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt v="label" color="muted">Rest</Txt>
        <Stepper label="rest seconds" value={e.restS} step={15} min={0} format={(v) => `${v}s`} onChange={(restS) => set({ restS })} />
      </Row>
      <Field
        label={`Target weight (${u.w}), optional`}
        keyboardType="decimal-pad"
        value={weight}
        onChangeText={setWeight}
        placeholder="Debt counts reps until this is set"
        onEndEditing={() => set({ targetWeightKg: weight.trim() ? storeWeight(parseFloat(weight.replace(',', '.')) || 0, u.units) : null })}
      />
      <Row>
        <IconButton icon="arrow-up" label="Move up" onPress={() => !first && write((db) => moveRoutineExercise(db, e.id, -1))} />
        <IconButton icon="arrow-down" label="Move down" onPress={() => !last && write((db) => moveRoutineExercise(db, e.id, 1))} />
        <Button small kind="secondary" icon="repeat" title="Swap" style={{ flex: 1 }} onPress={() => pickExercise((ex) => set({ exerciseId: ex.id }), e.exercise.primary[0])} />
        <IconButton icon="trash-2" label={`Remove ${e.exercise.name}`} onPress={() => write((db) => removeRoutineExercise(db, e.id))} />
      </Row>
    </View>
  );
}
