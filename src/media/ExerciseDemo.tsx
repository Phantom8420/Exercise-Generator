import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, View } from 'react-native';
import type { Exercise } from '../domain/types';
import { Icon, Txt } from '../ui/kit';
import { radius, useTheme } from '../ui/theme';
import { media } from './MediaProvider';

/**
 * Plays the provider's demo. Frames come from the network once, then expo-image's disk cache serves them offline.
 * With reduced motion on, it holds the first frame and steps on tap.
 */
export function ExerciseDemo({ exercise, height = 240 }: { exercise: Exercise; height?: number }) {
  const { c } = useTheme();
  const demo = media().demo(exercise);
  const [frame, setFrame] = useState(0);
  const [failed, setFailed] = useState(false);
  const [still, setStill] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setStill, () => {});
  }, []);
  useEffect(() => {
    if (!demo || demo.kind !== 'frames') return;
    Image.prefetch(demo.uris, 'disk').catch(() => {});
    if (still || demo.uris.length < 2) return;
    const t = setInterval(() => setFrame((f) => (f + 1) % demo.uris.length), demo.frameMs);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id, still]);

  const box = { height, borderRadius: radius.card, backgroundColor: c.surface, overflow: 'hidden' as const };
  if (!demo || demo.kind !== 'frames' || failed) {
    return (
      <View style={[box, { alignItems: 'center', justifyContent: 'center', gap: 8 }]}>
        <Icon name="image" size={28} color="muted" />
        <Txt v="caption" color="muted">{failed ? 'Demo needs a connection the first time' : 'No demo for this exercise'}</Txt>
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="image"
      accessibilityLabel={`${exercise.name} demonstration, frame ${frame + 1} of ${demo.uris.length}`}
      onPress={() => setFrame((f) => (f + 1) % demo.uris.length)}
      style={box}
    >
      <Image
        source={{ uri: demo.uris[frame] }}
        cachePolicy="disk"
        contentFit="contain"
        transition={180}
        onError={() => setFailed(true)}
        style={{ flex: 1, backgroundColor: '#FFFFFF' }}
      />
    </Pressable>
  );
}

export function ExerciseThumb({ exercise, size = 52 }: { exercise: Exercise; size?: number }) {
  const { c } = useTheme();
  const uri = media().thumbnail(exercise);
  return (
    <View style={{ width: size, height: size, borderRadius: 14, overflow: 'hidden', backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}>
      {uri ? <Image source={{ uri }} cachePolicy="disk" contentFit="cover" style={{ width: size, height: size }} recyclingKey={exercise.id} /> : <Icon name="activity" color="muted" />}
    </View>
  );
}
