import { View } from 'react-native';
import { Card, Divider, ListRow, Screen, Section, Tag, Txt } from '../ui/kit';

type Tip = { title: string; note: string };
const TIERS: { title: string; tag: string; strong?: boolean; tips: Tip[] }[] = [
  {
    title: 'Works',
    tag: 'Good evidence',
    strong: true,
    tips: [
      { title: 'Lose excess body fat', note: 'The biggest visible change to jaw and cheek definition. Training and nutrition in Plasma already drive this.' },
      { title: 'Sleep 7–9 hours', note: 'Short sleep shows up as puffiness, dark circles and dull skin.' },
      { title: 'Daily sunscreen', note: 'UV is the main cause of visible skin ageing. SPF 30+ every day.' },
      { title: 'Simple skincare', note: 'Gentle cleanser and moisturiser. Add a retinoid or treat acne with a dermatologist if needed.' },
      { title: 'A cut and brows that suit you', note: 'Hair and grooming change how a face reads more than any exercise.' },
    ],
  },
  {
    title: 'Little or no proof',
    tag: 'Weak evidence',
    tips: [
      { title: 'Mewing (tongue posture)', note: 'Harmless, but no good evidence it reshapes an adult jaw.' },
      { title: 'Hard gum and jaw trainers', note: 'Chewing builds the masseter muscle, not bone. Overuse can cause jaw pain.' },
      { title: 'Face yoga', note: 'Small studies only, with modest or unproven results.' },
    ],
  },
  {
    title: 'Medical',
    tag: 'Talk to a doctor',
    tips: [
      { title: 'Fillers and Botox', note: 'Temporary and effective in trained hands. Complications are real.' },
      { title: 'Surgery and implants', note: 'Rhinoplasty, jaw surgery, hair transplants. Permanent, costly and risky. Not DIY.' },
    ],
  },
];

export default function FaceScreen() {
  return (
    <Screen back title="Face">
      <Txt color="muted">What actually changes how your face looks, sorted by how strong the evidence is.</Txt>
      {TIERS.map((t) => (
        <Section key={t.title} title={t.title}>
          <Tag label={t.tag} strong={t.strong} />
          <Card>
            {t.tips.map((x, i) => (
              <View key={x.title}>
                {i > 0 && <Divider />}
                <ListRow title={x.title} subtitle={x.note} />
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
