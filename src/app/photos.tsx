import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { deleteProgressPhoto, listProgressPhotos, type ProgressPhoto } from '../db/repo/workouts';
import { deletePhotoFile } from '../media/progressPhoto';
import { fmtDate } from '../ui/format';
import { Button, Card, Empty, Gate, Row, Screen, Section, Txt } from '../ui/kit';
import { radius, space } from '../ui/theme';
import { useData, useWrite } from '../ui/useData';

export default function Photos() {
  const write = useWrite();
  const state = useData((db) => listProgressPhotos(db));
  const [open, setOpen] = useState<ProgressPhoto | null>(null);

  return (
    <Screen back title="Progress photos">
      <Gate state={state}>
        {(photos) => {
          if (!photos.length) return <Empty icon="camera" title="No photos yet" body="Each finished workout asks for one." />;
          const first = photos.at(-1)!;
          const latest = photos[0];
          return (
            <>
              {open ? (
                <Card style={{ gap: space.m }}>
                  <Image source={{ uri: open.uri }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: radius.field }} contentFit="cover" accessibilityLabel={`Progress photo from ${fmtDate(open.day)}`} />
                  <Txt v="heading">{fmtDate(open.day)}</Txt>
                  <Row>
                    <Button small kind="secondary" title="Close" onPress={() => setOpen(null)} />
                    <Button
                      small
                      kind="danger"
                      icon="trash-2"
                      title="Delete"
                      onPress={async () => {
                        await write((db) => deleteProgressPhoto(db, open.id));
                        deletePhotoFile(open.uri);
                        setOpen(null);
                      }}
                    />
                  </Row>
                </Card>
              ) : (
                photos.length > 1 && (
                  <Section title="First vs latest">
                    <Row>
                      {[first, latest].map((p) => (
                        <View key={p.id} style={{ flex: 1, gap: space.xs }}>
                          <Image source={{ uri: p.uri }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: radius.field }} contentFit="cover" accessibilityLabel={`Progress photo from ${fmtDate(p.day)}`} />
                          <Txt v="caption" color="muted">{fmtDate(p.day)}</Txt>
                        </View>
                      ))}
                    </Row>
                  </Section>
                )
              )}
              <Section title={`All · ${photos.length}`}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
                  {photos.map((p) => (
                    <Pressable key={p.id} onPress={() => setOpen(p)} accessibilityRole="button" accessibilityLabel={`Open photo from ${fmtDate(p.day)}`} style={{ width: '32%' }}>
                      <Image source={{ uri: p.uri }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 8 }} contentFit="cover" />
                    </Pressable>
                  ))}
                </View>
              </Section>
            </>
          );
        }}
      </Gate>
    </Screen>
  );
}
