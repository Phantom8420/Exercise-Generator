import { router } from 'expo-router';
import { View } from 'react-native';
import { getSetting, setSetting } from '../db/repo/core';
import { addDays, toDay } from '../domain/dates';
import { Card, Chip, Chips, Divider, Gate, ListRow, Screen, Section, Tag, Txt } from '../ui/kit';
import { useData, useWrite } from '../ui/useData';

type Tip = { title: string; note: string; src?: string };
const TIERS: { title: string; tag: string; strong?: boolean; tips: Tip[] }[] = [
  {
    title: 'Backed by studies',
    tag: 'Evidence',
    strong: true,
    tips: [
      {
        title: 'Lower body fat',
        note: 'People can read BMI from a face alone, and photo-rating studies find a lower BMI looks more attractive and healthier. These are perception studies, so they show how faces are judged, not a guaranteed result for you.',
        src: 'de Jager et al., meta-analysis, Frontiers in Psychology 2018 (r = 0.71); Rule & Re, "Heavy Matters"',
      },
      {
        title: 'Sleep enough',
        note: 'Sleep-deprived faces were rated less healthy, less attractive and more tired. Small study (23 adults), so treat the size of the effect loosely.',
        src: 'Axelsson et al., BMJ 2010',
      },
      {
        title: 'Daily sunscreen',
        note: 'Daily broad-spectrum sunscreen cut measured skin ageing by about 24% over 4.5 years versus using it only sometimes. Measured on the back of the hand, not the face.',
        src: 'Hughes et al., Annals of Internal Medicine 2013 (903 adults, randomized)',
      },
      {
        title: 'Tretinoin (prescription)',
        note: 'The best-studied topical for sun-damaged skin. Works over months and irritates, so ask a doctor or dermatologist.',
        src: 'Systematic review of randomized trials, Int J Women\'s Dermatology 2022',
      },
    ],
  },
  {
    title: 'Weak or unproven',
    tag: 'Weak evidence',
    tips: [
      {
        title: 'Mewing (tongue posture)',
        note: 'I found no study showing it reshapes an adult jaw. Reviews say the link between tongue posture and face shape is mostly expert opinion, and posture may be an effect of face shape rather than a cause. Evidence that exists is in children.',
        src: 'Literature review, PubMed 37114820; systematic review of myofunctional treatment in children, PubMed 30152171',
      },
      {
        title: 'Face exercises',
        note: 'One uncontrolled study of 27 women aged 40–65 (16 finished) saw fuller cheeks after 20 weeks of 30-minute sessions. No control group, and a coauthor runs a face-yoga company.',
        src: 'Alam et al., JAMA Dermatology 2018',
      },
      {
        title: 'Hard gum and jaw trainers',
        note: 'I found no trial showing they sharpen a jawline. Small studies link heavy gum chewing to jaw-joint pain and bigger chewing muscles.',
        src: 'Small randomized study of 53 people on gum chewing and TMD symptoms; a 200-patient study found no difference',
      },
    ],
  },
  {
    title: 'Not researched',
    tag: 'No source checked',
    tips: [
      { title: 'Haircut and brows', note: 'Plausible, but I have no study to cite. Judge it by looking.' },
      { title: 'Fillers, Botox, surgery', note: 'Medical procedures with real risks. Talk to a licensed doctor; this app will not rank them.' },
    ],
  },
];

const HABITS = [
  { id: 'sun', label: 'Sunscreen on' },
  { id: 'sleep', label: 'Slept 7+ hours' },
  { id: 'skin', label: 'Skin routine done' },
];

const key = (day: string) => `face_${day}`;

function Daily() {
  const write = useWrite();
  const state = useData(async (db) => {
    const today = toDay(new Date());
    const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
    const rows = await Promise.all(days.map(async (d) => ((await getSetting(db, key(d))) ?? '').split(',').filter(Boolean)));
    return { today, rows };
  });
  return (
    <Gate state={state}>
      {({ today, rows }) => {
        const done = rows[6];
        const toggle = (id: string) =>
          write((db) => setSetting(db, key(today), (done.includes(id) ? done.filter((x) => x !== id) : [...done, id]).join(',')));
        return (
          <Section title="Today">
            <Chips>
              {HABITS.map((h) => (
                <Chip key={h.id} label={h.label} on={done.includes(h.id)} onPress={() => toggle(h.id)} />
              ))}
            </Chips>
            <Txt color="muted">
              Last 7 days: {HABITS.map((h) => `${h.label.split(' ')[0].toLowerCase()} ${rows.filter((r) => r.includes(h.id)).length}/7`).join(' · ')}
            </Txt>
            <Card>
              <ListRow icon="camera" title="Progress photo" subtitle="Same light, same angle, to track your own change" onPress={() => router.push('/photos')} />
              <Divider />
              <ListRow icon="activity" title="Body fat trend" subtitle="The one lever with a measured effect on how a face reads" onPress={() => router.push('/metrics')} />
            </Card>
          </Section>
        );
      }}
    </Gate>
  );
}

export default function FaceScreen() {
  return (
    <Screen back title="Face">
      <Txt color="muted">What changes how a face looks, sorted by what the studies show. Sources are named so you can look them up.</Txt>
      <Daily />
      {TIERS.map((t) => (
        <Section key={t.title} title={t.title}>
          <Tag label={t.tag} strong={t.strong} />
          <Card>
            {t.tips.map((x, i) => (
              <View key={x.title}>
                {i > 0 && <Divider />}
                <ListRow title={x.title} subtitle={x.src ? `${x.note}\nSource: ${x.src}` : x.note} />
              </View>
            ))}
          </Card>
        </Section>
      ))}
      <Card>
        <Txt v="heading">Keep it proportionate</Txt>
        <Txt color="muted">Rating and comparing your face daily tends to feed anxiety, not results. If it starts to take over, talk to someone you trust or a doctor.</Txt>
      </Card>
    </Screen>
  );
}
