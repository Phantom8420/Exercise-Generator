import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  activePlan, clearMealLog, currentTarget, deleteFoodLog, dishKey, dishLogFor, foodLogFor, learnedDishes, logDishes, logMeal, mealsFor, skipMeal, totals,
  type DishEntry, type Meal, type MealItem,
} from '../../db/repo/nutrition';
import { today, weekdayOf } from '../../domain/dates';
import { portionScale } from '../../domain/optimizer';
import { BigNumber, Button, Card, Divider, Empty, Field, Gate, IconButton, ListRow, ProgressBar, Row, Screen, Section, Stat, Txt } from '../../ui/kit';
import { space } from '../../ui/theme';
import { useData, useWrite } from '../../ui/useData';

const r = Math.round;
type Learned = Map<string, { kcal: number; protein: number }>;

/** Best guess for a dish before its calories are revealed: last revealed value, else the food match. */
function estimate(i: MealItem, learned: Learned) {
  const k = learned.get(dishKey(i.rawText));
  if (k) return k;
  return i.food ? { kcal: (i.food.kcal * i.grams) / 100, protein: (i.food.protein * i.grams) / 100 } : { kcal: 0, protein: 0 };
}

export default function Nutrition() {
  const write = useWrite();
  const day = today();
  const state = useData(async (db) => {
    const [target, plan, log, dishes, learned] = await Promise.all([currentTarget(db), activePlan(db), foodLogFor(db, day), dishLogFor(db, day), learnedDishes(db)]);
    return { target, plan, log, dishes, learned };
  }, [day]);

  return (
    <Screen title="Nutrition" right={<IconButton icon="upload" label="Import menu" onPress={() => router.push('/nutrition/import')} />}>
      <Gate state={state}>
        {({ target, plan, log, dishes, learned }) => {
          const t = totals(log);
          for (const d of dishes) {
            t.kcal += d.kcal;
            t.protein += d.protein;
          }
          const meals = plan ? mealsFor(plan, weekdayOf(day)) : [];
          const loggedItems = new Set(log.map((e) => e.mealItemId));
          const dishMeals = new Set(dishes.map((d) => d.mealId));
          const isDone = (m: Meal) => dishMeals.has(m.id) || (m.items.length > 0 && m.items.every((i) => loggedItems.has(i.id)));
          const upcoming = meals.filter((m) => !isDone(m)).reduce((s, m) => s + m.items.reduce((a, i) => a + estimate(i, learned).kcal, 0), 0);
          const scale = target ? portionScale(target.kcal - t.kcal, upcoming) : null;
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
              {target && scale != null && Math.abs(scale - 1) > 0.05 && (
                <Card>
                  <Txt v="heading">{scale < 1 ? `Eat about ${r(scale * 100)}% portions` : `Room for ${r(scale * 100)}% portions`}</Txt>
                  <Txt v="caption" color="muted">{r(target.kcal - t.kcal)} kcal left today; the meals still ahead look like ~{r(upcoming)} kcal.</Txt>
                </Card>
              )}

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
                  {meals.map((m) => (
                    <MealCard
                      key={m.id}
                      meal={m}
                      learned={learned}
                      done={isDone(m)}
                      eaten={dishes.filter((d) => d.mealId === m.id)}
                      onOptimize={() => router.push(`/nutrition/optimize?plan=${plan.id}&day=${weekdayOf(day)}`)}
                    />
                  ))}
                </Section>
              )}

              <Section title="Log">
                {log.length + dishes.length === 0 ? (
                  <Txt color="muted">Nothing logged today.</Txt>
                ) : (
                  <Card>
                    {dishes.map((d, i) => (
                      <View key={`d${d.id}`}>
                        {i > 0 && <Divider />}
                        <ListRow title={d.name} subtitle={d.name === 'Skipped' ? 'Meal skipped' : `${r(d.kcal)} kcal · ~${r(d.protein)} g protein`} />
                      </View>
                    ))}
                    {log.map((e, i) => (
                      <View key={e.id}>
                        {(i > 0 || dishes.length > 0) && <Divider />}
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

function MealCard({ meal, learned, done, eaten, onOptimize }: { meal: Meal; learned: Learned; done: boolean; eaten: DishEntry[]; onOptimize: () => void }) {
  const write = useWrite();
  const day = today();
  const [entering, setEntering] = useState(false);
  const [kcal, setKcal] = useState<Record<number, string>>({});
  const est = meal.items.map((i) => estimate(i, learned));
  const estKcal = est.reduce((s, e) => s + e.kcal, 0);
  const estProtein = est.reduce((s, e) => s + e.protein, 0);
  const skipped = eaten.length === 1 && eaten[0].name === 'Skipped';

  const save = () =>
    write(async (db) => {
      const dishes = meal.items.flatMap((i, n) => {
        const k = parseFloat((kcal[i.id] ?? '').replace(',', '.'));
        if (!Number.isFinite(k)) return [];
        // Only kcal is revealed; protein follows the estimate's ratio.
        const protein = est[n].kcal > 0 ? (est[n].protein * k) / est[n].kcal : 0;
        return [{ mealItemId: i.id, name: i.rawText, kcal: k, protein }];
      });
      if (dishes.length) await logDishes(db, day, meal.id, dishes);
      setEntering(false);
      setKcal({});
    });

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt v="heading">{meal.label}</Txt>
        <Txt v="label" color="muted" num>
          {skipped ? 'Skipped' : eaten.length ? `${r(eaten.reduce((s, d) => s + d.kcal, 0))} kcal eaten` : `~${r(estKcal)} kcal · ${r(estProtein)} g protein`}
        </Txt>
      </Row>
      {entering ? (
        <View style={{ gap: space.s }}>
          <Txt v="caption" color="muted">Type the calories shown at the counter. Leave a dish blank if you skipped it.</Txt>
          {meal.items.map((i, n) => (
            <Field
              key={i.id}
              label={i.rawText}
              suffix="kcal"
              value={kcal[i.id] ?? ''}
              onChangeText={(v) => setKcal({ ...kcal, [i.id]: v })}
              placeholder={est[n].kcal ? `~${r(est[n].kcal)}` : ''}
              keyboardType="decimal-pad"
            />
          ))}
          <Row>
            <Button small icon="check" title="Save" onPress={save} />
            <Button small kind="ghost" title="Cancel" onPress={() => setEntering(false)} />
          </Row>
        </View>
      ) : (
        <>
          <Txt v="caption" color="muted">{meal.items.map((i) => i.food?.name ?? i.rawText).join(', ')}</Txt>
          {done ? (
            eaten.length > 0 && <Button small kind="ghost" icon="rotate-ccw" title="Undo" onPress={() => write((db) => clearMealLog(db, day, meal.id))} />
          ) : (
            <Row style={{ flexWrap: 'wrap' }}>
              <Button small icon="edit-3" title="Enter calories" onPress={() => setEntering(true)} />
              <Button small kind="secondary" icon="check" title="Log estimate" onPress={() => write((db) => logMeal(db, day, meal))} />
              <Button small kind="ghost" title="Skip" onPress={() => write((db) => skipMeal(db, day, meal.id))} />
              <Button small kind="ghost" icon="zap" title="Optimize" onPress={onOptimize} />
            </Row>
          )}
        </>
      )}
    </Card>
  );
}
