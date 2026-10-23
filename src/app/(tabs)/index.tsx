import { Redirect, router } from 'expo-router';
import { currentStreak } from '../../domain/challenges';
import { addDays, today, weekdayOf } from '../../domain/dates';
import { estimatedMinutes } from '../../domain/generator';
import { WEEKDAYS } from '../../domain/types';
import { listChallenges } from '../../db/repo/challenges';
import { getSetting, getUser } from '../../db/repo/core';
import { listDebts } from '../../db/repo/debts';
import { activeDayFor, activeRoutine } from '../../db/repo/routines';
import { activeSession, trainedDays, volumeByDay } from '../../db/repo/workouts';
import { getExercise } from '../../db/repo/exercises';
import { PhotoHero } from '../../media/ExerciseDemo';
import { BarChart } from '../../ui/charts';
import { fmtDate, useUnits } from '../../ui/format';
import { Button, Card, Empty, Gate, IconButton, ProgressBar, Row, Screen, Section, Stat, StatRow, Tag, Txt } from '../../ui/kit';
import { useData } from '../../ui/useData';

const WHITE = { color: '#FFFFFF' };
const GLOW = { shadowColor: '#F76B15', shadowOpacity: 0.55, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 8 };

export default function Home() {
  const u = useUnits();
  const now = today();
  const state = useData(async (db) => {
    const monday = addDays(now, -weekdayOf(now));
    const [routine, day, session, debts, challenges, vol, trained, fallback] = await Promise.all([
      activeRoutine(db), activeDayFor(db, weekdayOf(now)), activeSession(db), listDebts(db),
      listChallenges(db), volumeByDay(db, monday, addDays(monday, 6)), trainedDays(db, addDays(now, -365)),
      getExercise(db, 'Barbell_Squat'),
    ]);
    // Existing installs that already have a height skip onboarding.
    const onboard = !(await getSetting(db, 'onboarded')) && (await getUser(db)).heightCm == null;
    const owed = debts.flatMap((d) => d.allocations.filter((a) => a.day === now).map((a) => ({ debt: d, amount: a.amount })));
    const week = WEEKDAYS.map((label, i) => ({ label: label.slice(0, 1), value: vol[addDays(monday, i)]?.volume ?? 0 }));
    return {
      onboard, routine, day, session, owed, week,
      photo: day?.exercises[0]?.exercise ?? fallback,
      challenges: challenges.filter((c) => !c.progress.done).slice(0, 2),
      streak: currentStreak(trained, now, addDays(now, -365)),
    };
  });

  return (
    <Screen glow title={fmtDate(now)} right={<IconButton icon="settings" label="Settings" onPress={() => router.push('/settings')} />}>
      <Gate state={state}>
        {(d) => d.onboard ? <Redirect href="/onboarding" /> : (
          <>
            <PhotoHero exercise={d.photo}>
              {!d.routine ? (
                <>
                  <Tag outline label="No routine yet" />
                  <Txt v="title" style={[WHITE, { fontSize: 36, lineHeight: 40 }]}>Build your week.</Txt>
                  <Txt style={{ color: 'rgba(255,255,255,0.75)' }}>Pick a split, your days and session length. Plasma fits it to your equipment.</Txt>
                  <Button title="Build my routine" icon="zap" style={GLOW} onPress={() => router.push('/routines/generate')} />
                </>
              ) : (
                <>
                  <Tag outline label={d.routine.name} />
                  <Txt v="title" style={[WHITE, { fontSize: 36, lineHeight: 40 }]} numberOfLines={2}>{d.day ? d.day.label : 'Rest day'}</Txt>
                  {d.day ? (
                    <StatRow
                      light
                      items={[
                        { icon: 'clock', value: String(estimatedMinutes(d.day.exercises)), label: 'min' },
                        { icon: 'layers', value: String(d.day.exercises.reduce((n, e) => n + e.sets, 0)), label: 'sets' },
                        { icon: 'activity', value: String(d.day.exercises.length), label: 'exercises' },
                      ]}
                    />
                  ) : (
                    <Txt style={{ color: 'rgba(255,255,255,0.75)' }}>Nothing planned. Log anything you do and it still counts.</Txt>
                  )}
                  <Button
                    title={d.session ? 'Resume workout' : d.day ? 'Start workout' : 'Log a workout'}
                    icon={d.session ? 'play' : 'arrow-right'}
                    style={GLOW}
                    onPress={() => router.push('/workout')}
                  />
                </>
              )}
            </PhotoHero>

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
