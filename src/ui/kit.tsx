import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { font, radius, space, useTheme, type ColorName } from './theme';
import type { Loadable } from './useData';

export type IconName = ComponentProps<typeof Feather>['name'];

// ---------- text ----------
const VARIANTS = {
  display: { fontFamily: font.b, fontSize: 60, lineHeight: 66, letterSpacing: -2 },
  title: { fontFamily: font.b, fontSize: 30, lineHeight: 36, letterSpacing: -0.8 },
  heading: { fontFamily: font.b, fontSize: 18, lineHeight: 24, letterSpacing: -0.3 },
  body: { fontFamily: font.m, fontSize: 16, lineHeight: 23 },
  label: { fontFamily: font.s, fontSize: 14, lineHeight: 19 },
  caption: { fontFamily: font.m, fontSize: 13, lineHeight: 18 },
} satisfies Record<string, TextStyle>;

export function Txt({
  v = 'body',
  color = 'ink',
  num,
  style,
  children,
  ...rest
}: {
  v?: keyof typeof VARIANTS;
  color?: ColorName;
  num?: boolean;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
} & Omit<ComponentProps<typeof Text>, 'style'>) {
  const { c } = useTheme();
  return (
    <Text style={[VARIANTS[v], { color: c[color] }, num && { fontVariant: ['tabular-nums'] }, style]} {...rest}>
      {children}
    </Text>
  );
}

export function Icon({ name, size = 20, color = 'ink' }: { name: IconName; size?: number; color?: ColorName }) {
  const { c } = useTheme();
  return <Feather name={name} size={size} color={c[color]} />;
}

// ---------- layout ----------
export function Screen({
  title,
  back,
  right,
  scroll = true,
  children,
  pad = true,
}: {
  title?: string;
  back?: boolean;
  right?: ReactNode;
  scroll?: boolean;
  pad?: boolean;
  children: ReactNode;
}) {
  const { c } = useTheme();
  const header =
    title || back || right ? (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, paddingHorizontal: space.l, paddingTop: space.s, paddingBottom: space.m, minHeight: 60 }}>
        {back && <IconButton icon="chevron-left" tone="plain" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />}
        <Txt v={back ? 'heading' : 'title'} style={{ flex: 1, textAlign: back ? 'center' : 'left', fontFamily: back ? font.s : undefined }} numberOfLines={1} accessibilityRole="header">
          {title ?? ''}
        </Txt>
        {right ?? (back ? <View style={{ width: 44 }} /> : null)}
      </View>
    ) : null;
  const body = { padding: pad ? space.l : 0, paddingTop: 0, gap: space.m, paddingBottom: 120 };
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.bg }}>
      {header}
      {scroll ? (
        <ScrollView contentContainerStyle={body} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, body, { paddingBottom: 0 }]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({ children, onPress, style, label, tone = 'surface' }: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  label?: string;
  tone?: 'surface' | 'invert' | 'accent';
}) {
  const { c } = useTheme();
  const bg = tone === 'invert' ? c.invert : tone === 'accent' ? c.accent : c.surface;
  const base: ViewStyle = { backgroundColor: bg, borderRadius: radius.card, padding: space.l, gap: space.s, borderWidth: tone === 'surface' ? 1 : 0, borderColor: c.line };
  const hero: ViewStyle | false = tone === 'invert' && { paddingHorizontal: 0, paddingTop: space.s };
  if (!onPress) return <View style={[base, style, hero]}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.85 }, style, hero]}>
      {children}
    </Pressable>
  );
}

export function Row({ children, gap = space.s, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ gap: space.s, marginTop: space.m }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt v="heading" accessibilityRole="header">{title}</Txt>
        {action}
      </Row>
      {children}
    </View>
  );
}

