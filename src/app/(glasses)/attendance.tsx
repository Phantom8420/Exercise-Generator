import { Empty, Screen } from '../../ui/kit';

export default function Attendance() {
  return (
    <Screen title="Attendance" glow>
      <Empty icon="check-square" title="Coming next" body="Per-course attendance against your threshold." />
    </Screen>
  );
}
