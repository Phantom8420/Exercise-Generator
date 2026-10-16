import { router } from 'expo-router';
import { ExerciseBrowser } from '../../ui/ExerciseBrowser';
import { Screen } from '../../ui/kit';

export default function Library() {
  return (
    <Screen title="Library" scroll={false}>
      <ExerciseBrowser onSelect={(ex) => router.push(`/exercise/${encodeURIComponent(ex.id)}`)} />
    </Screen>
  );
}
