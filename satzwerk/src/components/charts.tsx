import { useState } from 'react';
import { type GestureResponderEvent, type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { radius, spacing } from '@/theme/colors';
import { useColors } from '@/theme/use-theme';

import { AppText } from './ui';

const PAD = { top: 12, right: 12, bottom: 22, left: 40 };

/** "Schöne" Achsenschritte (1, 2, 2.5, 5 × 10^n). */
function niceTicks(min: number, max: number, count = 3): number[] {
  if (min === max) {
    const d = Math.abs(min) * 0.1 || 1;
    min -= d;
    max += d;
  }
  const span = max - min;
  const raw = span / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  // Bis mindestens zum Maximum, damit kein Punkt über dem Plot liegt.
  for (let v = start; ticks.length < 12; v += step) {
    ticks.push(Math.round(v * 1000) / 1000);
    if (v >= max - 1e-9 && ticks.length >= 2) break;
  }
  return ticks;
}

function useWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [w, setW] = useState(0);
  return [w, (e) => setW(e.nativeEvent.layout.width)];
}

type Point = { x: number; y: number };

/** Antippen/Ziehen wählt den nächstgelegenen Punkt. */
function useScrub(count: number, xOf: (i: number) => number) {
  const [selected, setSelected] = useState<number | null>(null);
  const pick = (e: GestureResponderEvent) => {
    const lx = e.nativeEvent.locationX;
    let best = 0;
    for (let i = 1; i < count; i++) if (Math.abs(xOf(i) - lx) < Math.abs(xOf(best) - lx)) best = i;
    setSelected(count ? best : null);
  };
  const handlers = {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderGrant: pick,
    onResponderMove: pick,
  };
  return { selected, setSelected, handlers };
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.readout}>
      <AppText variant="caption" muted>
        {label}
      </AppText>
      <AppText style={{ fontWeight: '800', fontVariant: ['tabular-nums'] }}>{value}</AppText>
    </View>
  );
}

export { niceTicks };

