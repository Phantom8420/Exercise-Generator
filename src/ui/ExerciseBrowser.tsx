import { useState } from 'react';
import { FlatList, ScrollView, View } from 'react-native';
import { activeEquipment } from '../db/repo/core';
import { listExercises } from '../db/repo/exercises';
import { MUSCLES, type Exercise, type Muscle } from '../domain/types';
import { ExerciseThumb } from '../media/ExerciseDemo';
import { cap } from './format';
import { Chip, Empty, Field, ListRow, Loading, ErrorView } from './kit';
import { space } from './theme';
import { useData } from './useData';

/** Search + muscle filter + "my equipment" toggle over the exercise library. */
export function ExerciseBrowser({ onSelect, initialMuscle }: { onSelect: (ex: Exercise) => void; initialMuscle?: Muscle | null }) {
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<Muscle | null>(initialMuscle ?? null);
  const [mine, setMine] = useState(true);
  const state = useData(async (db) => listExercises(db, { q, muscle, equipment: mine ? await activeEquipment(db) : null, limit: 300 }), [q, muscle, mine]);

  return (
    <View style={{ flex: 1, gap: space.m }}>
      <Field label="Search" placeholder="Bench press, squat, curl…" value={q} onChangeText={setQ} autoCorrect={false} returnKeyType="search" clearButtonMode="while-editing" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.s }} style={{ flexGrow: 0 }}>
        <Chip label="My equipment" icon="tool" on={mine} onPress={() => setMine(!mine)} />
        {MUSCLES.map((m) => (
          <Chip key={m} label={cap(m)} on={muscle === m} onPress={() => setMuscle(muscle === m ? null : m)} />
        ))}
      </ScrollView>
      {state.error ? (
        <ErrorView error={state.error} />
      ) : !state.data ? (
        <Loading />
      ) : (
        <FlatList
          data={state.data}
          keyExtractor={(e) => e.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 120 }}
          initialNumToRender={14}
          ListEmptyComponent={
            <Empty icon="search" title="No matches" body={mine ? 'Try turning off "My equipment" or clearing the muscle filter.' : 'Try a shorter search.'} />
          }
          renderItem={({ item }) => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
              <ExerciseThumb exercise={item} />
              <View style={{ flex: 1 }}>
                <ListRow title={item.name} subtitle={`${cap(item.primary[0])} · ${cap(item.equipment)} · ${cap(item.level)}`} onPress={() => onSelect(item)} />
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}
