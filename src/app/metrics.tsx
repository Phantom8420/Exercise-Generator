import { useState } from 'react';
import { View } from 'react-native';
import { addBodyMetric, deleteBodyMetric, getUser, listBodyMetrics, updateUser, type User } from '../db/repo/core';
import { setTarget } from '../db/repo/nutrition';
import { today } from '../domain/dates';
import {
  ACTIVITY, ageFrom, bmi, calorieTarget, DEFAULT_PACE_KG_PER_WEEK, mifflinStJeor, movingAverage, navyBodyFat, proteinTarget, tdee, type Result,
} from '../domain/metrics';
import { GOAL_LABEL, type Goal } from '../domain/types';
import { displayLength, displayWeight, lengthUnit, round, storeLength, storeWeight } from '../domain/units';
import { LineChart } from '../ui/charts';
import { fmtDate, useUnits } from '../ui/format';
import { BigNumber, Button, Card, Chip, Chips, Divider, Field, Formula, Gate, IconButton, ListRow, Row, Screen, Section, Segmented, Txt } from '../ui/kit';
import { space } from '../ui/theme';
import { useData, useWrite } from '../ui/useData';

const num = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export default function Metrics() {
  const state = useData(async (db) => {
    const [user, entries] = await Promise.all([getUser(db), listBodyMetrics(db)]);
    return { user, entries };
  });
  return (
    <Screen back title="Body metrics">
      <Gate state={state}>{(d) => <Body {...d} />}</Gate>
    </Screen>
  );
}

