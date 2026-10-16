import { router } from 'expo-router';
import { getUser } from '../../db/repo/core';
import { createRoutine, listRoutines } from '../../db/repo/routines';
import { GOAL_LABEL, SPLIT_LABEL } from '../../domain/types';
import { Button, Card, Empty, Gate, Row, Screen, Tag, Txt } from '../../ui/kit';
import { useData, useWrite } from '../../ui/useData';

export default function Routines() {
  const write = useWrite();
  const state = useData(listRoutines);
  const blank = async () => {
    const id = await write(async (db) => createRoutine(db, 'My routine', 'custom', (await getUser(db)).goal));
    router.push(`/routines/${id}`);
  };
  return (
    <Screen back title="Routines">
      <Row>
        <Button title="Generate" icon="zap" onPress={() => router.push('/routines/generate')} style={{ flex: 1 }} />
        <Button title="Build by hand" kind="secondary" onPress={blank} style={{ flex: 1 }} />
      </Row>
      <Gate state={state}>
        {(rs) =>
          rs.length === 0 ? (
            <Empty icon="calendar" title="No routines" body="Generate one from your split, goal and equipment, or build it exercise by exercise." />
          ) : (
            rs.map((r) => (
              <Card key={r.id} onPress={() => router.push(`/routines/${r.id}`)} label={r.name}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt v="heading" style={{ flex: 1 }} numberOfLines={1}>{r.name}</Txt>
                  {r.isActive && <Tag label="Active" strong />}
                </Row>
                <Txt v="caption" color="muted">
                  {SPLIT_LABEL[r.split]} · {GOAL_LABEL[r.goal]} · {r.dayCount} {r.dayCount === 1 ? 'day' : 'days'}
                </Txt>
              </Card>
            ))
          )
        }
      </Gate>
    </Screen>
  );
}
