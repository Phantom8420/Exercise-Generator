import { useLocalSearchParams } from 'expo-router';
import { MUSCLES, type Muscle } from '../domain/types';
import { resolvePick } from '../state/pick';
import { ExerciseBrowser } from '../ui/ExerciseBrowser';
import { Screen } from '../ui/kit';

export default function Pick() {
  const { muscle } = useLocalSearchParams<{ muscle?: string }>();
  const initial = MUSCLES.includes(muscle as Muscle) ? (muscle as Muscle) : null;
  return (
    <Screen title="Choose exercise" back scroll={false}>
      <ExerciseBrowser onSelect={resolvePick} initialMuscle={initial} />
    </Screen>
  );
}