// ---------- controls ----------
export function Button({
  title,
  onPress,
  kind = 'primary',
  icon,
  disabled,
  loading,
  small,
  style,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const off = disabled && kind === 'primary';
  const bg = off ? c.surface2 : { primary: c.accent, secondary: c.bg, ghost: 'transparent', danger: c.bg }[kind];
  const fg: ColorName = off ? 'muted' : kind === 'primary' ? 'onAccent' : kind === 'danger' ? 'danger' : 'ink';
  const outlined = kind === 'secondary' || kind === 'danger';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: kind === 'primary' && pressed ? c.accentPressed : bg,
          borderWidth: outlined ? 1 : 0,
          borderColor: c.line,
          borderRadius: radius.pill,
          minHeight: small ? 40 : 54,
          paddingHorizontal: small ? space.l : space.xl,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.s,
          opacity: disabled && !off ? 0.4 : pressed && kind !== 'primary' ? 0.7 : 1,
        },
        style,
      ]}
    >
      {loading && <ActivityIndicator color={c[fg]} />}
      <Txt v="label" color={fg} style={{ fontFamily: font.b, fontSize: small ? 14 : 16 }}>
        {title}
      </Txt>
      {!loading && icon && <Icon name={icon} size={small ? 16 : 18} color={fg} />}
    </Pressable>
  );
}

export function IconButton({ icon, label, onPress, tone = 'surface' }: { icon: IconName; label: string; onPress: () => void; tone?: 'surface' | 'accent' | 'plain' }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tone === 'accent' ? c.accent : 'transparent',
        borderWidth: tone === 'surface' ? 1 : 0,
        borderColor: c.line,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon name={icon} color={tone === 'accent' ? 'onAccent' : 'ink'} />
    </Pressable>
  );
}

/** Pill segmented control: one choice from a few. */
export function Segmented<T extends string | number>({ options, value, onChange, label }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', backgroundColor: c.surface2, borderRadius: radius.pill, padding: 4 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={[
              { flex: 1, minHeight: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.raised : 'transparent', paddingHorizontal: space.s },
              on && { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
            ]}
          >
            <Txt v="label" color={on ? 'ink' : 'muted'} numberOfLines={1}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, on, onPress, icon }: { label: string; on: boolean; onPress: () => void; icon?: IconName }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 38,
        paddingHorizontal: 14,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: on ? c.accent : c.line,
        backgroundColor: on ? c.accentTint : c.bg,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {icon && <Icon name={icon} size={15} color={on ? 'accentText' : 'muted'} />}
      <Txt v="label" color={on ? 'accentText' : 'ink'}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function Chips({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>{children}</View>;
}

export function Field({ label, suffix, style, ...input }: { label: string; suffix?: string; style?: StyleProp<ViewStyle> } & TextInputProps) {
  const { c } = useTheme();
  return (
    <View style={[{ gap: 6 }, style]}>
      <Txt v="label" color="muted">{label}</Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.bg, borderWidth: 1, borderColor: c.line, borderRadius: radius.field, paddingHorizontal: space.l, minHeight: 52 }}>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={c.muted}
          selectionColor={c.accent}
          style={{ flex: 1, color: c.ink, fontFamily: font.s, fontSize: 17, paddingVertical: space.m, fontVariant: ['tabular-nums'] }}
          {...input}
        />
        {suffix && <Txt v="label" color="muted">{suffix}</Txt>}
      </View>
    </View>
  );
}

export function Stepper({ value, onChange, step = 1, min = 0, label, format = String }: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  label: string;
  format?: (v: number) => string;
}) {
  return (
    <Row gap={space.s} style={{ justifyContent: 'space-between' }}>
      <IconButton icon="minus" label={`Decrease ${label}`} onPress={() => onChange(Math.max(min, +(value - step).toFixed(2)))} />
      <Txt v="heading" num accessibilityLabel={`${label} ${format(value)}`} style={{ minWidth: 64, textAlign: 'center' }}>
        {format(value)}
      </Txt>
      <IconButton icon="plus" label={`Increase ${label}`} onPress={() => onChange(+(value + step).toFixed(2))} />
    </Row>
  );
}

