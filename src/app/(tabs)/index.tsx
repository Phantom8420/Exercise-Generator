import { router } from 'expo-router';
import { currentStreak } from '../../domain/challenges';
import { addDays, today, weekdayOf } from '../../domain/dates';
import { estimatedMinutes } from '../../domain/generator';
import { WEEKDAYS } from '../../domain/types';
import { listChallenges } from '../../db/repo/challenges';
import { listDebts } from '../../db/repo/debts';
import { activeDayFor, activeRoutine } from '../../db/repo/routines';
import { activeSession, trainedDays, volumeByDay } from '../../db/repo/workouts';
import { BarChart } from '../../ui/charts';
import { fmtDate, useUnits } from '../../ui/format';
import { BigNumber, Button, Card, Empty, Gate, IconButton, ProgressBar, Row, Screen, Section, Stat, Txt } from '../../ui/kit';
import { space } from '../../ui/theme';
import { useData } from '../../ui/useData';

export default function Home() {
  const u = useUnits();
  const now = today();
  const state = useData(async (db) => {
    const monday = addDays(now, -weekdayOf(now));
    const [routine, day, session, debts, challenges, vol, trained] = await Promise.all([
      activeRoutine(db), activeDayFor(db, weekdayOf(now)), activeSession(db), listDebts(db),
      listChallenges(db), volumeByDay(db, monday, addDays(monday, 6)), trainedDays(db, addDays(now, -365)),
    ]);
    const owed = debts.flatMap((d) => d.allocations.filter((a) => a.day === now).map((a) => ({ debt: d, amount: a.amount })));
    const week = WEEKDAYS.map((label, i) => ({ label: label.slice(0, 1), value: vol[addDays(monday, i)]?.volume ?? 0 }));
    return {
      routine, day, session, owed, week,
      challenges: challenges.filter((c) => !c.progress.done).slice(0, 2),
      streak: currentStreak(trained, now, addDays(now, -365)),
    };
  });

  return (
    <Screen title={fmtDate(now)} right={<IconButton icon="settings" label="Settings" onPress={() => router.push('/settings')} />}>
      <Gate state={state}>
        {(d) => (
          <>
            {!d.routine ? (
              <Card>
                <Empty
                  icon="calendar"
                  title="No routine yet"
                  body="Pick a split, your days and session length. Plasma builds the week around your equipment."
                  action={<Button title="Build my routine" icon="zap" onPress={() => router.push('/routines/generate')} />}
                />
              </Card>
            ) : (
              <Card tone="invert" style={{ padding: space.xl, gap: space.m }}>
                <Txt v="label" color="onInvert" style={{ opacity: 0.7 }}>{d.routine.name}</Txt>
                <Txt v="title" color="onInvert">{d.day ? d.day.label : 'Rest day'}</Txt>
                {d.day ? (
                  <Row gap={space.xl} style={{ alignItems: 'baseline' }}>
                    <BigNumber value={String(d.day.exercises.reduce((s, e) => s + e.sets, 0))} unit="sets" color="onInvert" />
                    <BigNumber value={String(estimatedMinutes(d.day.exercises))} unit="min" color="onInvert" size="title" />
                  </Row>
                ) : (
                  <Txt color="onInvert" style={{ opacity: 0.75 }}>Nothing planned. Log anything you do and it still counts.</Txt>
                )}
                <Button
                  title={d.session ? 'Resume workout' : d.day ? 'Start workout' : 'Log a workout'}
                  icon={d.session ? 'play' : 'plus'}
                  onPress={() => router.push('/workout')}
                />
              </Card>
            )}

            {d.owed.length > 0 && (
              <Card onPress={() => router.push('/debt')} label="Open what you owe">
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt v="heading">Owed today</Txt>
                  <Txt v="label" color="accentText">{d.owed.length} {d.owed.length === 1 ? 'item' : 'items'}</Txt>
                </Row>
                {d.owed.slice(0, 3).map((o) => (
                  <Row key={o.debt.id} style={{ justifyContent: 'space-between' }}>
                    <Txt v="label" style={{ flex: 1 }} numberOfLines={1}>{o.debt.exercise.name}</Txt>
                    <Txt v="label" color="muted" num>{u.amount(o.amount, o.debt.metric)}</Txt>
                  </Row>
                ))}
              </Card>
            )}

            <Card>
              <Row>
                <Stat label="Volume this week" value={u.volume(d.week.reduce((s, x) => s + x.value, 0))} />
                <Stat label="Streak" value={String(d.streak)} unit={d.streak === 1 ? 'day' : 'days'} />
              </Row>
              <BarChart data={d.week} highlight={weekdayOf(now)} label="Volume by day this week" />
            </Card>

            <Section title="Challenges" action={<Button kind="ghost" small title="See all" onPress={() => router.push('/challenges')} />}>
              {d.challenges.length === 0 ? (
                <Card>
                  <Empty
                    icon="award"
                    title="No active challenge"
                    body="Set a volume, reps, calorie or streak target. Progress counts itself from what you log."
                    action={<Button small kind="secondary" title="New challenge" onPress={() => router.push('/challenges/new')} />}
                  />
                </Card>
              ) : (
                d.challenges.map((c) => (
                  <Card key={c.challenge.id} onPress={() => router.push(`/challenges/${c.challenge.id}`)} label={c.challenge.name}>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <Txt v="heading" style={{ flex: 1 }} numberOfLines={1}>{c.challenge.name}</Txt>
                      <Txt v="label" num>{Math.round(c.progress.pct * 100)}%</Txt>
                    </Row>
                    <ProgressBar pct={c.progress.pct} />
                    <Txt v="caption" color="muted">
                      {c.progress.daysLeft} days left
                      {c.progress.projectedFinish ? ` · on pace to finish ${fmtDate(c.progress.projectedFinish)}` : ''}
                    </Txt>
                  </Card>
                ))
              )}
            </Section>
          </>
        )}
      </Gate>
    </Screen>
  );
}
