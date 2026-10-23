import { Empty, Screen } from '../../ui/kit';

export default function Money() {
  return (
    <Screen title="Money" glow>
      <Empty icon="credit-card" title="Coming next" body="Spending, budgets and recurring payments." />
    </Screen>
  );
}
