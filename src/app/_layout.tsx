import {
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Suspense, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DbProvider } from '../db/DbProvider';
import { Orb, Txt } from '../ui/kit';
import { font, useTheme } from '../ui/theme';

function Splash() {
  return <View style={{ flex: 1, backgroundColor: '#000' }} />;
}

/** One-time launch intro: the orb ignites, the wordmark settles in, then the overlay fades out. */
function Intro({ onDone }: { onDone: () => void }) {
  const t = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!live) return;
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: reduce ? 1 : 1100, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.delay(reduce ? 400 : 450),
        Animated.timing(out, { toValue: 0, duration: reduce ? 150 : 350, useNativeDriver: true }),
      ]).start(onDone);
    });
    return () => { live = false; };
  }, [t, out, onDone]);
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  const glowScale = t.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2.4] });
  const glowOpacity = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.55, 0.22] });
  const word = t.interpolate({ inputRange: [0.45, 1], outputRange: [0, 1], extrapolate: 'clamp' });
  const wordY = t.interpolate({ inputRange: [0.45, 1], outputRange: [10, 0], extrapolate: 'clamp' });
  return (
    <Animated.View pointerEvents="auto" accessibilityLabel="Plasma" style={[StyleSheet.absoluteFill, { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', opacity: out }]}>
      <Animated.View style={{ position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: '#F76B15', opacity: glowOpacity, transform: [{ scale: glowScale }] }} />
      <Animated.View style={{ opacity: t, transform: [{ scale }] }}>
        <Orb size={120} />
      </Animated.View>
      <Animated.View style={{ marginTop: 28, opacity: word, transform: [{ translateY: wordY }] }}>
        <Txt style={{ fontFamily: font.x, fontSize: 34, lineHeight: 40, letterSpacing: -1, color: '#fff' }}>Plasma</Txt>
      </Animated.View>
    </Animated.View>
  );
}

export default function Root() {
  const { c, dark } = useTheme();
  const [intro, setIntro] = useState(true);
  const [fonts] = useFonts({ PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold });
  return (
    <SafeAreaProvider>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {!fonts ? (
        <Splash />
      ) : (
        <Suspense fallback={<Splash />}>
          <DbProvider>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
              <Stack.Screen name="workout" options={{ presentation: 'fullScreenModal' }} />
              <Stack.Screen name="pick" options={{ presentation: 'modal' }} />
            </Stack>
          </DbProvider>
        </Suspense>
      )}
      {fonts && intro && <Intro onDone={() => setIntro(false)} />}
    </SafeAreaProvider>
  );
}
