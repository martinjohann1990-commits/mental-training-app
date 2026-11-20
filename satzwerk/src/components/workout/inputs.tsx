import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';

import { formatDuration, parseDuration } from '@/domain/units';
import { formatDecimal, parseDecimal } from '@/lib/number';
import { radius } from '@/theme/colors';
import { useColors } from '@/theme/use-theme';

import { notifyInputFocus } from '../form-scroll';
import { AppText } from '../ui';

function useSyncedText(value: number | null, format: (n: number) => string) {
  const [text, setText] = useState(value === null ? '' : format(value));
  const [last, setLast] = useState(value);
  // Externe Änderungen (z. B. „Vorher“ übernommen) in das Feld spiegeln.
  if (last !== value) {
    setLast(value);
    const parsedCurrent = text;
    if (value === null || parsedCurrent === '' || format(value) !== parsedCurrent) {
      setText(value === null ? '' : format(value));
    }
  }
  return [text, setText, setLast] as const;
}

type CellProps = {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  accessibilityLabel: string;
  completed?: boolean;
  integer?: boolean;
  allowNegative?: boolean;
};

/** Zahlenfeld für Satzwerte. Kommt mit Komma und Punkt klar; leer = null. */
export function NumberCell({ value, onChange, placeholder, accessibilityLabel, completed, integer, allowNegative }: CellProps) {
  const c = useColors();
  const [text, setText, setLast] = useSyncedText(value, (n) => (integer ? String(Math.round(n)) : formatDecimal(n)));
  return (
    <TextInput
      accessibilityLabel={accessibilityLabel}
      value={text}
      placeholder={placeholder}
      placeholderTextColor={c.textMuted}
      keyboardType={integer ? 'number-pad' : 'decimal-pad'}
      selectTextOnFocus
      onFocus={notifyInputFocus}
      onChangeText={(t) => {
        setText(t);
        const neg = allowNegative && t.trim().startsWith('-');
        const raw = neg ? t.trim().slice(1) : t;
        if (raw.trim() === '') {
          if (!neg) {
            setLast(null);
            onChange(null);
          }
          return;
        }
        const n = parseDecimal(raw);
        if (n === null) return;
        const v = (neg ? -1 : 1) * (integer ? Math.round(n) : n);
        setLast(v);
        onChange(v);
      }}
      style={[
        styles.cell,
        { color: c.text, backgroundColor: completed ? 'transparent' : c.surfaceAlt },
      ]}
    />
  );
}

/** Dauerfeld (mm:ss oder Sekunden). */
export function DurationCell({ value, onChange, placeholder, accessibilityLabel, completed }: CellProps) {
  const c = useColors();
  const [text, setText, setLast] = useSyncedText(value, formatDuration);
  return (
    <TextInput
      accessibilityLabel={accessibilityLabel}
      value={text}
      placeholder={placeholder ?? '0:00'}
      placeholderTextColor={c.textMuted}
      keyboardType="numbers-and-punctuation"
      selectTextOnFocus
      onFocus={notifyInputFocus}
      onChangeText={(t) => {
        setText(t);
        if (t.trim() === '') {
          setLast(null);
          onChange(null);
          return;
        }
        const n = parseDuration(t);
        if (n !== null) {
          setLast(n);
          onChange(n);
        }
      }}
      style={[styles.cell, { color: c.text, backgroundColor: completed ? 'transparent' : c.surfaceAlt }]}
    />
  );
}

/** Gewichtsfeld, das statt Tastatur eine Auswahl öffnet (Kettlebells/Kurzhanteln). */
export function PickerCell({
  label,
  placeholder,
  onPress,
  accessibilityLabel,
  completed,
}: {
  label: string | null;
  placeholder?: string;
  onPress: () => void;
  accessibilityLabel: string;
  completed?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={[styles.cell, { justifyContent: 'center', backgroundColor: completed ? 'transparent' : c.surfaceAlt }]}>
      <AppText style={{ textAlign: 'center', fontWeight: '600', color: label ? c.text : c.textMuted }}>
        {label ?? placeholder ?? '–'}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    minWidth: 0,
    height: 38,
    borderRadius: radius.sm,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 4,
  },
});
