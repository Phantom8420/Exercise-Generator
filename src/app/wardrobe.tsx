import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { getSetting, setSetting } from '../db/repo/core';
import { toDay } from '../domain/dates';
import { deletePhotoFile, captureProgressPhoto } from '../media/progressPhoto';
import { Button, Card, Chip, Chips, Divider, Empty, Field, Gate, ListRow, Row, Screen, Section, Tag, Txt } from '../ui/kit';
import { radius, space } from '../ui/theme';
import { useData, useWrite } from '../ui/useData';

type Outfit = { id: string; uri: string; name: string; formality: number; warmth: number; fits: boolean; worn?: string };

const FORMALITY = ['Casual', 'Smart', 'Formal'];
const WARMTH = ['Light', 'Medium', 'Heavy'];
const WEATHER = ['Hot', 'Mild', 'Cold']; // index doubles as the warmth it needs
const KEY = 'wardrobe';

const parse = (s: string | null): Outfit[] => {
  try {
    return s ? (JSON.parse(s) as Outfit[]) : [];
  } catch {
    return [];
  }
};

function score(o: Outfit, occasion: number, weather: number, today: string) {
  const why: string[] = [];
  let s = 0;
  const f = Math.abs(o.formality - occasion);
  if (f === 0) { s += 4; why.push(`${FORMALITY[occasion]} fits the occasion`); } else if (f === 1) s += 1;
  const w = Math.abs(o.warmth - weather);
  if (w === 0) { s += 3; why.push(`${WARMTH[o.warmth].toLowerCase()} layers suit ${WEATHER[weather].toLowerCase()} weather`); } else if (w === 1) s += 1;
  if (o.fits) { s += 2; why.push('you marked it as fitting well'); }
  if (o.worn === today) { s -= 5; why.push('already worn today'); }
  return { s, why };
}

const EVIDENCE: { title: string; note: string; src: string }[] = [
  {
    title: 'Dress to the occasion',
    note: 'With faces hidden, 274 people rated a man in a bespoke suit as more confident and successful than the same man in other clothes (trustworthiness was the exception). Picks match the formality you ask for.',
    src: 'Howlett et al., Journal of Fashion Marketing and Management 2013',
  },
  {
    title: 'Fit beats price',
    note: 'A University of Hertfordshire study found made-to-measure suits shifted snap judgments versus off-the-rack. I only found a press release for it, so treat the size as unchecked. Outfits you mark as fitting well score higher.',
    src: 'University of Hertfordshire / Knot Standard, 2011 (press release)',
  },
  {
    title: 'Weather',
    note: 'Practical, not a study: heavier layers when cold, lighter when hot, so you are not distracted by being uncomfortable.',
    src: 'No source; common sense',
  },
  {
    title: 'Not used on purpose',
    note: 'Colour effects such as red looking more attractive: a 2018 meta-analysis called the effect "very small, potentially nonexistent". The "lab coat makes you sharper" result failed a preregistered replication (Burns et al. 2019), though later work is mixed. I left both out of the pick.',
    src: 'Lehmann, Elliot & Calin-Jageman, Evolutionary Psychology 2018; Burns et al. 2019',
  },
];

