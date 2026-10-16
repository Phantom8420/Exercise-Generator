import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { deleteMealItem, getPlan, searchFoods, updateMealItem, type Food } from '../../../db/repo/nutrition';
import { useDb } from '../../../db/DbProvider';
import { Button, Card, Divider, Field, Gate, ListRow, Row, Screen, Section, Txt } from '../../../ui/kit';
import { useData, useWrite } from '../../../ui/useData';

const r = Math.round;

export default function MealItemScreen() {
  const { id, plan } = useLocalSearchParams<{ id: string; plan: string }>();
  const state = useData(async (db) => {
    const p = await getPlan(db, Number(plan));
    const item = p?.meals.flatMap((m) => m.items).find((i) => i.id === Number(id));
    if (!item) throw new Error('Item not found.');
    return item;
  }, [id, plan]);
  return (
    <Screen back title="Fix match">
      <Gate state={state}>{(item) => <Editor key={item.id} item={item} />}</Gate>
    </Screen>
  );
}

function Editor({ item }: { item: { id: number; rawText: string; grams: number; food: Food | null } }) {
  const db = useDb();
  const write = useWrite();
  const [q, setQ] = useState(item.rawText.replace(/[\d.,]+\s*(g|gr|grams?|kg|oz|lbs?|ml|l)?\b/gi, '').trim());
  const [grams, setGrams] = useState(String(r(item.grams)));
  const [results, setResults] = useState<Food[]>([]);

  useEffect(() => {
    let live = true;
    if (q.trim().length < 2) return setResults([]);
    searchFoods(db, q).then((f) => live && setResults(f));
    return () => {
      live = false;
    };
  }, [db, q]);

  const g = parseFloat(grams.replace(',', '.'));
  const choose = (f: Food) => write((d) => updateMealItem(d, item.id, { foodId: f.id })).then(() => router.back());

  return (
    <>
      <Card>
        <Txt v="caption" color="muted">From your menu</Txt>
        <Txt v="heading">"{item.rawText}"</Txt>
        <Txt color="muted">{item.food ? `Matched: ${item.food.name}` : 'No match yet'}</Txt>
        <Row style={{ alignItems: 'flex-end' }}>
          <Field label="Amount" suffix="g" value={grams} onChangeText={setGrams} keyboardType="decimal-pad" style={{ flex: 1 }} />
          <Button small title="Save" disabled={!(g > 0)} style={{ minHeight: 52 }} onPress={() => write((d) => updateMealItem(d, item.id, { grams: g }))} />
        </Row>
      </Card>
      <Section title="Search foods">
        <Field label="Food" value={q} onChangeText={setQ} placeholder="chicken breast" autoCorrect={false} />
        {results.length > 0 && (
          <Card>
            {results.map((f, i) => (
              <View key={f.id}>
                {i > 0 && <Divider />}
                <ListRow
                  title={f.name}
                  subtitle={`per 100 g: ${r(f.kcal)} kcal · ${f.protein} g protein · ${f.carbs} g carbs · ${f.fat} g fat`}
                  onPress={() => choose(f)}
                />
              </View>
            ))}
          </Card>
        )}
        {q.trim().length >= 2 && results.length === 0 && <Txt color="muted">No foods match "{q}".</Txt>}
      </Section>
      <Button kind="danger" icon="trash-2" title="Remove from plan" onPress={() => write((d) => deleteMealItem(d, item.id)).then(() => router.back())} />
    </>
  );
}
