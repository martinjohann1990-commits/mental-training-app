import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing } from '@/theme/colors';
import { useColors } from '@/theme/use-theme';

import { AppText, Icon, type IconName } from './ui';

/** Einfaches Bottom-Sheet auf Basis von Modal. */
export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Schließen" />
        <View
          style={[
            styles.sheet,
            { backgroundColor: c.surface, paddingBottom: Math.max(insets.bottom, spacing.lg) },
          ]}>
          <View style={[styles.handle, { backgroundColor: c.border }]} />
          {title && (
            <AppText variant="heading" style={{ marginBottom: spacing.sm }}>
              {title}
            </AppText>
          )}
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 560 }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function SheetItem({
  icon,
  label,
  onPress,
  danger,
  hint,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  danger?: boolean;
  hint?: string;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.item, { opacity: pressed ? 0.6 : 1 }]}>
      <Icon name={icon} color={danger ? c.danger : c.text} />
      <View style={{ flex: 1 }}>
        <AppText style={{ color: danger ? c.danger : c.text, fontWeight: '600' }}>{label}</AppText>
        {hint && (
          <AppText variant="caption" muted>
            {hint}
          </AppText>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: spacing.md },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 14 },
});
