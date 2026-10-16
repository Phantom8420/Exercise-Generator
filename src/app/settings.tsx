import { File, Paths } from 'expo-file-system';
import * as Notifications from 'expo-notifications';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { useDb } from '../db/DbProvider';
import { exportData } from '../db/exportData';
import { getSetting, setSetting } from '../db/repo/core';
import { today } from '../domain/dates';
import { useApp, type ThemePref } from '../state/app';
import { Button, Card, Divider, Field, Gate, ListRow, Row, Screen, Section, Segmented, Txt } from '../ui/kit';
import { space } from '../ui/theme';
import { useData } from '../ui/useData';

const LICENSES = [
  { name: 'free-exercise-db', note: 'Exercises, instructions and demo images. Unlicense (public domain).', url: 'https://github.com/yuhonas/free-exercise-db' },
  { name: 'USDA FoodData Central', note: 'Food nutrients. Public domain (U.S. Government work).', url: 'https://fdc.nal.usda.gov' },
  { name: 'Plus Jakarta Sans', note: 'Typeface. SIL Open Font License 1.1.', url: 'https://fonts.google.com/specimen/Plus+Jakarta+Sans' },
];

async function scheduleReminder(time: string) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!time) return;
  const { granted } = await Notifications.requestPermissionsAsync();
  if (!granted) throw new Error('Notifications are turned off for Plasma in system settings.');
  const [hour, minute] = time.split(':').map(Number);
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Plasma', body: "Today's session is waiting." },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
  });
}

export default function Settings() {
  const db = useDb();
  const { units, theme, set } = useApp();
  const reminder = useData((d) => getSetting(d, 'reminder'));
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const persist = (key: 'units' | 'theme', value: string) => {
    set({ [key]: value });
    setSetting(db, key, value);
  };

  const exportJson = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const file = new File(Paths.cache, `plasma-${today()}.json`);
      if (file.exists) file.delete();
      file.create();
      file.write(JSON.stringify(await exportData(db), null, 1));
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Export Plasma data' });
      else setMsg({ text: `Saved to ${file.uri}` });
    } catch (e) {
      setMsg({ text: `Export failed: ${(e as Error).message}`, error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen back title="Settings">
      <Section title="Units">
        <Segmented label="Units" value={units} onChange={(v) => persist('units', v)} options={[{ value: 'metric', label: 'Metric (kg, cm)' }, { value: 'imperial', label: 'Imperial (lb, in)' }]} />
      </Section>
      <Section title="Appearance">
        <Segmented<ThemePref> label="Theme" value={theme} onChange={(v) => persist('theme', v)} options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
      </Section>

      <Section title="Daily reminder">
        {Platform.OS === 'web' ? (
          <Txt color="muted">Reminders work in the phone app.</Txt>
        ) : (
          <Gate state={reminder}>{(t) => <Reminder initial={t ?? ''} onError={(text) => setMsg({ text, error: true })} />}</Gate>
        )}
      </Section>

      <Section title="Your data">
        <Card style={{ gap: space.m }}>
          <Txt color="muted">Everything stays on this phone. Export writes your profile, logs, routines, plans and challenges to one JSON file.</Txt>
          <Button kind="secondary" icon="download" title="Export as JSON" loading={busy} onPress={exportJson} />
          {msg && <Txt color={msg.error ? 'danger' : 'muted'} selectable>{msg.text}</Txt>}
        </Card>
        <Card>
          <ListRow icon="cloud-off" title="Sync and accounts" subtitle="Not available yet. Plasma works fully offline." />
        </Card>
      </Section>

      <Section title="Data sources">
        <Card>
          {LICENSES.map((l, i) => (
            <View key={l.name}>
              {i > 0 && <Divider />}
              <ListRow title={l.name} subtitle={l.note} onPress={() => Linking.openURL(l.url)} />
            </View>
          ))}
        </Card>
      </Section>
    </Screen>
  );
}

function Reminder({ initial, onError }: { initial: string; onError: (msg: string) => void }) {
  const db = useDb();
  const [on, setOn] = useState(initial !== '');
  const [time, setTime] = useState(initial || '18:00');
  const valid = /^([01]\d|2[0-3]):[0-5]\d$/.test(time);

  const apply = async (next: string) => {
    try {
      await scheduleReminder(next);
      await setSetting(db, 'reminder', next);
    } catch (e) {
      setOn(false);
      onError((e as Error).message);
    }
  };

  return (
    <Card style={{ gap: space.m }}>
      <Segmented label="Daily reminder" value={on ? 'on' : 'off'} onChange={(v) => { setOn(v === 'on'); apply(v === 'on' && valid ? time : ''); }} options={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]} />
      {on && (
        <Row style={{ alignItems: 'flex-end' }}>
          <Field label="Time (24 h)" value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" style={{ flex: 1 }} />
          <Button small title="Set" disabled={!valid} style={{ minHeight: 52 }} onPress={() => apply(time)} />
        </Row>
      )}
    </Card>
  );
}