export default function Wardrobe() {
  const write = useWrite();
  const state = useData(async (db) => ({ outfits: parse(await getSetting(db, KEY)), today: toDay(new Date()) }));
  const [occasion, setOccasion] = useState(0);
  const [weather, setWeather] = useState(1);
  const [picked, setPicked] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [formality, setFormality] = useState(0);
  const [warmth, setWarmth] = useState(1);
  const [fits, setFits] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const save = (outfits: Outfit[]) => write((db) => setSetting(db, KEY, JSON.stringify(outfits)));

  return (
    <Screen back title="Wardrobe">
      <Txt color="muted">Add your outfits once. Pick the occasion and weather and the app chooses, using the studies listed at the bottom.</Txt>
      <Gate state={state}>
        {({ outfits, today }) => {
          const ranked = outfits
            .map((o) => ({ o, ...score(o, occasion, weather, today) }))
            .sort((a, b) => b.s - a.s || (a.o.worn ?? '').localeCompare(b.o.worn ?? ''));
          const best = ranked.find((r) => r.o.id === picked) ?? null;
          const add = async (source: 'camera' | 'library') => {
            setError(null);
            try {
              const uri = await captureProgressPhoto(source);
              if (!uri) return;
              await save([...outfits, { id: String(Date.now()), uri, name: name.trim() || `Outfit ${outfits.length + 1}`, formality, warmth, fits }]);
              setName('');
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not add the photo.');
            }
          };
          return (
            <>
              <Section title="What should I wear?">
                <Txt v="label" color="muted">Occasion</Txt>
                <Chips>{FORMALITY.map((l, i) => <Chip key={l} label={l} on={occasion === i} onPress={() => { setOccasion(i); setPicked(null); }} />)}</Chips>
                <Txt v="label" color="muted">Weather</Txt>
                <Chips>{WEATHER.map((l, i) => <Chip key={l} label={l} on={weather === i} onPress={() => { setWeather(i); setPicked(null); }} />)}</Chips>
                <Button title="Pick for me" icon="shopping-bag" disabled={!outfits.length} onPress={() => setPicked(ranked[0].o.id)} />
                {best && (
                  <Card style={{ gap: space.m }}>
                    <Image source={{ uri: best.o.uri }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: radius.field }} contentFit="cover" accessibilityLabel={`Suggested outfit: ${best.o.name}`} />
                    <Txt v="heading">{best.o.name}</Txt>
                    <Txt color="muted">{best.why.length ? `Why: ${best.why.join('; ')}.` : 'Nothing matched well. This is the closest of what you added.'}</Txt>
                    <Row>
                      <Button small title="Wear this" onPress={() => save(outfits.map((o) => (o.id === best.o.id ? { ...o, worn: today } : o)))} />
                      <Button small kind="secondary" title="Not this" onPress={() => setPicked(ranked.find((r) => r.o.id !== best.o.id)?.o.id ?? best.o.id)} />
                    </Row>
                  </Card>
                )}
              </Section>

              <Section title="Add an outfit">
                <Field label="Name" value={name} onChangeText={setName} placeholder="Navy blazer and jeans" />
                <Txt v="label" color="muted">Formality</Txt>
                <Chips>{FORMALITY.map((l, i) => <Chip key={l} label={l} on={formality === i} onPress={() => setFormality(i)} />)}</Chips>
                <Txt v="label" color="muted">Warmth</Txt>
                <Chips>{WARMTH.map((l, i) => <Chip key={l} label={l} on={warmth === i} onPress={() => setWarmth(i)} />)}</Chips>
                <Chips><Chip label="Fits well" on={fits} onPress={() => setFits(!fits)} /></Chips>
                <Row>
                  <Button small icon="camera" title="Take photo" onPress={() => add('camera')} />
                  <Button small kind="secondary" icon="image" title="From gallery" onPress={() => add('library')} />
                </Row>
                {error && <Txt color="danger">{error}</Txt>}
              </Section>

              <Section title={`Your outfits · ${outfits.length}`}>
                {!outfits.length ? (
                  <Empty icon="shopping-bag" title="No outfits yet" body="Add a photo and tag it above." />
                ) : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
                    {outfits.map((o) => (
                      <Pressable
                        key={o.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${o.name}`}
                        onLongPress={async () => {
                          await save(outfits.filter((x) => x.id !== o.id));
                          deletePhotoFile(o.uri);
                        }}
                        style={{ width: '32%', gap: 4 }}
                      >
                        <Image source={{ uri: o.uri }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 8 }} contentFit="cover" />
                        <Txt v="caption" color="muted" numberOfLines={1}>{o.name}</Txt>
                      </Pressable>
                    ))}
                  </View>
                )}
                {!!outfits.length && <Txt v="caption" color="muted">Long-press an outfit to delete it.</Txt>}
              </Section>

              <Section title="What the pick is based on">
                <Tag label="Sources named, limits stated" />
                <Card>
                  {EVIDENCE.map((x, i) => (
                    <View key={x.title}>
                      {i > 0 && <Divider />}
                      <ListRow title={x.title} subtitle={`${x.note}\nSource: ${x.src}`} />
                    </View>
                  ))}
                </Card>
                <Txt color="muted">The app does not look at the photo. It uses the tags you set, so a wrong tag gives a wrong pick.</Txt>
              </Section>
            </>
          );
        }}
      </Gate>
    </Screen>
  );
}