/** Einfaches Liniendiagramm (eine Serie) mit Antipp-Anzeige. */
export function LineChart({
  points,
  formatY,
  formatX,
  height = 180,
  accessibilityLabel,
  target,
}: {
  points: Point[];
  formatY: (v: number) => string;
  formatX: (v: number) => string;
  height?: number;
  accessibilityLabel: string;
  /** Optionale Ziellinie (gestrichelt). */
  target?: number;
}) {
  const c = useColors();
  const [width, onLayout] = useWidth();
  const ys = [...points.map((p) => p.y), ...(target !== undefined ? [target] : [])];
  const ticks = niceTicks(Math.min(...ys), Math.max(...ys));
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const xMin = points[0]?.x ?? 0;
  const xMax = points[points.length - 1]?.x ?? 1;
  const plotW = Math.max(1, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;
  const sx = (x: number) => PAD.left + (xMax === xMin ? plotW / 2 : ((x - xMin) / (xMax - xMin)) * plotW);
  const sy = (y: number) => PAD.top + plotH - ((y - yMin) / (yMax - yMin || 1)) * plotH;
  const { selected, handlers } = useScrub(points.length, (i) => sx(points[i].x));
  const active = selected ?? points.length - 1;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');

  if (points.length === 0) return null;
  const ap = points[active];

  return (
    <View>
      <Readout label={formatX(ap.x)} value={formatY(ap.y)} />
      <View onLayout={onLayout} style={{ height }} accessible accessibilityLabel={accessibilityLabel} {...handlers}>
        {width > 0 && (
          <Svg width={width} height={height} pointerEvents="none">
            {ticks.map((t) => (
              <Line key={t} x1={PAD.left} x2={width - PAD.right} y1={sy(t)} y2={sy(t)} stroke={c.border} strokeWidth={1} />
            ))}
            {ticks.map((t) => (
              <SvgText key={`l${t}`} x={PAD.left - 6} y={sy(t) + 4} fontSize={11} fontFamily="sans-serif" fill={c.textMuted} textAnchor="end">
                {formatY(t).replace(/\s.*$/, '')}
              </SvgText>
            ))}
            <SvgText x={PAD.left} y={height - 6} fontSize={11} fontFamily="sans-serif" fill={c.textMuted} textAnchor="start">
              {formatX(xMin)}
            </SvgText>
            {points.length > 1 && (
              <SvgText x={width - PAD.right} y={height - 6} fontSize={11} fontFamily="sans-serif" fill={c.textMuted} textAnchor="end">
                {formatX(xMax)}
              </SvgText>
            )}
            {target !== undefined && (
              <>
                <Line x1={PAD.left} x2={width - PAD.right} y1={sy(target)} y2={sy(target)} stroke={c.success} strokeWidth={1.5} strokeDasharray="6,4" />
                <SvgText x={width - PAD.right} y={sy(target) - 4} fontSize={11} fontFamily="sans-serif" fill={c.textMuted} textAnchor="end">
                  Ziel
                </SvgText>
              </>
            )}
            {points.length > 1 && <Path d={d} stroke={c.accent} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />}
            {points.length <= 24 &&
              points.map((p, i) => (
                <Circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={2.5} fill={c.accent} />
              ))}
            <Line x1={sx(ap.x)} x2={sx(ap.x)} y1={PAD.top} y2={PAD.top + plotH} stroke={c.textMuted} strokeWidth={1} strokeDasharray="3,3" />
            <Circle cx={sx(ap.x)} cy={sy(ap.y)} r={5} fill={c.accent} stroke={c.surface} strokeWidth={2} />
          </Svg>
        )}
      </View>
    </View>
  );
}

/** Säulendiagramm (eine Serie), z. B. Volumen pro Woche. */
export function BarChart({
  bars,
  formatY,
  formatLabel,
  formatReadout,
  height = 170,
  accessibilityLabel,
}: {
  bars: { key: string; value: number }[];
  formatY: (v: number) => string;
  formatLabel: (i: number) => string | null;
  formatReadout: (i: number) => string;
  height?: number;
  accessibilityLabel: string;
}) {
  const c = useColors();
  const [width, onLayout] = useWidth();
  const max = Math.max(0, ...bars.map((b) => b.value));
  const ticks = niceTicks(0, max || 1).filter((t) => t >= 0);
  const yMax = ticks[ticks.length - 1] || 1;
  const plotW = Math.max(1, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;
  const slot = plotW / Math.max(1, bars.length);
  const barW = Math.max(3, Math.min(28, slot - 2)); // ≥ 2 px Lücke
  const sx = (i: number) => PAD.left + slot * i + slot / 2;
  const sy = (v: number) => PAD.top + plotH - (v / yMax) * plotH;
  const { selected, handlers } = useScrub(bars.length, sx);
  const active = selected ?? bars.length - 1;

  if (bars.length === 0) return null;

  return (
    <View>
      <Readout label={formatReadout(active)} value={formatY(bars[active].value)} />
      <View onLayout={onLayout} style={{ height }} accessible accessibilityLabel={accessibilityLabel} {...handlers}>
        {width > 0 && (
          <Svg width={width} height={height} pointerEvents="none">
            {ticks.map((t) => (
              <Line key={t} x1={PAD.left} x2={width - PAD.right} y1={sy(t)} y2={sy(t)} stroke={c.border} strokeWidth={1} />
            ))}
            {ticks.map((t) => (
              <SvgText key={`l${t}`} x={PAD.left - 6} y={sy(t) + 4} fontSize={11} fontFamily="sans-serif" fill={c.textMuted} textAnchor="end">
                {formatY(t).replace(/\s.*$/, '')}
              </SvgText>
            ))}
            {bars.map((b, i) => {
              const h = Math.max(0, sy(0) - sy(b.value));
              const x = sx(i) - barW / 2;
              const r = Math.min(4, barW / 2, h);
              // Oben abgerundet, unten bündig an der Grundlinie.
              const path =
                h <= 0
                  ? ''
                  : `M${x},${sy(0)} L${x},${sy(b.value) + r} Q${x},${sy(b.value)} ${x + r},${sy(b.value)} L${x + barW - r},${sy(b.value)} Q${x + barW},${sy(b.value)} ${x + barW},${sy(b.value) + r} L${x + barW},${sy(0)} Z`;
              return path ? <Path key={b.key} d={path} fill={c.accent} opacity={i === active ? 1 : 0.55} /> : null;
            })}
            {bars.map((b, i) => {
              const label = formatLabel(i);
              return label ? (
                <SvgText key={`x${b.key}`} x={sx(i)} y={height - 6} fontSize={11} fontFamily="sans-serif" fill={c.textMuted} textAnchor="middle">
                  {label}
                </SvgText>
              ) : null;
            })}
            <Rect x={PAD.left} y={sy(0)} width={plotW} height={1} fill={c.textMuted} />
          </Svg>
        )}
      </View>
    </View>
  );
}

/** Horizontale Balkenliste (Werte immer als Text daneben). */
export function HBarList({
  rows,
  formatValue,
}: {
  rows: { key: string; label: string; value: number }[];
  formatValue: (v: number) => string;
}) {
  const c = useColors();
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <View style={{ gap: spacing.sm }}>
      {rows.map((r) => (
        <View key={r.key} style={{ gap: 4 }} accessible accessibilityLabel={`${r.label}: ${formatValue(r.value)}`}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <AppText variant="caption">{r.label}</AppText>
            <AppText variant="caption" muted style={{ fontVariant: ['tabular-nums'] }}>
              {formatValue(r.value)}
            </AppText>
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: c.surfaceAlt, overflow: 'hidden' }}>
            <View style={{ width: `${(r.value / max) * 100}%`, height: 8, borderRadius: 4, backgroundColor: c.accent }} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function StatTile({ label, value, sub }: { label: string; value: string; sub?: string | null }) {
  const c = useColors();
  return (
    <View style={[styles.tile, { backgroundColor: c.surface }]}>
      <AppText variant="caption" muted>
        {label}
      </AppText>
      <AppText variant="heading" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </AppText>
      {sub ? (
        <AppText variant="caption" muted>
          {sub}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.xs },
  tile: { flexBasis: '47%', flexGrow: 1, borderRadius: radius.lg, padding: spacing.md, gap: 2 },
});
