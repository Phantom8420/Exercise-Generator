import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { activeEquipment, getUser, updateUser, type User } from '../db/repo/core';
import { allExercises } from '../db/repo/exercises';
import { saveGeneratedRoutine } from '../db/repo/routines';
import { maxPlan, type MaxPlanInput } from '../domain/maxplan';
import { GOAL_LABEL, WEEKDAYS, type Exercise } from '../domain/types';
import { cap } from '../ui/format';
import { BigNumber, Button, Card, Chip, Chips, Divider, Formula, Gate, ListRow, Row, Screen, Section, Segmented, Stepper, Txt } from '../ui/kit';
import { space } from '../ui/theme';
import { useData, useWrite } from '../ui/useData';

export default function MaxPlanScreen() {
  const state = useData(async (db) => {
    const [user, exercises, equipment] = await Promise.all([getUser(db), allExercises(db), activeEquipment(db)]);
    return { user, exercises, equipment };
  });
  return (
    <Screen back title="Max plan">
      <Gate state={state}>{(d) => <Body {...d} />}</Gate>
    </Screen>
  );
}

const BINDING = { time: 'session length', recovery: 'recovery caps', none: 'nothing' };

function Body({ user, exercises, equipment }: { user: User; exercises: Exercise[]; equipment: string[] }) {
  const write = useWrite();
  const [weekdays, setWeekdays] = useState([0, 1, 2, 3, 4, 5]);
  const [minutes, setMinutes] = useState(60);
  const [respectRecovery, setRespect] = useState(true);
  const [recovery, setRecovery] = useState(user.recovery);
  const [saving, setSaving] = useState(false);

  const input: MaxPlanInput = { weekdays, minutesPerSession: minutes, equipment, goal: user.goal, experience: user.experience, recovery, respectRecovery };
  const result = useMemo(() => maxPlan(input, exercises), [JSON.stringify(input), exercises]); // eslint-disable-line react-hooks/exhaustive-deps
  const e = result.explanation;
  const name = (id: string) => exercises.find((x) => x.id === id)?.name ?? id;

  const save = async () => {
    setSaving(true);
    const id = await write(async (db) => {
      await updateUser(db, { recovery });
      return saveGeneratedRoutine(db, `Max plan · ${e.totalSets} sets`, 'custom', user.goal, result.days, input);
    });
    router.replace(`/routines/${id}`);
  };

  return (
    <>
      <Txt color="muted">The most weekly sets that fit your days and session length, for {GOAL_LABEL[user.goal].toLowerCase()} at {user.experience} level.</Txt>
      <Section title="Days">
        <Chips>
          {WEEKDAYS.map((w, i) => (
            <Chip key={w} label={w} on={weekdays.includes(i)} onPress={() => setWeekdays(weekdays.includes(i) ? weekdays.filter((x) => x !== i) : [...weekdays, i].sort())} />
          ))}
        </Chips>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt v="label" color="muted">Session length</Txt>
          <Stepper label="minutes" value={minutes} step={5} min={10} onChange={setMinutes} format={(v) => `${v} min`} />
        </Row>
      </Section>
      <Section title="Recovery">
        <Segmented label="Recovery limits" value={respectRecovery ? 'on' : 'off'} onChange={(v) => setRespect(v === 'on')} options={[{ value: 'on', label: 'Respect recovery' }, { value: 'off', label: 'Ignore' }]} />
        {respectRecovery && (
          <>
            <Txt v="label" color="muted">Recovery capacity: 1 busy and short on sleep, 5 plenty</Txt>
            <Segmented label="Recovery capacity" value={recovery} onChange={setRecovery} options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))} />
          </>
        )}
      </Section>

      <Card tone="invert" style={{ padding: space.xl }}>
        <Txt v="label" color="onInvert" style={{ opacity: 0.7 }}>Weekly working sets</Txt>
        <BigNumber value={String(e.totalSets)} unit="sets" color="onInvert" />
      </Card>

      <Section title="Why this plan">
        <Formula text={`Score: ${e.score.formula}. Imbalance (variance) = ${e.score.imbalance.toFixed(2)}.`} />
        {e.limits ? (
          <Formula text={`Recovery caps at rating ${recovery}: ${e.limits.weeklyCap} sets per muscle per week, ${e.limits.sessionCap} per session, ${e.limits.minGapHours} h between hits on the same muscle.`} />
        ) : (
          <Txt color="muted">Recovery ignored: only session length limits the plan.</Txt>
        )}
        <Card>
          {e.days.map((d, i) => (
            <View key={d.weekday}>
              {i > 0 && <Divider />}
              <ListRow title={`${WEEKDAYS[d.weekday]} · ${d.sets} sets`} subtitle={`${d.minutesUsed} of ${minutes} min · limited by ${BINDING[d.binding]}`} />
            </View>
          ))}
        </Card>
        <Card>
          {e.weekly.filter((w) => w.sets > 0).map((w, i) => (
            <View key={w.muscle}>
              {i > 0 && <Divider />}
              <ListRow
                title={`${cap(w.muscle)} · ${w.sets}${w.cap != null ? ` / ${w.cap}` : ''} sets`}
                subtitle={`${w.days.map((d) => WEEKDAYS[d]).join(', ')}${w.minGapHours != null ? ` · closest hits ${w.minGapHours} h apart` : ''}`}
              />
            </View>
          ))}
        </Card>
      </Section>

      <Section title="Sessions">
        {result.days.map((d) => (
          <Card key={d.weekday}>
            <Txt v="heading">{WEEKDAYS[d.weekday]} · {d.label}</Txt>
            {d.exercises.map((x, i) => (
              <View key={x.exerciseId + i}>
                {i > 0 && <Divider />}
                <ListRow title={name(x.exerciseId)} subtitle={`${x.sets} × ${x.repMin}–${x.repMax} · rest ${x.restS}s`} />
              </View>
            ))}
          </Card>
        ))}
      </Section>
      <Button title="Save as routine" icon="check" disabled={!result.days.length} loading={saving} onPress={save} />
    </>
  );
}
