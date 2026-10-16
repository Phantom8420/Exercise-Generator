import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { Icon, type IconName } from './kit';
import { font, useTheme, type ColorName } from './theme';

function useWidth() {
  const [w, setW] = useState(0);
  return [w, (e: { nativeEvent: { layout: { width: number } } }) => setW(e.nativeEvent.layout.width)] as const;
}

/** Vertical bars with labels underneath; `highlight` gets the accent, the rest the muted series. */
export function BarChart({ data, height = 140, highlight, color = 'accent', label }: {
  data: { label: string; value: number }[];
  height?: number;
  highlight?: number;
  color?: ColorName;
  label: string;
}) {
  const { c } = useTheme();
  const [w, onLayout] = useWidth();
  const max = Math.max(1, ...data.map((d) => d.value));
  const gap = 8;
  const bw = data.length ? (w - gap * (data.length - 1)) / data.length : 0;
  const chartH = height - 22;
  return (
    <View onLayout={onLayout} accessible accessibilityLabel={`${label}: ${data.map((d) => `${d.label} ${Math.round(d.value)}`).join(', ')}`}>
      {w > 0 && (
        <Svg width={w} height={height}>
          {data.map((d, i) => {
            const h = Math.max(d.value > 0 ? 6 : 3, (d.value / max) * chartH);
            const on = highlight == null || highlight === i;
            return (
              <Rect key={i} x={i * (bw + gap)} y={chartH - h} width={bw} height={h} rx={Math.min(8, bw / 2)} fill={on ? c[color] : c.surface2} />
            );
          })}
          {data.map((d, i) => (
            <SvgText key={`t${i}`} x={i * (bw + gap) + bw / 2} y={height - 4} fontSize={11} fontFamily={font.s} fill={c.muted} textAnchor="middle">
              {d.label}
            </SvgText>
          ))}
        </Svg>
      )}
    </View>
  );
}

/** Line chart for one or two series sharing an x axis (e.g. weight and its moving average). */
export function LineChart({ series, height = 160, label }: {
  series: { values: (number | null)[]; color: ColorName; dots?: boolean; width?: number }[];
  height?: number;
  label: string;
}) {
  const { c } = useTheme();
  const [w, onLayout] = useWidth();
  const all = series.flatMap((s) => s.values).filter((v): v is number => v != null);
  const n = Math.max(...series.map((s) => s.values.length), 1);
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const span = hi - lo || 1;
  const pad = 8;
  const x = (i: number) => (n === 1 ? w / 2 : pad + (i / (n - 1)) * (w - pad * 2));
  const y = (v: number) => pad + (1 - (v - lo) / span) * (height - pad * 2);
  return (
    <View onLayout={onLayout} accessible accessibilityLabel={label}>
      {w > 0 && all.length > 0 && (
        <Svg width={w} height={height}>
          {series.map((s, si) => {
            const pts = s.values.map((v, i) => (v == null ? null : [x(i), y(v)] as const)).filter((p): p is readonly [number, number] => p != null);
            const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
            return (
              <G key={si}>
                <Path d={d} stroke={c[s.color]} strokeWidth={s.width ?? 2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
                {s.dots && pts.map((p, i) => <Circle key={i} cx={p[0]} cy={p[1]} r={3} fill={c[s.color]} />)}
              </G>
            );
          })}
        </Svg>
      )}
    </View>
  );
}

/** Hexagonal achievement badge; unearned badges render as an outline. */
export function HexBadge({ icon, earned, size = 72 }: { icon: IconName; earned: boolean; size?: number }) {
  const { c } = useTheme();
  const r = size / 2;
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return `${r + (r - 2) * Math.cos(a)},${r + (r - 2) * Math.sin(a)}`;
  }).join(' ');
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Polygon points={pts} fill={earned ? c.accent : c.surface2} stroke={earned ? c.accentPressed : c.line} strokeWidth={2} strokeLinejoin="round" />
      </Svg>
      <Icon name={icon} size={size * 0.36} color={earned ? 'onAccent' : 'muted'} />
    </View>
  );
}
