import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { activeEquipment } from '../../db/repo/core';
import { allExercises, getExercise, updateMistakes } from '../../db/repo/exercises';
import { recentSetsFor } from '../../db/repo/workouts';
import { findSubstitutes } from '../../domain/substitutes';
import { ExerciseDemo } from '../../media/ExerciseDemo';
import { cap, fmtDate, useUnits } from '../../ui/format';
import { Button, Card, Chips, Empty, Field, Gate, IconButton, ListRow, Row, Screen, Section, Tag, Txt } from '../../ui/kit';
import { space, useTheme } from '../../ui/theme';
import { useData, useWrite } from '../../ui/useData';

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const u = useUnits();
  const write = useWrite();
  const [mistake, setMistake] = useState('');
  const state = useData(async (db) => {
    const ex = await getExercise(db, id);
    if (!ex) throw new Error('This exercise no longer exists.');
    const [pool, equipment, recent] = await Promise.all([allExercises(db), activeEquipment(db), recentSetsFor(db, id)]);
    return { ex, subs: findSubstitutes(ex, pool, new Set(['body only', ...equipment])), recent };
  }, [id]);

  return (
    <Screen back title={state.data?.ex.name ?? ''}>
      <Gate state={state}>
        {({ ex, subs, recent }) => (
          <>
            <ExerciseDemo exercise={ex} />
            <Chips>
              {ex.primary.map((m) => <Tag key={m} label={cap(m)} strong />)}
              {ex.secondary.map((m) => <Tag key={m} label={cap(m)} />)}
            </Chips>
            <Card>
              <Row>
                {[['Equipment', ex.equipment], ['Level', ex.level], ['Type', ex.mechanic ?? '—'], ['Force', ex.force ?? '—']].map(([k, v]) => (
                  <View key={k} style={{ flex: 1, gap: 2 }}>
                    <Txt v="caption" color="muted">{k}</Txt>
                    <Txt v="label">{cap(v)}</Txt>
                  </View>
                ))}
              </Row>
            </Card>

            <Section title="How to do it">
              <Card>
                {ex.instructions.length === 0 && <Txt color="muted">No written instructions for this one.</Txt>}
                {ex.instructions.map((step, i) => (
                  <Row key={i} gap={space.m} style={{ alignItems: 'flex-start' }}>
                    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}>
                      <Txt v="caption" num>{i + 1}</Txt>
                    </View>
                    <Txt style={{ flex: 1 }}>{step}</Txt>
                  </Row>
                ))}
              </Card>
            </Section>

            <Section title="Common mistakes">
              <Card>
                {ex.mistakes.length === 0 && <Txt color="muted">The dataset doesn't list any. Add the ones you catch yourself making.</Txt>}
                {ex.mistakes.map((m, i) => (
                  <Row key={i}>
                    <Txt style={{ flex: 1 }}>{m}</Txt>
                    <IconButton icon="x" label={`Remove "${m}"`} tone="plain" onPress={() => write((db) => updateMistakes(db, ex.id, ex.mistakes.filter((_, j) => j !== i)))} />
                  </Row>
                ))}
                <Row style={{ alignItems: 'flex-end' }}>
                  <Field label="Add a mistake" value={mistake} onChangeText={setMistake} placeholder="Elbows flaring out" style={{ flex: 1 }} />
                  <Button
                    small
                    kind="secondary"
                    title="Add"
                    disabled={!mistake.trim()}
                    onPress={() => write((db) => updateMistakes(db, ex.id, [...ex.mistakes, mistake.trim()])).then(() => setMistake(''))}
                    style={{ minHeight: 52 }}
                  />
                </Row>
              </Card>
            </Section>

            <Section title="Substitutes">
              <Card>
                {subs.length === 0 ? (
                  <Txt color="muted">No substitute with your current equipment trains the same muscle.</Txt>
                ) : (
                  subs.map((s) => (
                    <ListRow key={s.id} title={s.name} subtitle={`${cap(s.equipment)} · ${cap(s.level)}`} onPress={() => router.push(`/exercise/${encodeURIComponent(s.id)}`)} />
                  ))
                )}
              </Card>
            </Section>

            <Section title="Your history">
              {recent.length === 0 ? (
                <Card>
                  <Empty icon="clock" title="Not logged yet" />
                </Card>
              ) : (
                <Card>
                  {recent.map((s) => (
                    <Row key={s.id} style={{ justifyContent: 'space-between', minHeight: 36 }}>
                      <Txt v="label" color="muted">{fmtDate(s.day)}</Txt>
                      <Txt v="label" num>{s.weightKg > 0 ? `${u.weight(s.weightKg)} × ${s.reps}` : `${s.reps} reps`}</Txt>
                    </Row>
                  ))}
                </Card>
              )}
            </Section>
          </>
        )}
      </Gate>
    </Screen>
  );
}
