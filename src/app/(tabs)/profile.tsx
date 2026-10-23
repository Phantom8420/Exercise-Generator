import { router, type Href } from 'expo-router';
import { View } from 'react-native';
import { getUser, latestWeightKg } from '../../db/repo/core';
import { listDebts } from '../../db/repo/debts';
import { activeRoutine } from '../../db/repo/routines';
import { GOAL_LABEL } from '../../domain/types';
import { displayWeight } from '../../domain/units';
import { useUnits } from '../../ui/format';
import { BigNumber, Card, Divider, Gate, IconButton, ListRow, Screen, Txt, type IconName } from '../../ui/kit';
import { space } from '../../ui/theme';
import { useData } from '../../ui/useData';

export default function Profile() {
  const u = useUnits();
  const state = useData(async (db) => {
    const [user, kg, routine, debts] = await Promise.all([getUser(db), latestWeightKg(db), activeRoutine(db), listDebts(db)]);
    return { user, kg, routine, debts };
  });

  return (
    <Screen title="Profile" right={<IconButton icon="settings" label="Settings" onPress={() => router.push('/settings')} />}>
      <Gate state={state}>
        {(d) => {
          const links: { icon: IconName; title: string; subtitle: string; href: Href }[] = [
            { icon: 'activity', title: 'Body metrics', subtitle: 'Weight, body fat, BMR and TDEE', href: '/metrics' },
            { icon: 'calendar', title: 'Routines', subtitle: d.routine ? `Active: ${d.routine.name}` : 'None yet', href: '/routines' },
            { icon: 'tool', title: 'Equipment', subtitle: 'What you have, and where', href: '/equipment' },
            { icon: 'trending-up', title: 'Max plan', subtitle: 'The most training your week can hold', href: '/maxplan' },
            { icon: 'award', title: 'Challenges', subtitle: 'Volume, reps, calories, streaks', href: '/challenges' },
            { icon: 'rotate-ccw', title: 'What you owe', subtitle: d.debts.length ? `${d.debts.length} open` : 'All square', href: '/debt' },
            { icon: 'clock', title: 'History', subtitle: 'Every session you logged', href: '/history' },
            { icon: 'camera', title: 'Progress photos', subtitle: 'One after every workout', href: '/photos' },
          ];
          return (
            <>
              <Card tone="invert" onPress={() => router.push('/metrics')} label="Open body metrics" style={{ padding: space.xl }}>
                <Txt v="label" color="onInvert" style={{ opacity: 0.7 }}>{d.user.name ?? 'You'} · {GOAL_LABEL[d.user.goal]}</Txt>
                {d.kg != null ? (
                  <BigNumber value={String(displayWeight(d.kg, u.units))} unit={u.w} color="onInvert" />
                ) : (
                  <Txt v="heading" color="onInvert">Add your first weigh-in</Txt>
                )}
              </Card>
              <Card style={{ paddingVertical: space.s }}>
                {links.map((l, i) => (
                  <View key={l.title}>
                    {i > 0 && <Divider />}
                    <ListRow icon={l.icon} title={l.title} subtitle={l.subtitle} onPress={() => router.push(l.href)} />
                  </View>
                ))}
              </Card>
            </>
          );
        }}
      </Gate>
    </Screen>
  );
}
