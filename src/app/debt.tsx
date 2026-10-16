import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { forgiveDebt, listDebts, setDebtCap, type CapMode, type Debt } from '../db/repo/debts';
import { DEFAULT_CAP_FRACTION } from '../domain/debt';
import { displayWeight, storeWeight } from '../domain/units';
import { cap, fmtDate, useUnits } from '../ui/format';
import { BigNumber, Button, Card, Divider, Empty, Field, Gate, ListRow, ProgressBar, Row, Screen, Section, Segmented, Txt } from '../ui/kit';
import { space } from '../ui/theme';
import { useData, useWrite } from '../ui/useData';

export default function DebtScreen() {
  const u = useUnits();
  const state = useData((db) => listDebts(db));
  return (
    <Screen back title="What you owe">
      <Gate state={state}>
        {(debts) => {
          if (!debts.length) {
            return <Empty icon="check-circle" title="Nothing owed" body="Planned work you skip turns into debt here and gets spread over the next days that train the same muscle." />;
          }
          const sum = (m: Debt['metric']) => debts.filter((d) => d.metric === m).reduce((s, d) => s + d.owed - d.repaid, 0);
          const vol = sum('volume');
          const reps = sum('reps');
          return (
            <>
              <Card tone="invert" style={{ padding: space.xl, gap: space.xs }}>
                <Txt v="label" color="onInvert" style={{ opacity: 0.7 }}>Open debt</Txt>
                {vol > 0 && <BigNumber value={u.volume(vol).split(' ')[0]} unit={u.w} color="onInvert" />}
                {reps > 0 && <BigNumber value={String(Math.round(reps))} unit="reps" color="onInvert" size={vol > 0 ? 'title' : 'display'} />}
                <Txt color="onInvert">across {debts.length} {debts.length === 1 ? 'exercise' : 'exercises'}</Txt>
              </Card>
              <Txt v="caption" color="muted">
                Repay by logging the exercise on the days shown, or swap in a substitute from the workout screen; substitutes count at their equivalence factor.
              </Txt>
              {debts.map((d) => <DebtCard key={d.id} d={d} />)}
            </>
          );
        }}
      </Gate>
    </Screen>
  );
}

function DebtCard({ d }: { d: Debt }) {
  const u = useUnits();
  const write = useWrite();
  const vol = d.metric === 'volume';
  const left = d.owed - d.repaid;
  const scheduled = d.allocations.reduce((s, a) => s + a.amount, 0);
  const unscheduled = Math.max(0, left - scheduled);
  const [capText, setCapText] = useState(d.dailyCap != null ? String(vol ? displayWeight(d.dailyCap, u.units) : d.dailyCap) : '');
  const capVal = parseFloat(capText.replace(',', '.'));

  const setMode = (mode: CapMode) => {
    if (mode === 'custom') {
      const v = capVal > 0 ? capVal : vol ? displayWeight(left / 4, u.units) : Math.ceil(left / 4);
      setCapText(String(Math.round(v)));
      write((db) => setDebtCap(db, d.id, 'custom', vol ? storeWeight(v, u.units) : v));
    } else write((db) => setDebtCap(db, d.id, mode));
  };

  return (
    <Card style={{ gap: space.m }}>
      <View>
        <Txt v="heading" onPress={() => router.push(`/exercise/${d.exercise.id}`)}>{d.exercise.name}</Txt>
        <Txt v="caption" color="muted" num>{cap(d.muscle)} · missed {fmtDate(d.createdFor)} · {u.amount(d.repaid, d.metric)} of {u.amount(d.owed, d.metric)} repaid</Txt>
      </View>
      <ProgressBar pct={d.owed > 0 ? d.repaid / d.owed : 0} />

      {d.allocations.length > 0 && (
        <View>
          {d.allocations.map((a, i) => (
            <View key={a.day}>
              {i > 0 && <Divider />}
              <ListRow title={fmtDate(a.day)} right={<Txt v="label" num>{u.amount(a.amount, d.metric)}</Txt>} />
            </View>
          ))}
        </View>
      )}
      {unscheduled > 0 && (
        <Txt v="caption" color="muted" num>
          {u.amount(unscheduled, d.metric)} has no slot in the next 14 days{d.capMode !== 'none' ? ' under the current cap' : ''}. Raise the cap or train {d.muscle} on more days.
        </Txt>
      )}

      <Segmented
        label="Daily repayment cap"
        value={d.capMode}
        onChange={setMode}
        options={[
          { value: 'default', label: `${DEFAULT_CAP_FRACTION * 100}% of day` },
          { value: 'custom', label: 'Custom' },
          { value: 'none', label: 'No cap' },
        ]}
      />
      {d.capMode === 'custom' && (
        <Row style={{ alignItems: 'flex-end' }}>
          <Field label={`Per day (${vol ? u.w : 'reps'})`} value={capText} onChangeText={setCapText} keyboardType="decimal-pad" style={{ flex: 1 }} />
          <Button small title="Set" disabled={!(capVal > 0)} style={{ minHeight: 52 }} onPress={() => write((db) => setDebtCap(db, d.id, 'custom', vol ? storeWeight(capVal, u.units) : capVal))} />
        </Row>
      )}
      <Button small kind="ghost" title="Forgive this debt" onPress={() => write((db) => forgiveDebt(db, d.id))} />
    </Card>
  );
}