export function ListRow({ title, subtitle, right, onPress, icon, chevron = !!onPress }: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  icon?: IconName;
  chevron?: boolean;
}) {
  const content = (
    <Row gap={space.m} style={{ minHeight: 56, paddingVertical: space.s }}>
      {icon && <Icon name={icon} color="muted" />}
      <View style={{ flex: 1, gap: 2 }}>
        <Txt v="label" numberOfLines={2}>{title}</Txt>
        {subtitle ? <Txt v="caption" color="muted" numberOfLines={2}>{subtitle}</Txt> : null}
      </View>
      {right}
      {chevron && <Icon name="chevron-right" color="muted" size={18} />}
    </Row>
  );
  if (!onPress) return content;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      {content}
    </Pressable>
  );
}

export function Divider() {
  const { c } = useTheme();
  return <View style={{ height: 1, backgroundColor: c.line }} />;
}

export function ProgressBar({ pct, color = 'accent', height = 10 }: { pct: number; color?: ColorName; height?: number }) {
  const { c } = useTheme();
  const p = Math.max(0, Math.min(1, pct));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }}
      style={{ height, borderRadius: height, backgroundColor: c.surface2, overflow: 'hidden' }}
    >
      <View style={{ width: `${p * 100}%`, height: '100%', borderRadius: height, backgroundColor: c[color] }} />
    </View>
  );
}

export function BigNumber({ value, unit, color = 'ink', size = 'display' }: { value: string; unit?: string; color?: ColorName; size?: 'display' | 'title' }) {
  return (
    <Row gap={6} style={{ alignItems: 'baseline' }}>
      <Txt v={size} num color={color}>{value}</Txt>
      {unit ? <Txt v="heading" color={color === 'ink' || color === 'onInvert' ? 'muted' : color} style={{ fontFamily: font.m, fontSize: 22 }}>{unit}</Txt> : null}
    </Row>
  );
}

export function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Txt v="caption" color="muted">{label}</Txt>
      <Row gap={4} style={{ alignItems: 'baseline' }}>
        <Txt v="heading" num>{value}</Txt>
        {unit ? <Txt v="caption" color="muted">{unit}</Txt> : null}
      </Row>
    </View>
  );
}

// ---------- states ----------
export function Empty({ icon, title, body, action }: { icon: IconName; title: string; body?: string; action?: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: space.s, paddingVertical: space.xxl, paddingHorizontal: space.l }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.accentTint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={26} color="accentText" />
      </View>
      <Txt v="heading" style={{ textAlign: 'center' }}>{title}</Txt>
      {body && <Txt color="muted" style={{ textAlign: 'center', maxWidth: 320 }}>{body}</Txt>}
      {action && <View style={{ marginTop: space.s }}>{action}</View>}
    </View>
  );
}

export function Loading() {
  const { c } = useTheme();
  return (
    <View style={{ paddingVertical: space.xxl, alignItems: 'center' }}>
      <ActivityIndicator color={c.accent} accessibilityLabel="Loading" />
    </View>
  );
}

export function ErrorView({ error }: { error: Error }) {
  return <Empty icon="alert-circle" title="Couldn't load this" body={error.message} />;
}

/** Renders loading / error states, then children with the data. */
export function Gate<T>({ state, children }: { state: Loadable<T>; children: (data: T) => ReactNode }) {
  if (state.error) return <ErrorView error={state.error} />;
  if (state.data === undefined) return <Loading />;
  return <>{children(state.data)}</>;
}

export function Formula({ text }: { text: string }) {
  const { c } = useTheme();
  return (
    <View style={{ backgroundColor: c.surface2, borderRadius: radius.field, padding: space.m }}>
      <Txt v="caption" color="muted" selectable>{text}</Txt>
    </View>
  );
}

/** Non-interactive pill label. */
export function Tag({ label, strong }: { label: string; strong?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ minHeight: 32, paddingHorizontal: 12, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: strong ? c.accentTint : c.surface2 }}>
      <Txt v="caption" color={strong ? 'accentText' : 'muted'} style={{ fontFamily: font.s }}>{label}</Txt>
    </View>
  );
}
