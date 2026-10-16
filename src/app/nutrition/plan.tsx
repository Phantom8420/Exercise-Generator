import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { deletePlan, getPlan, listPlans, setActivePlan, totals } from '../../db/repo/nutrition';
import { WEEKDAYS } from '../../domain/types';
import { Button, Card, Chip, Chips, Divider, Empty, Gate, ListRow, Row, Screen, Section, Tag, Txt } from '../../ui/kit';
import { useData, useWrite } from '../../ui/useData';

const r = Math.round;

export default function Plan() {
  const params = useLocalSearchParams<{ id?: string }>();
  const write = useWrite();
  const state = useData(async (db) => {
    const plans = await listPlans(db);
    const id = params.id ? Number(params.id) : plans.find((p) => p.isActive)?.id ?? plans[0]?.id;
    return { plans, plan: id != null ? await getPlan(db, id) : null };
  }, [params.id]);

  return (
    <Screen back title="Meal plan">
      <Gate state={state}>
        {({ plans, plan }) => {
          if (!plan) return <Empty icon="file-text" title="No meal plans" action={<Button title="Import menu" icon="upload" onPress={() => router.replace('/nutrition/import')} />} />;
          const active = plans.find((p) => p.id === plan.id)?.isActive;
          const days = [...new Set(plan.meals.map((m) => m.weekday))];
          return (
            <>
              {plans.length > 1 && (
                <Chips>
                  {plans.map((p) => <Chip key={p.id} label={p.name} on={p.id === plan.id} onPress={() => router.setParams({ id: String(p.id) })} />)}
                </Chips>
              )}
              <Row>
                {!active && <Button small title="Make active" onPress={() => write((db) => setActivePlan(db, plan.id))} />}
                {active && <Tag label="Active plan" strong />}
                <Button small kind="secondary" icon="zap" title="Optimize" onPress={() => router.push(`/nutrition/optimize?plan=${plan.id}`)} />
              </Row>
              <Txt v="caption" color="muted">Tap an item to change its food match or amount. Low-confidence matches are marked.</Txt>
              {days.map((d) => {
                const meals = plan.meals.filter((m) => m.weekday === d);
                const t = totals(meals.flatMap((m) => m.items));
                return (
                  <Section key={String(d)} title={d == null ? 'Every day' : WEEKDAYS[d]} action={<Txt v="label" color="muted" num>{r(t.kcal)} kcal · {r(t.protein)} g protein</Txt>}>
                    {meals.map((m) => (
                      <Card key={m.id}>
                        <Txt v="heading">{m.label}</Txt>
                        {m.items.map((i, k) => (
                          <View key={i.id}>
                            {k > 0 && <Divider />}
                            <ListRow
                              title={i.food?.name ?? i.rawText}
                              subtitle={i.food ? `${r(i.grams)} g · ${r((i.food.kcal * i.grams) / 100)} kcal · ${r((i.food.protein * i.grams) / 100)} g protein · from "${i.rawText}"` : `No match for "${i.rawText}"`}
                              right={i.confidence < 0.6 ? <Tag label={i.food ? 'Check' : 'Fix'} strong /> : undefined}
                              onPress={() => router.push(`/nutrition/item/${i.id}?plan=${plan.id}`)}
                            />
                          </View>
                        ))}
                      </Card>
                    ))}
                  </Section>
                );
              })}
              <Button
                kind="danger"
                icon="trash-2"
                title="Delete plan"
                onPress={async () => {
                  await write((db) => deletePlan(db, plan.id));
                  router.back();
                }}
              />
            </>
          );
        }}
      </Gate>
    </Screen>
  );
}
