import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps, ReactNode } from 'react';
import {
  Pressable,
  type PressableProps,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  type TextInputProps,
  type TextProps,
  View,
  type ViewProps,
} from 'react-native';

import { radius, spacing } from '@/theme/colors';
import { notifyInputFocus } from './form-scroll';
import { useColors } from '@/theme/use-theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color?: string }) {
  const c = useColors();
  return <MaterialCommunityIcons name={name} size={size} color={color ?? c.text} />;
}

type Variant = 'title' | 'heading' | 'body' | 'label' | 'caption';
const textStyles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  heading: { fontSize: 18, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22 },
  label: { fontSize: 14, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18 },
});

export function AppText({
  variant = 'body',
  muted,
  accent,
  style,
  ...rest
}: TextProps & { variant?: Variant; muted?: boolean; accent?: boolean }) {
  const c = useColors();
  return (
    <Text
      style={[textStyles[variant], { color: accent ? c.accent : muted ? c.textMuted : c.text }, style]}
      {...rest}
    />
  );
}

export function Card({ style, ...rest }: ViewProps) {
  const c = useColors();
  return (
    <View
      style={[{ backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm }, style]}
      {...rest}
    />
  );
}

export function SectionHeader({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <AppText variant="label" muted style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {children}
      </AppText>
      {action}
    </View>
  );
}

type ButtonProps = Omit<PressableProps, 'children'> & {
  title: string;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  small?: boolean;
};

export function Button({ title, icon, variant = 'primary', small, disabled, style, ...rest }: ButtonProps) {
  const c = useColors();
  const bg = { primary: c.accent, secondary: c.surfaceAlt, danger: 'transparent', ghost: 'transparent' }[variant];
  const fg = { primary: c.onAccent, secondary: c.text, danger: c.danger, ghost: c.accent }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={(state) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg, opacity: disabled ? 0.4 : state.pressed ? 0.75 : 1 },
        variant === 'danger' && { borderWidth: 1, borderColor: c.danger },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      {icon && <Icon name={icon} size={small ? 18 : 20} color={fg} />}
      <Text style={[styles.buttonText, small && { fontSize: 14 }, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? c.accentMuted : c.surfaceAlt,
          borderColor: selected ? c.accent : 'transparent',
          opacity: pressed ? 0.7 : 1,
        },
      ]}>
      {icon && <Icon name={icon} size={16} color={selected ? c.accent : c.textMuted} />}
      <Text style={{ color: selected ? c.accent : c.text, fontSize: 14, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

export function TextField({ label, style, onFocus, ...rest }: TextInputProps & { label?: string }) {
  const c = useColors();
  return (
    <View style={{ gap: spacing.xs }}>
      {label && (
        <AppText variant="label" muted>
          {label}
        </AppText>
      )}
      <TextInput
        onFocus={(e) => {
          notifyInputFocus();
          onFocus?.(e);
        }}
        accessibilityLabel={rest.accessibilityLabel ?? label}
        placeholderTextColor={c.textMuted}
        style={[
          styles.input,
          { backgroundColor: c.surfaceAlt, color: c.text, borderColor: c.border },
          rest.multiline && { minHeight: 90, textAlignVertical: 'top' },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  icon,
  right,
  onPress,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  right?: ReactNode;
  onPress?: () => void;
}) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        style={({ pressed }) => [styles.row, { flex: 1, opacity: pressed ? 0.6 : 1 }]}>
        {icon && (
          <View style={[styles.rowIcon, { backgroundColor: c.surfaceAlt }]}>
            <Icon name={icon} size={20} color={c.accent} />
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <AppText style={{ fontWeight: '600' }} numberOfLines={2}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="caption" muted numberOfLines={2}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {!right && onPress ? <Icon name="chevron-right" color={c.textMuted} /> : null}
      </Pressable>
      {right}
    </View>
  );
}

export function Divider() {
  const c = useColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border }} />;
}

export function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const c = useColors();
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <AppText style={{ fontWeight: '600' }}>{label}</AppText>
        {hint && (
          <AppText variant="caption" muted>
            {hint}
          </AppText>
        )}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: c.accent, false: c.border }}
        thumbColor="#FFFFFF"
        {...({ activeThumbColor: '#FFFFFF' } as object)}
      />
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const c = useColors();
  return (
    <View style={[styles.segmented, { backgroundColor: c.surfaceAlt }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && { backgroundColor: c.accent }]}>
            <Text style={{ color: active ? c.onAccent : c.text, fontWeight: '700' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function EmptyState({ icon, title, text }: { icon: IconName; title: string; text?: string }) {
  const c = useColors();
  return (
    <View style={styles.empty}>
      <Icon name={icon} size={44} color={c.textMuted} />
      <AppText variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </AppText>
      {text && (
        <AppText muted style={{ textAlign: 'center' }}>
          {text}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  buttonSmall: { paddingVertical: 8, paddingHorizontal: spacing.md },
  buttonText: { fontSize: 16, fontWeight: '700' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  rowIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  segmented: { flexDirection: 'row', borderRadius: radius.md, padding: 3 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.sm },
  empty: { alignItems: 'center', gap: spacing.sm, padding: spacing.xxl },
});
