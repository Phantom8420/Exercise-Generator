import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { extractTextFromImage, isSupported as ocrSupported } from 'expo-text-extractor';
import { useState } from 'react';
import { importMenu } from '../../db/repo/nutrition';
import { parseMenu } from '../../domain/menu';
import { WEEKDAYS } from '../../domain/types';
import { Button, Card, Field, Row, Screen, Section, Txt } from '../../ui/kit';
import { space } from '../../ui/theme';
import { useWrite } from '../../ui/useData';

const EXAMPLE = `Mon
Breakfast: 3 eggs, 80g oats, 250ml milk
Lunch: 200g chicken breast, 150g rice
Dinner: 180g salmon, 200g potatoes

Tue
OMAD: 400g beef, 300g rice, 2 bananas`;

export default function Import() {
  const write = useWrite();
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const meals = parseMenu(text);
  const items = meals.reduce((s, m) => s + m.items.length, 0);

  const pickFile = async () => {
    setError(null);
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['text/*', 'text/csv', 'application/csv'], copyToCacheDirectory: true });
      if (res.canceled) return;
      const a = res.assets[0];
      setText(await new File(a.uri).text());
      if (!name) setName(a.name.replace(/\.[^.]+$/, ''));
    } catch (e) {
      setError(`Couldn't read that file: ${(e as Error).message}`);
    }
  };

  const scan = async () => {
    setError(null);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (res.canceled) return;
      const lines = await extractTextFromImage(res.assets[0].uri);
      if (!lines.length) return setError('No text found in that photo. Try a sharper, straight-on shot.');
      setText((t) => (t.trim() ? `${t}\n${lines.join('\n')}` : lines.join('\n')));
    } catch (e) {
      setError(`Couldn't read that photo: ${(e as Error).message}`);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const id = await write((db) => importMenu(db, name.trim() || 'My menu', meals));
      router.replace(`/nutrition/plan?id=${id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Screen back title="Import menu">
      <Txt color="muted">
        Scan a photo of the menu notice, paste text, or pick a .txt or .csv file. Scanned text lands below so you can fix it. Day names (Mon, Tuesday) start a day; "Lunch:" or "Meal 2:" starts a meal. A menu with no day names repeats every day. CSV needs a "food" column; day, meal, grams and quantity are optional.
      </Txt>
      {ocrSupported && <Button icon="camera" title="Scan menu photo" onPress={scan} />}
      <Row>
        <Button kind="secondary" icon="file" title="Pick a file" onPress={pickFile} style={{ flex: 1 }} />
        <Button kind="ghost" title="Use example" onPress={() => setText(EXAMPLE)} style={{ flex: 1 }} />
      </Row>
      <Field label="Menu" value={text} onChangeText={setText} multiline placeholder={EXAMPLE} textAlignVertical="top" />
      {error && <Txt color="danger">{error}</Txt>}

      {meals.length > 0 && (
        <Section title={`Found ${meals.length} ${meals.length === 1 ? 'meal' : 'meals'}, ${items} items`}>
          {meals.map((m, i) => (
            <Card key={i} style={{ gap: space.xs }}>
              <Txt v="heading">{m.weekday == null ? 'Every day' : WEEKDAYS[m.weekday]} · {m.label}</Txt>
              {m.items.map((it, j) => (
                <Txt key={j} v="caption" color="muted">
                  {it.name}{it.grams != null ? ` · ${it.grams} g` : it.count != null ? ` · ×${it.count}` : ''}
                </Txt>
              ))}
            </Card>
          ))}
          <Field label="Plan name" value={name} onChangeText={setName} placeholder="My menu" />
          <Button title="Match foods and save" icon="check" loading={busy} onPress={save} />
          <Txt v="caption" color="muted">Each item is matched against the USDA food list. You can fix any match afterwards.</Txt>
        </Section>
      )}
      {text.trim() !== '' && meals.length === 0 && <Txt color="muted">No meals recognised yet. Put each item on its own line or separate them with commas.</Txt>}
    </Screen>
  );
}
