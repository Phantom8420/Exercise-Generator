import { router } from 'expo-router';
import { View } from 'react-native';
import { activePlan, currentTarget, deleteFoodLog, foodLogFor, logMeal, mealsFor, totals } from '../../db/repo/nutrition';
import { today, weekdayOf } from '../../domain/dates';
import { BigNumber, Button, Card, Divider, Empty, Gate, IconButton, ListRow, ProgressBar, Row, Screen, Section, Stat, Txt } from '../../ui/kit';
import { space } from '../../ui/theme';
import { useData, useWrite } from '../../ui/useData';

const r = Math.round;

export default function Nutrition() {
  const write = useWrite();
  const day = today();
  const state = useData(async (db) => {
    const [target, plan, log] = await Promise.all([currentTarget(db), activePlan(db), foodLogFor(db, day)]);
    return { target, plan, log };
  }, [day]);

  return (
    <Screen title="Nutrition" right={<IconButton icon="upload" label="Import menu" onPress={() => router.push('/nutrition/import')} />}>
      <Gate state={state}>
        {({ target, plan, log }) => {
          const t = totals(log);
          const meals = plan ? mealsFor(plan, weekdayOf(day)) : [];
          const loggedItems = new Set(log.map((e) => e.mealItemId));
          return (
            <>
              <Card tone="invert" style={{ padding: space.xl, gap: space.m }}>
                <Txt v="label" color="onInvert" style={{ opacity: 0.7 }}>{target ? `Eaten today of ${target.kcal} kcal` : 'Eaten today'}</Txt>
                <BigNumber value={String(r(t.kcal))} unit="kcal" color="onInvert" />
                {target && <ProgressBar pct={t.kcal / target.kcal} />}
              </Card>
              <Card>
                <Row>
                  <Stat label={target ? `Protein / ${target.proteinG} g` : 'Protein'} value={String(r(t.protein))} unit="g" />
                  <Stat label="Carbs" value={String(r(t.carbs))} unit="g" />
                  <Stat label="Fat" value={String(r(t.fat))} unit="g" />
                </Row>
                {target && <ProgressBar pct={t.protein / target.proteinG} color="series2" />}
                {!target && <Button small kind="ghost" title="Set a target from body metrics" onPress={() => router.push('/metrics')} />}
              </Card>

              {!plan ? (
                <Empty
                  icon="file-text"
                  title="No meal plan"
                  body="Paste or upload your menu. Any pattern works: one meal a day, six, or different every day."
                  action={<Button title="Import menu" icon="upload" onPress={() => router.push('/nutrition/import')} />}
                />
              ) : (
                <Section title={`Today from ${plan.name}`} action={<Button small kind="ghost" title="Plan" onPress={() => router.push(`/nutrition/plan?id=${plan.id}`)} />}>
                  {meals.length === 0 && <Txt color="muted">No meals in this plan for today.</Txt>}
                  {meals.map((m) => {
                    const mt = totals(m.items);
                    const done = m.items.length > 0 && m.items.every((i) => loggedItems.has(i.id));
                    return (
                      <Card key={m.id}>
                        <Row style={{ justifyContent: 'space-between' }}>
                          <Txt v="heading">{m.label}</Txt>
                          <Txt v="label" color="muted" num>{r(mt.kcal)} kcal · {r(mt.protein)} g protein</Txt>
                        </Row>
                        <Txt v="caption" color="muted">{m.items.map((i) => i.food?.name ?? i.rawText).join(', ')}</Txt>
                        <Row>
                          <Button small kind={done ? 'secondary' : 'primary'} icon="check" title={done ? 'Logged' : 'Log meal'} disabled={done} onPress={() => write((db) => logMeal(db, day, m))} />
                          <Button small kind="ghost" icon="zap" title="Optimize" onPress={() => router.push(`/nutrition/optimize?plan=${plan.id}&day=${weekdayOf(day)}`)} />
                        </Row>
                      </Card>
                    );
                  })}
                </Section>
              )}

              <Section title="Log">
                {log.length === 0 ? (
                  <Txt color="muted">Nothing logged today.</Txt>
                ) : (
                  <Card>
                    {log.map((e, i) => (
                      <View key={e.id}>
                        {i > 0 && <Divider />}
                        <ListRow
                          title={e.food.name}
                          subtitle={`${r(e.grams)} g · ${r((e.food.kcal * e.grams) / 100)} kcal · ${r((e.food.protein * e.grams) / 100)} g protein`}
                          right={<IconButton icon="trash-2" tone="plain" label={`Remove ${e.food.name}`} onPress={() => write((db) => deleteFoodLog(db, e.id))} />}
                        />
                      </View>
                    ))}
                  </Card>
                )}
              </Section>
            </>
          );
        }}
      </Gate>
    </Screen>
  );
}
