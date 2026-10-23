import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassesProvider } from '../../glasses/GlassesProvider';
import { Icon, Txt, type IconName } from '../../ui/kit';
import { useTheme } from '../../ui/theme';

const ICONS: Record<string, IconName> = { index: 'calendar', attendance: 'check-square', tracker: 'list', money: 'credit-card' };
const LABELS: Record<string, string> = { index: 'Calendar', attendance: 'Attendance', tracker: 'Tracker', money: 'Money' };

function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.bg, paddingBottom: Math.max(insets.bottom, 10), paddingTop: 8, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: c.line }}>
      {state.routes.map((route, i) => {
        const on = state.index === i;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={LABELS[route.name]}
            onPress={() => !on && navigateToTab(route.key)}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 52 }}
          >
            <Icon name={ICONS[route.name]} size={22} color={on ? 'accent' : 'muted'} />
            <Txt v="caption" color={on ? 'accentText' : 'muted'} style={{ fontSize: 11 }}>{LABELS[route.name]}</Txt>
          </Pressable>
        );
      })}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open Plasma"
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          router.push('/plasma');
        }}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 52 }}
      >
        {({ pressed }) => (
          <>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: pressed ? c.accentPressed : c.accent, alignItems: 'center', justifyContent: 'center', marginTop: -6 }}>
              <Icon name="zap" size={18} color="onAccent" />
            </View>
            <Txt v="caption" color="accentText" style={{ fontSize: 11 }}>Plasma</Txt>
          </>
        )}
      </Pressable>
    </View>
  );
}

export default function GlassesLayout() {
  return (
    <GlassesProvider>
      <Tabs screenOptions={{ headerShown: false }} tabBar={(p) => <TabBar {...p} />}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="attendance" />
        <Tabs.Screen name="tracker" />
        <Tabs.Screen name="money" />
      </Tabs>
    </GlassesProvider>
  );
}
