import { router } from 'expo-router';
import { listChallenges } from '../../db/repo/challenges';
import { today } from '../../domain/dates';
import { HexBadge } from '../../ui/charts';
import { View } from 'react-native';
import { fmtDate, KIND_ICON, useUnits } from '../../ui/format';
import { Button, Card, Empty, Gate, IconButton, ProgressBar, Row, Screen, Section, Txt } from '../../ui/kit';
import { useData } from '../../ui/useData';

export default function Challenges() {
  const u = useUnits();
  const state = useData(listChallenges);
  const now = today();
  return (
    <Screen back title="Challenges" right={<IconButton icon="plus" tone="accent" label="New challenge" onPress={() => router.push('/challenges/new')} />}>
      <Gate state={state}>
        {(all) => {
          if (!all.length) {
            return (
              <Empty
                icon="award"
                title="No challenges yet"
                body="Set a volume, reps, calorie or streak target. Progress counts itself from what you log."
                action={<Button title="New challenge" icon="plus" onPress={() => router.push('/challenges/new')} />}
              />
            );
          }
          const groups = [
            { title: 'Active', items: all.filter((s) => !s.progress.done && s.challenge.endDate >= now) },
            { title: 'Finished', items: all.filter((s) => s.progress.done || s.challenge.endDate < now) },
          ];
          return groups.filter((g) => g.items.length).map((g) => (
            <Section key={g.title} title={g.title}>
              {g.items.map(({ challenge: c, progress: p }) => (
                <Card key={c.id} onPress={() => router.push(`/challenges/${c.id}`)} label={c.name}>
                  <Row gap={16} style={{ alignItems: 'center' }}>
                    <HexBadge icon={KIND_ICON[c.kind]} earned={p.done} size={56} />
                    <View style={{ flex: 1, gap: 6 }}>
                      <Txt v="heading">{c.name}</Txt>
                      <Txt v="caption" color="muted" num>{u.challenge(p.total, c.kind)} of {u.challenge(c.target, c.kind)} · ends {fmtDate(c.endDate)}</Txt>
                      <ProgressBar pct={p.pct} color={p.done ? 'success' : 'accent'} />
                    </View>
                  </Row>
                </Card>
              ))}
            </Section>
          ));
        }}
      </Gate>
    </Screen>
  );
}
