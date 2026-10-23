import { router } from 'expo-router';
import { useState } from 'react';
import { addBodyMetric, setSetting, updateUser, type User } from '../db/repo/core';
import { setTarget } from '../db/repo/nutrition';
import { addDays, today } from '../domain/dates';
import { ACTIVITY, ageFrom, bodyFatGoalPace, calorieTarget, defaultPaceKg, mifflinStJeor, navyBodyFat, proteinTarget, tdee } from '../domain/metrics';
import { GOAL_LABEL, type Goal } from '../domain/types';
import { lengthUnit, storeLength, storeWeight } from '../domain/units';
import { useUnits } from '../ui/format';
import { Button, Card, Chip, Chips, Field, Row, Screen, Section, Segmented, Txt } from '../ui/kit';
import { space } from '../ui/theme';
import { useWrite } from '../ui/useData';

const num = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default function Onboarding() {
  const u = useUnits();
  const write = useWrite();
  const L = lengthUnit(u.units);
  const [sex, setSex] = useState<User['sex']>('male');
  const [goal, setGoal] = useState<Goal>('lose_fat');
  const [activity, setActivity] = useState(1.55);
  const [f, setF] = useState({ name: '', birth: '', height: '', weight: '', waist: '', neck: '', hip: '', bf: '', targetBf: '', weeks: '' });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });

  const heightCm = num(f.height) != null ? storeLength(num(f.height)!, u.units) : null;
  const weightKg = num(f.weight) != null ? storeWeight(num(f.weight)!, u.units) : null;
  const len = (s: string) => (num(s) != null ? storeLength(num(s)!, u.units) : null);
  const ready = heightCm != null && weightKg != null && DATE.test(f.birth);

  const finish = async () => {
    setBusy(true);
    const day = today();
    const weeks = num(f.weeks);
    const targetBfPct = num(f.targetBf);
    const waist = len(f.waist), neck = len(f.neck), hip = len(f.hip);
    const bf = num(f.bf) ?? (waist && neck ? navyBodyFat(sex, heightCm!, waist, neck, hip)?.value ?? null : null);
    const bfPace = bf != null && targetBfPct != null && weeks ? bodyFatGoalPace(weightKg!, bf, targetBfPct, weeks).value : null;
    const bmr = mifflinStJeor(sex, weightKg!, heightCm!, ageFrom(f.birth)).value;
    const kcal = calorieTarget(tdee(bmr, activity).value, bfPace ?? defaultPaceKg(goal, weightKg)).value;
    await write(async (db) => {
      await updateUser(db, {
        name: f.name.trim() || null, sex, birthDate: f.birth, heightCm, goal, activityFactor: activity, paceKgWeek: null,
        targetBfPct, targetDate: targetBfPct != null && weeks ? addDays(day, Math.round(weeks * 7)) : null,
      });
      await addBodyMetric(db, {
        measuredOn: day, weightKg, waistCm: waist, neckCm: neck, hipCm: hip,
        bodyFatPct: num(f.bf), bodyFatSource: num(f.bf) != null ? 'manual' : null,
      });
      await setTarget(db, day, { kcal: Math.round(kcal), proteinG: Math.round(proteinTarget(weightKg!, goal).value), carbsG: null, fatG: null, source: 'tdee' });
      await setSetting(db, 'onboarded', '1');
    });
    router.replace('/routines/generate');
  };

  return (
    <Screen title="About you">
      <Txt color="muted">Plasma builds your training and diet from this. Everything can be changed later in Body metrics.</Txt>
      <Section title="Body">
        <Card style={{ gap: space.m }}>
          <Field label="Name" value={f.name} onChangeText={set('name')} />
          <Segmented label="Sex" value={sex} onChange={setSex} options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
          <Field label="Birth date (YYYY-MM-DD)" value={f.birth} onChangeText={set('birth')} placeholder="2004-06-30" keyboardType="numbers-and-punctuation" />
          <Row>
            <Field label={`Height (${L})`} value={f.height} onChangeText={set('height')} keyboardType="decimal-pad" style={{ flex: 1 }} />
            <Field label={`Weight (${u.w})`} value={f.weight} onChangeText={set('weight')} keyboardType="decimal-pad" style={{ flex: 1 }} />
          </Row>
          <Row>
            <Field label={`Waist (${L})`} value={f.waist} onChangeText={set('waist')} keyboardType="decimal-pad" style={{ flex: 1 }} />
            <Field label={`Neck (${L})`} value={f.neck} onChangeText={set('neck')} keyboardType="decimal-pad" style={{ flex: 1 }} />
          </Row>
          <Row>
            {sex === 'female' && <Field label={`Hip (${L})`} value={f.hip} onChangeText={set('hip')} keyboardType="decimal-pad" style={{ flex: 1 }} />}
            <Field label="Body fat % (if known)" value={f.bf} onChangeText={set('bf')} keyboardType="decimal-pad" style={{ flex: 1 }} />
          </Row>
          <Txt v="caption" color="muted">Waist and neck let Plasma estimate body fat when you don't know it.</Txt>
        </Card>
      </Section>
      <Section title="Goal">
        <Chips>
          {(Object.keys(GOAL_LABEL) as Goal[]).map((g) => <Chip key={g} label={GOAL_LABEL[g]} on={goal === g} onPress={() => setGoal(g)} />)}
        </Chips>
        <Card style={{ gap: space.m }}>
          <Txt v="heading">Body-fat target (optional)</Txt>
          <Row>
            <Field label="Target body fat %" value={f.targetBf} onChangeText={set('targetBf')} keyboardType="decimal-pad" placeholder="e.g. 15" style={{ flex: 1 }} />
            <Field label="In weeks" value={f.weeks} onChangeText={set('weeks')} keyboardType="decimal-pad" placeholder="12" style={{ flex: 1 }} />
          </Row>
          <Txt v="caption" color="muted">Any target and timeline work. Plasma sets the calories to hit it.</Txt>
        </Card>
      </Section>
      <Section title="Daily activity outside the gym">
        <Chips>
          {ACTIVITY.map((a) => <Chip key={a.factor} label={a.label} on={activity === a.factor} onPress={() => setActivity(a.factor)} />)}
        </Chips>
      </Section>
      <Button title="Next: build my training week" icon="arrow-right" disabled={!ready} loading={busy} onPress={finish} />
      {!ready && <Txt v="caption" color="muted">Birth date, height and weight are needed.</Txt>}
    </Screen>
  );
}
