import { useState } from 'react';
import { createProfile, deleteProfile, listProfiles, setActiveProfile, toggleEquipment } from '../db/repo/core';
import { EQUIPMENT } from '../domain/types';
import { cap } from '../ui/format';
import { Button, Card, Chip, Chips, Field, Gate, Row, Screen, Section, Segmented, Txt } from '../ui/kit';
import { useData, useWrite } from '../ui/useData';

export default function Equipment() {
  const write = useWrite();
  const state = useData(listProfiles);
  const [name, setName] = useState('');
  return (
    <Screen back title="Equipment">
      <Gate state={state}>
        {(profiles) => {
          const active = profiles.find((p) => p.isActive) ?? profiles[0];
          return (
            <>
              {profiles.length > 1 && (
                <Segmented label="Equipment profile" value={active?.id ?? 0} onChange={(id) => write((db) => setActiveProfile(db, id))} options={profiles.map((p) => ({ value: p.id, label: p.name }))} />
              )}
              {active && (
                <Card>
                  <Txt v="heading">{active.name}</Txt>
                  <Txt v="caption" color="muted">Bodyweight exercises are always available. Generation, substitutes and the library's "My equipment" filter use this list.</Txt>
                  <Chips>
                    {EQUIPMENT.filter((e) => e !== 'body only').map((e) => {
                      const on = active.items.includes(e);
                      return <Chip key={e} label={cap(e)} on={on} onPress={() => write((db) => toggleEquipment(db, active.id, e, !on))} />;
                    })}
                  </Chips>
                  {profiles.length > 1 && <Button small kind="danger" title={`Delete ${active.name}`} onPress={() => write((db) => deleteProfile(db, active.id).then(() => setActiveProfile(db, profiles.find((p) => p.id !== active.id)!.id)))} />}
                </Card>
              )}
              <Section title="New profile">
                <Row style={{ alignItems: 'flex-end' }}>
                  <Field label="Name" value={name} onChangeText={setName} placeholder="Hotel gym" style={{ flex: 1 }} />
                  <Button
                    small
                    title="Add"
                    disabled={!name.trim()}
                    style={{ minHeight: 52 }}
                    onPress={() => write(async (db) => setActiveProfile(db, await createProfile(db, name.trim()))).then(() => setName(''))}
                  />
                </Row>
              </Section>
            </>
          );
        }}
      </Gate>
    </Screen>
  );
}
