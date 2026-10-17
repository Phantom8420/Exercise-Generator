import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, Txt, type IconName } from '../../ui/kit';
import { useTheme } from '../../ui/theme';

const ICONS: Record<string, IconName> = { index: 'home', library: 'book-open', nutrition: 'pie-chart', profile: 'user' };
const LABELS: Record<string, string> = { index: 'Home', library: 'Library', nutrition: 'Nutrition', profile: 'Profile' };

function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const tab = (i: number) => {
    const route = state.routes[i];
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
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.bg, paddingBottom: Math.max(insets.bottom, 10), paddingTop: 8, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: c.line }}>
      {tab(0)}
      {tab(1)}
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Log a workout"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            router.push('/workout');
          }}
          style={({ pressed }) => ({
            width: 58,
            height: 58,
            borderRadius: 29,
            backgroundColor: pressed ? c.accentPressed : c.accent,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: -26,
            shadowColor: '#000',
            shadowOpacity: 0.18,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
          })}
        >
          <Icon name="plus" size={28} color="onAccent" />
        </Pressable>
      </View>
      {tab(2)}
      {tab(3)}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(p) => <TabBar {...p} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="library" />
      <Tabs.Screen name="nutrition" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
