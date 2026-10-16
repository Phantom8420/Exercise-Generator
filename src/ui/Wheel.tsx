import { useEffect, useRef } from 'react';
import { FlatList, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Txt } from './kit';
import { radius, useTheme } from './theme';

const ITEM = 44;

/** Snap-scrolling wheel picker for small integer ranges (reps, minutes). */
export function Wheel({ values, value, onChange, label, format = String }: {
  values: number[];
  value: number;
  onChange: (v: number) => void;
  label: string;
  format?: (v: number) => string;
}) {
  const { c } = useTheme();
  const ref = useRef<FlatList<number>>(null);
  const idx = Math.max(0, values.indexOf(value));
  // Scroll when the value changes from outside (prefill), not when the wheel itself reported it.
  const emitted = useRef<number | null>(null);
  useEffect(() => {
    if (value === emitted.current) return;
    emitted.current = value;
    const t = setTimeout(() => ref.current?.scrollToOffset({ offset: idx * ITEM, animated: false }), 0);
    return () => clearTimeout(t);
  }, [value, idx]);
  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.y / ITEM);
    const v = values[Math.max(0, Math.min(values.length - 1, i))];
    emitted.current = v;
    if (v !== value) onChange(v);
  };
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: format(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        const next = values[idx + (e.nativeEvent.actionName === 'increment' ? 1 : -1)];
        if (next != null) {
          onChange(next);
          ref.current?.scrollToOffset({ offset: values.indexOf(next) * ITEM });
        }
      }}
      style={{ height: ITEM * 3, overflow: 'hidden' }}
    >
      <View pointerEvents="none" style={{ position: 'absolute', top: ITEM, left: 0, right: 0, height: ITEM, borderRadius: radius.field, backgroundColor: c.surface2 }} />
      <FlatList
        ref={ref}
        data={values}
        keyExtractor={(v) => String(v)}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM}
        decelerationRate="fast"
        getItemLayout={(_, i) => ({ length: ITEM, offset: ITEM * i, index: i })}
        contentContainerStyle={{ paddingVertical: ITEM }}
        onMomentumScrollEnd={settle}
        onScrollEndDrag={settle}
        renderItem={({ item }) => (
          <View style={{ height: ITEM, alignItems: 'center', justifyContent: 'center' }}>
            <Txt v={item === value ? 'heading' : 'body'} color={item === value ? 'ink' : 'muted'} num>
              {format(item)}
            </Txt>
          </View>
        )}
      />
    </View>
  );
}