function Body({ user, entries }: { user: User; entries: Awaited<ReturnType<typeof listBodyMetrics>> }) {
  const u = useUnits();
  const write = useWrite();
  const L = lengthUnit(u.units);
  const save = (patch: Partial<User>) => write((db) => updateUser(db, patch));

  const weights = entries.filter((e) => e.weightKg != null);
  const latestKg = weights.at(-1)?.weightKg ?? null;
  const avg = movingAverage(weights.map((e) => e.weightKg!), 7);
  const lastMeasures = [...entries].reverse().find((e) => e.waistCm != null && e.neckCm != null);
  const lastManualBf = [...entries].reverse().find((e) => e.bodyFatSource === 'manual');

  const results: { title: string; r: Result | null; unit: string; note?: string }[] = [];
  if (latestKg && user.heightCm) {
    results.push({ title: 'BMI', r: bmi(latestKg, user.heightCm), unit: '', note: 'Crude: it ignores muscle, so lifters often read as "overweight".' });
    if (lastMeasures) results.push({ title: 'Body fat (Navy)', r: navyBodyFat(user.sex, user.heightCm, lastMeasures.waistCm!, lastMeasures.neckCm!, lastMeasures.hipCm ?? undefined), unit: '%' });
    if (user.birthDate) {
      const bmr = mifflinStJeor(user.sex, latestKg, user.heightCm, ageFrom(user.birthDate));
      const t = tdee(bmr.value, user.activityFactor);
      const pace = user.paceKgWeek ?? DEFAULT_PACE_KG_PER_WEEK[user.goal];
      results.push({ title: 'BMR', r: bmr, unit: 'kcal' });
      results.push({ title: 'TDEE', r: t, unit: 'kcal' });
      results.push({ title: 'Calorie target', r: calorieTarget(t.value, pace), unit: 'kcal' });
    }
    results.push({ title: 'Protein target', r: proteinTarget(latestKg, user.goal), unit: 'g' });
  }
  const kcal = results.find((x) => x.title === 'Calorie target')?.r?.value;
  const protein = results.find((x) => x.title === 'Protein target')?.r?.value;

  return (
    <>
      <Card tone="invert" style={{ padding: space.xl }}>
        <Txt v="label" color="onInvert" style={{ opacity: 0.7 }}>Weight{avg.length ? ` · 7-day average ${displayWeight(avg.at(-1)!, u.units)} ${u.w}` : ''}</Txt>
        {latestKg != null ? <BigNumber value={String(displayWeight(latestKg, u.units))} unit={u.w} color="onInvert" /> : <Txt v="heading" color="onInvert">No weigh-ins yet</Txt>}
      </Card>
      {weights.length > 1 && (
        <Card>
          <LineChart
            label="Weight over time with 7-day average"
            series={[
              { values: weights.map((e) => displayWeight(e.weightKg!, u.units)), color: 'accent', dots: true, width: 2 },
              { values: avg.map((v) => displayWeight(v, u.units)), color: 'series2', width: 3 },
            ]}
          />
          <Row gap={space.l}>
            <Txt v="caption" color="accentText">Weigh-ins</Txt>
            <Txt v="caption" color="muted">7-day average (blue)</Txt>
          </Row>
        </Card>
      )}

      <NewEntry sex={user.sex} />

      {results.length > 0 && (
        <Section title="Numbers">
          {results.map(({ title, r, unit, note }) => (
            <Card key={title}>
              <Row style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Txt v="heading">{title}</Txt>
                <Txt v="title" num>{r ? `${round(r.value, unit === '' ? 1 : 0)}${unit === '%' ? '%' : ''}` : '—'}{unit && unit !== '%' ? <Txt v="label" color="muted"> {unit}</Txt> : null}</Txt>
              </Row>
              {note && <Txt v="caption" color="muted">{note}</Txt>}
              {r ? <Formula text={r.formula} /> : <Txt v="caption" color="muted">These measurements don't give a valid result.</Txt>}
            </Card>
          ))}
          {kcal != null && protein != null && (
            <Button
              title="Use as my nutrition target"
              icon="target"
              onPress={() => write((db) => setTarget(db, today(), { kcal: Math.round(kcal), proteinG: Math.round(protein), carbsG: null, fatG: null, source: 'tdee' }))}
            />
          )}
        </Section>
      )}
      {results.length === 0 && <Txt color="muted">Add your height and a weigh-in to see BMI and protein; add a birth date for BMR, TDEE and a calorie target.</Txt>}
      {lastManualBf && <Txt v="caption" color="muted">Last manual body fat: {lastManualBf.bodyFatPct}% on {fmtDate(lastManualBf.measuredOn)}</Txt>}

      <Section title="About you">
        <Card style={{ gap: space.m }}>
          <Field label="Name" defaultValue={user.name ?? ''} onEndEditing={(e) => save({ name: e.nativeEvent.text.trim() || null })} />
          <Segmented label="Sex" value={user.sex} onChange={(sex) => save({ sex })} options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
          <Field label="Birth date (YYYY-MM-DD)" defaultValue={user.birthDate ?? ''} placeholder="1995-06-30" keyboardType="numbers-and-punctuation" onEndEditing={(e) => {
            const v = e.nativeEvent.text.trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(v) || !v) save({ birthDate: v || null });
          }} />
          <Field label={`Height (${L})`} keyboardType="decimal-pad" defaultValue={user.heightCm ? String(displayLength(user.heightCm, u.units)) : ''} onEndEditing={(e) => {
            const v = num(e.nativeEvent.text);
            save({ heightCm: v ? storeLength(v, u.units) : null });
          }} />
          <Txt v="label" color="muted">Activity</Txt>
          <Chips>
            {ACTIVITY.map((a) => <Chip key={a.factor} label={a.label} on={user.activityFactor === a.factor} onPress={() => save({ activityFactor: a.factor })} />)}
          </Chips>
          <Txt v="label" color="muted">Goal</Txt>
          <Chips>
            {(Object.keys(GOAL_LABEL) as Goal[]).map((g) => <Chip key={g} label={GOAL_LABEL[g]} on={user.goal === g} onPress={() => save({ goal: g, paceKgWeek: null })} />)}
          </Chips>
          <Field
            label={`Pace (${u.w} per week, negative to lose)`}
            keyboardType="numbers-and-punctuation"
            key={user.goal}
            defaultValue={String(displayWeight(user.paceKgWeek ?? DEFAULT_PACE_KG_PER_WEEK[user.goal], u.units))}
            onEndEditing={(e) => {
              const v = num(e.nativeEvent.text);
              if (v != null) save({ paceKgWeek: storeWeight(v, u.units) });
            }}
          />
          <Txt v="label" color="muted">Recovery capacity (sleep, stress, schedule)</Txt>
          <Segmented label="Recovery" value={user.recovery} onChange={(recovery) => save({ recovery })} options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))} />
        </Card>
      </Section>

      {entries.length > 0 && (
        <Section title="Entries">
          <Card>
            {[...entries].reverse().map((e, i) => (
              <View key={e.id}>
                {i > 0 && <Divider />}
                <ListRow
                  title={fmtDate(e.measuredOn)}
                  subtitle={[
                    e.weightKg != null && u.weight(e.weightKg),
                    e.waistCm != null && `waist ${displayLength(e.waistCm, u.units)} ${L}`,
                    e.bodyFatPct != null && `${e.bodyFatPct}% fat`,
                  ].filter(Boolean).join(' · ')}
                  right={<IconButton icon="trash-2" tone="plain" label="Delete entry" onPress={() => write((db) => deleteBodyMetric(db, e.id))} />}
                />
              </View>
            ))}
          </Card>
        </Section>
      )}
    </>
  );
}

