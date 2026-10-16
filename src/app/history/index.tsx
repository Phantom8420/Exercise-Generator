import { router } from 'expo-router';
import { listSessions } from '../../db/repo/workouts';
import { fmtDate, useUnits } from '../../ui/format';
import { Card, Empty, Gate, Row, Screen, Txt } from '../../ui/kit';
import { useData } from '../../ui/useData';

export default function History() {
  const u = useUnits();
  const state = useData((db) => listSessions(db));
  return (
    <Screen back title="History">
      <Gate state={state}>
        {(ss) =>
          ss.length === 0 ? (
            <Empty icon="clock" title="No sessions yet" body="Tap + to log your first set." />
          ) : (
            ss.map((s) => (
              <Card key={s.id} onPress={() => router.push(`/history/${s.id}`)} label={`Session on ${fmtDate(s.day)}`}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt v="heading">{fmtDate(s.day)}</Txt>
                  {!s.endedAt && <Txt v="label" color="accentText">In progress</Txt>}
                </Row>
                <Txt v="caption" color="muted" num>
                  {s.label ? `${s.label} · ` : ''}{s.sets} {s.sets === 1 ? 'set' : 'sets'} · {u.volume(s.volume)}
                </Txt>
              </Card>
            ))
          )
        }
      </Gate>
    </Screen>
  );
}
