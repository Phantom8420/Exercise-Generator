import { Empty, Screen } from '../../ui/kit';

export default function Tracker() {
  return (
    <Screen title="Tracker" glow>
      <Empty icon="list" title="Coming next" body="Habits, to-dos, notes and learning." />
    </Screen>
  );
}
