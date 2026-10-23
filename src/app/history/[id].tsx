import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { deleteSet } from '../../db/repo/debts';
import { deleteSession, photoForSession, sessionDetail } from '../../db/repo/workouts';
import { fmtDate, useUnits } from '../../ui/format';
import { Button, Card, Divider, Gate, IconButton, ListRow, Row, Screen, Stat, Txt } from '../../ui/kit';
import { radius } from '../../ui/theme';
import { useData, useWrite } from '../../ui/useData';

export default function SessionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const u = useUnits();
  const write = useWrite();
  const state = useData(async (db) => {
    const d = await sessionDetail(db, Number(id));
    if (!d) throw new Error('Session not found.');
    return { ...d, photo: await photoForSession(db, d.session.id) };
  }, [id]);

  return (
    <Screen back title={state.data ? fmtDate(state.data.session.day) : 'Session'}>
      <Gate state={state}>
        {({ session, sets, exercises, photo }) => {
          const groups = [...new Set(sets.map((s) => s.exerciseId))];
          const minutes = session.endedAt ? Math.round((Date.parse(session.endedAt) - Date.parse(session.startedAt)) / 60000) : null;
          return (
            <>
              <Card>
                <Row>
                  <Stat label="Sets" value={String(sets.length)} />
                  <Stat label="Volume" value={u.volume(sets.reduce((s, x) => s + x.weightKg * x.reps, 0))} />
                  <Stat label="Duration" value={minutes != null ? String(minutes) : '—'} unit={minutes != null ? 'min' : undefined} />
                </Row>
              </Card>
              {photo && <Image source={{ uri: photo.uri }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: radius.field }} contentFit="cover" accessibilityLabel="Progress photo from this session" />}
              {groups.map((exId) => (
                <Card key={exId}>
                  <Txt v="heading">{exercises.get(exId)?.name ?? exId}</Txt>
                  {sets.filter((s) => s.exerciseId === exId).map((s, i) => (
                    <View key={s.id}>
                      {i > 0 && <Divider />}
                      <ListRow
                        title={s.weightKg > 0 ? `${u.weight(s.weightKg)} × ${s.reps}` : `${s.reps} reps`}
                        subtitle={s.debtId != null ? 'Debt repayment' : undefined}
                        right={<IconButton icon="trash-2" label="Delete set" tone="plain" onPress={() => write((db) => deleteSet(db, s.id))} />}
                      />
                    </View>
                  ))}
                </Card>
              ))}
              <Button
                kind="danger"
                icon="trash-2"
                title="Delete session"
                onPress={async () => {
                  await write((db) => deleteSession(db, session.id));
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
