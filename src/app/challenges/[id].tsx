import { router, useLocalSearchParams } from 'expo-router';
import { Share, View } from 'react-native';
import { deleteChallenge, getChallenge } from '../../db/repo/challenges';
import { addDays, daysBetween, today, weekdayOf } from '../../domain/dates';
import { WEEKDAYS } from '../../domain/types';
import { BarChart, HexBadge } from '../../ui/charts';
import { fmtDate, KIND_ICON, KIND_LABEL, useUnits } from '../../ui/format';
import { BigNumber, Button, Card, Gate, ProgressBar, Row, Screen, Stat, Txt } from '../../ui/kit';
import { space } from '../../ui/theme';
import { useData, useWrite } from '../../ui/useData';

export default function ChallengeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const u = useUnits();
  const write = useWrite();
  const state = useData(async (db) => {
    const s = await getChallenge(db, Number(id));
    if (!s) throw new Error('Challenge not found.');
    return s;
  }, [id]);
  const now = today();

  return (
    <Screen back title={state.data?.challenge.name ?? 'Challenge'}>
      <Gate state={state}>
        {({ challenge: c, progress: p, byDay }) => {
          const last = c.endDate < now ? c.endDate : now;
          const span = Math.min(14, Math.max(1, daysBetween(c.startDate, last) + 1));
          const bars = Array.from({ length: span }, (_, i) => {
            const d = addDays(last, i - span + 1);
            return { label: WEEKDAYS[weekdayOf(d)].charAt(0), value: byDay[d] ?? 0 };
          });
          const fmt = (v: number) => u.challenge(v, c.kind);
          const onPace = p.projectedFinish != null && p.projectedFinish <= c.endDate;
          return (
            <>
              <Card tone="invert" style={{ padding: space.xl, gap: space.m }}>
                <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Txt v="label" color="onInvert" style={{ opacity: 0.7 }}>{KIND_LABEL[c.kind]} · {Math.round(p.pct * 100)}%</Txt>
                    <BigNumber value={fmt(p.total).split(' ')[0]} unit={fmt(p.total).split(' ').slice(1).join(' ')} color="onInvert" />
                    <Txt color="onInvert" num>of {fmt(c.target)}</Txt>
                  </View>
                  <HexBadge icon={KIND_ICON[c.kind]} earned={p.done} size={80} />
                </Row>
                <ProgressBar pct={p.pct} color={p.done ? 'success' : 'accent'} />
              </Card>

              <Card>
                <Row>
                  <Stat label="Days left" value={String(p.daysLeft)} />
                  <Stat label="Need per day" value={p.done ? '—' : fmt(p.requiredPerDay)} />
                  <Stat label="Your pace / day" value={fmt(p.ratePerDay)} />
                </Row>
                <Txt v="caption" color={p.done ? 'success' : 'muted'}>
                  {p.done
                    ? 'Done.'
                    : c.kind === 'streak'
                      ? `Current streak ${fmt(p.total)}. Train every day to reach ${fmt(c.target)}.`
                      : p.projectedFinish
                        ? `At your 7-day pace you finish ${fmtDate(p.projectedFinish)}${onPace ? ', before the deadline' : `, ${daysBetween(c.endDate, p.projectedFinish)} days after ${fmtDate(c.endDate)}`}.`
                        : 'No progress in the last 7 days, so no projection yet.'}
                </Txt>
              </Card>

              <Card>
                <Txt v="label" color="muted">Last {span} {span === 1 ? 'day' : 'days'}</Txt>
                <BarChart data={bars} highlight={span - 1} label={`${KIND_LABEL[c.kind]} per day, last ${span} days`} />
              </Card>

              <Txt v="caption" color="muted">{fmtDate(c.startDate)} to {fmtDate(c.endDate)}. Counted automatically from your log.</Txt>
              <Button
                kind="secondary"
                icon="share"
                title="Share progress"
                onPress={() => Share.share({ message: `${c.name}: ${fmt(p.total)} of ${fmt(c.target)} (${Math.round(p.pct * 100)}%), ${p.daysLeft} days left.` })}
              />
              <Button
                kind="danger"
                icon="trash-2"
                title="Delete challenge"
                onPress={async () => {
                  await write((db) => deleteChallenge(db, c.id));
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
