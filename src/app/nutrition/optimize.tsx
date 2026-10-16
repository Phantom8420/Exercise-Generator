import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { currentTarget, foodsInCategory, getPlan, mealsFor, updateMealItem, type Food, type MealItem } from '../../db/repo/nutrition';
import { weekdayOf, today } from '../../domain/dates';
import { maximizeProtein, suggestSwaps, type MenuItem } from '../../domain/optimizer';
import { WEEKDAYS } from '../../domain/types';
import { BigNumber, Button, Card, Chip, Chips, Divider, Empty, Field, Formula, Gate, ListRow, Row, Screen, Section, Stat, Txt } from '../../ui/kit';
import { space } from '../../ui/theme';
import { useData, useWrite } from '../../ui/useData';

const r = Math.round;
const num = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export default function Optimize() {
  const params = useLocalSearchParams<{ plan: string; day?: string }>();
  const state = useData(async (db) => {
    const plan = await getPlan(db, Number(params.plan));
    if (!plan) throw new Error('Plan not found.');
    const target = await currentTarget(db);
    const cats = [...new Set(plan.meals.flatMap((m) => m.items.map((i) => i.food?.category)).filter((c): c is string => !!c))];
    const pool = (await Promise.all(cats.map((c) => foodsInCategory(db, c)))).flat();
    return { plan, target, pool };
  }, [params.plan]);
  return (
    <Screen back title="Maximize protein">
      <Gate state={state}>{(d) => <Body {...d} initialDay={params.day != null ? Number(params.day) : weekdayOf(today())} />}</Gate>
    </Screen>
  );
}

function Body({ plan, target, pool, initialDay }: {
  plan: NonNullable<Awaited<ReturnType<typeof getPlan>>>;
  target: { kcal: number } | null;
  pool: Food[];
  initialDay: number;
}) {
  const write = useWrite();
  const dated = plan.meals.some((m) => m.weekday != null);
  const [day, setDay] = useState(initialDay);
  const items: MealItem[] = mealsFor(plan, day).flatMap((m) => m.items).filter((i) => i.food);
  const [budget, setBudget] = useState(String(target?.kcal ?? 2200));
  const [bounds, setBounds] = useState<Record<number, { min: string; max: string }>>({});
  const bound = (i: MealItem) => bounds[i.id] ?? { min: '0', max: String(r(i.grams * 2)) };

  const menu: MenuItem[] = items.map((i) => ({
    key: String(i.id),
    name: i.food!.name,
    category: i.food!.category,
    kcalPer100: i.food!.kcal,
    proteinPer100: i.food!.protein,
    grams: i.grams,
    minG: num(bound(i).min) ?? 0,
    maxG: num(bound(i).max) ?? i.grams,
  }));
  const kcalBudget = num(budget) ?? 0;
  const result = useMemo(() => maximizeProtein(menu, kcalBudget), [JSON.stringify(menu), kcalBudget]); // eslint-disable-line react-hooks/exhaustive-deps
  const before = menu.reduce((s, m) => ({ kcal: s.kcal + (m.kcalPer100 * m.grams) / 100, protein: s.protein + (m.proteinPer100 * m.grams) / 100 }), { kcal: 0, protein: 0 });
  const candidates = pool.map((f) => ({ key: `f${f.id}`, name: f.name, category: f.category, kcalPer100: f.kcal, proteinPer100: f.protein }));

  const apply = () => write(async (db) => {
    for (const i of items) await updateMealItem(db, i.id, { grams: result.grams[String(i.id)] });
  }).then(() => router.back());

  return (
    <>
      {dated && (
        <Chips>
          {WEEKDAYS.map((w, i) => <Chip key={w} label={w} on={day === i} onPress={() => setDay(i)} />)}
        </Chips>
      )}
      {items.length === 0 ? (
        <Empty icon="slash" title="Nothing to optimize" body="This day has no matched foods. Fix matches in the plan first." />
      ) : (
        <>
          <Card tone="invert" style={{ padding: space.xl, gap: space.m }}>
            <Txt v="label" color="onInvert" style={{ opacity: 0.7 }}>Protein, optimized</Txt>
            <BigNumber value={String(r(result.protein))} unit="g" color="onInvert" />
            <Txt color="onInvert" num>{r(result.kcal)} kcal · was {r(before.protein)} g protein at {r(before.kcal)} kcal</Txt>
          </Card>
          <Field label="Calorie budget" suffix="kcal" value={budget} onChangeText={setBudget} keyboardType="number-pad" />
          {result.overBudgetAtMinimum && <Txt color="muted">Minimum portions alone exceed the budget, so every item stays at its minimum.</Txt>}

          <Section title="Portions">
            {items.map((i) => {
              const b = bound(i);
              const g = result.grams[String(i.id)];
              return (
                <Card key={i.id}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Txt v="heading" style={{ flex: 1 }}>{i.food!.name}</Txt>
                    <Txt v="label" color={g !== i.grams ? 'accentText' : 'muted'} num>{r(i.grams)} → {r(g)} g</Txt>
                  </Row>
                  <Row>
                    <Field label="Min" suffix="g" value={b.min} onChangeText={(min) => setBounds({ ...bounds, [i.id]: { ...b, min } })} keyboardType="decimal-pad" style={{ flex: 1 }} />
                    <Field label="Max" suffix="g" value={b.max} onChangeText={(max) => setBounds({ ...bounds, [i.id]: { ...b, max } })} keyboardType="decimal-pad" style={{ flex: 1 }} />
                  </Row>
                </Card>
              );
            })}
            <Button title="Apply portions to plan" icon="check" onPress={apply} />
          </Section>

          <Section title="Why">
            <Formula text="Maximize Σ protein(g) subject to Σ kcal ≤ budget and min ≤ grams ≤ max. With one budget, filling the best protein-per-kcal item first is optimal." />
            {result.trace.length === 0 ? (
              <Txt color="muted">No room above the minimums.</Txt>
            ) : (
              <Card>
                {result.trace.map((t, k) => (
                  <View key={t.key}>
                    {k > 0 && <Divider />}
                    <ListRow title={`${t.name}: ${r(t.fromG)} → ${t.toG} g`} subtitle={`+${t.deltaProtein} g protein, +${t.deltaKcal} kcal. ${t.reason}.`} />
                  </View>
                ))}
              </Card>
            )}
          </Section>

          <Section title="Better swaps">
            {menu.map((m) => {
              const swaps = suggestSwaps(m, candidates);
              if (!swaps.length) return null;
              return (
                <Card key={m.key}>
                  <Txt v="heading">Instead of {m.name}</Txt>
                  {swaps.map((s) => (
                    <Txt key={s.key} color="muted" num>{s.name}: {s.grams} g for the same kcal, +{s.proteinGain} g protein</Txt>
                  ))}
                </Card>
              );
            })}
            <Txt v="caption" color="muted">Swaps compare foods in the same category. Change a food from the plan screen.</Txt>
          </Section>
        </>
      )}
    </>
  );
}
