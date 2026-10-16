import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { activeEquipment, getUser } from '../../db/repo/core';
import { allExercises } from '../../db/repo/exercises';
import { saveGeneratedRoutine } from '../../db/repo/routines';
import { estimatedMinutes, generateRoutine, type DayInput } from '../../domain/generator';
import { TRAINABLE } from '../../domain/training';
import { GOAL_LABEL, SPLIT_LABEL, WEEKDAYS, type Experience, type Goal, type Intensity, type Split } from '../../domain/types';
import { cap } from '../../ui/format';
import { Button, Card, Chip, Chips, Divider, Field, Gate, ListRow, Row, Screen, Section, Segmented, Stepper, Txt } from '../../ui/kit';
import { space } from '../../ui/theme';
import { useData, useWrite } from '../../ui/useData';

const INTENSITIES: { value: Intensity; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'moderate', label: 'Mod' },
  { value: 'high', label: 'High' },
  { value: 'extreme', label: 'Extreme' },
];

export default function Generate() {
  const write = useWrite();
  const base = useData(async (db) => {
    const [user, exercises, equipment] = await Promise.all([getUser(db), allExercises(db), activeEquipment(db)]);
    return { user, exercises, equipment };
  });
  return (
    <Screen back title="Generate routine">
      <Gate state={base}>{(b) => <Form {...b} save={write} />}</Gate>
    </Screen>
  );
}

function Form({ user, exercises, equipment, save }: {
  user: { goal: Goal; experience: Experience };
  exercises: Parameters<typeof generateRoutine>[1];
  equipment: string[];
  save: ReturnType<typeof useWrite>;
}) {
  const [split, setSplit] = useState<Split>('ppl');
  const [goal, setGoal] = useState<Goal>(user.goal);
  const [experience, setExperience] = useState<Experience>(user.experience);
  const [days, setDays] = useState<DayInput[]>([0, 2, 4].map((weekday) => ({ weekday, intensity: 'moderate', minutes: 60 })));
  const [seed, setSeed] = useState(1);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const toggleDay = (w: number) =>
    setDays((ds) => (ds.some((d) => d.weekday === w) ? ds.filter((d) => d.weekday !== w) : [...ds, { weekday: w, intensity: 'moderate' as const, minutes: 60 }].sort((a, b) => a.weekday - b.weekday)));
  const patchDay = (w: number, p: Partial<DayInput>) => setDays((ds) => ds.map((d) => (d.weekday === w ? { ...d, ...p } : d)));

  const input = { split, goal, experience, equipment, days, seed };
  const preview = useMemo(() => generateRoutine(input, exercises), [JSON.stringify(input), exercises]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    setSaving(true);
    const id = await save((db) => saveGeneratedRoutine(db, name.trim() || `${SPLIT_LABEL[split]} · ${GOAL_LABEL[goal]}`, split, goal, preview, input));
    router.replace(`/routines/${id}`);
  };

  return (
    <>
      <Section title="Split">
        <Chips>
          {(Object.keys(SPLIT_LABEL) as Split[]).map((s) => <Chip key={s} label={SPLIT_LABEL[s]} on={split === s} onPress={() => setSplit(s)} />)}
        </Chips>
      </Section>
      <Section title="Goal">
        <Chips>
          {(Object.keys(GOAL_LABEL) as Goal[]).map((g) => <Chip key={g} label={GOAL_LABEL[g]} on={goal === g} onPress={() => setGoal(g)} />)}
        </Chips>
      </Section>
      <Section title="Experience">
        <Segmented
          label="Experience"
          value={experience}
          onChange={setExperience}
          options={(['beginner', 'intermediate', 'advanced'] as const).map((e) => ({ value: e, label: cap(e) }))}
        />
      </Section>
      <Section title="Days">
        <Chips>
          {WEEKDAYS.map((w, i) => <Chip key={w} label={w} on={days.some((d) => d.weekday === i)} onPress={() => toggleDay(i)} />)}
        </Chips>
        {days.map((d) => (
          <Card key={d.weekday} style={{ gap: space.m }}>
            <Txt v="heading">{WEEKDAYS[d.weekday]}</Txt>
            <Segmented label={`${WEEKDAYS[d.weekday]} intensity`} value={d.intensity} onChange={(intensity) => patchDay(d.weekday, { intensity })} options={INTENSITIES} />
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt v="label" color="muted">Session length</Txt>
              <Stepper label="minutes" value={d.minutes} step={5} min={10} onChange={(minutes) => patchDay(d.weekday, { minutes })} format={(v) => `${v} min`} />
            </Row>
            {split === 'custom' && (
              <Chips>
                {TRAINABLE.map((m) => {
                  const on = d.muscles?.includes(m) ?? false;
                  return <Chip key={m} label={cap(m)} on={on} onPress={() => patchDay(d.weekday, { muscles: on ? d.muscles!.filter((x) => x !== m) : [...(d.muscles ?? []), m] })} />;
                })}
              </Chips>
            )}
          </Card>
        ))}
      </Section>
      <Section title="Equipment" action={<Button small kind="ghost" title="Change" onPress={() => router.push('/equipment')} />}>
        <Txt color="muted">{equipment.length ? equipment.map(cap).join(', ') : 'Bodyweight only'}</Txt>
      </Section>

      <Section title="Preview" action={<Button small kind="secondary" icon="shuffle" title="Shuffle" onPress={() => setSeed(seed + 1)} />}>
        {preview.length === 0 && <Txt color="muted">Pick at least one day.</Txt>}
        {preview.map((d) => (
          <Card key={d.weekday}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt v="heading">{WEEKDAYS[d.weekday]} · {d.label}</Txt>
              <Txt v="label" color="muted" num>~{estimatedMinutes(d.exercises)} min</Txt>
            </Row>
            {d.exercises.length === 0 && <Txt color="muted">No exercise fits this day with your equipment.</Txt>}
            {d.exercises.map((e, i) => {
              const ex = exercises.find((x) => x.id === e.exerciseId);
              return (
                <View key={e.exerciseId + i}>
                  {i > 0 && <Divider />}
                  <ListRow title={ex?.name ?? e.exerciseId} subtitle={`${e.sets} × ${e.repMin}–${e.repMax} · rest ${e.restS}s`} />
                </View>
              );
            })}
          </Card>
        ))}
      </Section>
      <Field label="Name" value={name} onChangeText={setName} placeholder={`${SPLIT_LABEL[split]} · ${GOAL_LABEL[goal]}`} />
      <Button title="Save and make active" icon="check" disabled={!preview.length} loading={saving} onPress={submit} />
    </>
  );
}