function NewEntry({ sex }: { sex: User['sex'] }) {
  const u = useUnits();
  const write = useWrite();
  const L = lengthUnit(u.units);
  const [f, setF] = useState({ day: today(), weight: '', waist: '', neck: '', hip: '', bf: '' });
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const len = (s: string) => {
    const v = num(s);
    return v ? storeLength(v, u.units) : null;
  };
  const submit = () =>
    write((db) =>
      addBodyMetric(db, {
        measuredOn: f.day,
        weightKg: num(f.weight) != null ? storeWeight(num(f.weight)!, u.units) : null,
        waistCm: len(f.waist),
        neckCm: len(f.neck),
        hipCm: len(f.hip),
        bodyFatPct: num(f.bf),
        bodyFatSource: num(f.bf) != null ? 'manual' : null,
      }),
    ).then(() => setF({ ...f, weight: '', waist: '', neck: '', hip: '', bf: '' }));
  const empty = ![f.weight, f.waist, f.neck, f.hip, f.bf].some((x) => num(x) != null);
  return (
    <Section title="Log a measurement">
      <Card style={{ gap: space.m }}>
        <Row>
          <Field label="Date" value={f.day} onChangeText={set('day')} style={{ flex: 1 }} />
          <Field label={`Weight (${u.w})`} value={f.weight} onChangeText={set('weight')} keyboardType="decimal-pad" style={{ flex: 1 }} />
        </Row>
        <Row>
          <Field label={`Waist (${L})`} value={f.waist} onChangeText={set('waist')} keyboardType="decimal-pad" style={{ flex: 1 }} />
          <Field label={`Neck (${L})`} value={f.neck} onChangeText={set('neck')} keyboardType="decimal-pad" style={{ flex: 1 }} />
        </Row>
        <Row>
          {sex === 'female' && <Field label={`Hip (${L})`} value={f.hip} onChangeText={set('hip')} keyboardType="decimal-pad" style={{ flex: 1 }} />}
          <Field label="Body fat % (manual)" value={f.bf} onChangeText={set('bf')} keyboardType="decimal-pad" style={{ flex: 1 }} />
        </Row>
        <Button title="Save" icon="check" disabled={empty || !/^\d{4}-\d{2}-\d{2}$/.test(f.day)} onPress={submit} />
      </Card>
    </Section>
  );
}
