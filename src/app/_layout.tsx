import {
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DbProvider } from '../db/DbProvider';
import { useTheme } from '../ui/theme';

function Splash() {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={c.accent} accessibilityLabel="Loading Glasses" />
    </View>
  );
}

export default function Root() {
  const { c, dark } = useTheme();
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
    </SafeAreaProvider>
  );
}
