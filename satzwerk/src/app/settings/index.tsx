import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { AppText, Card, ListRow, Segmented, SectionHeader } from '@/components/ui';
import { useActiveEquipment } from '@/hooks/use-equipment';
import { useSettings } from '@/stores/settings';
import { spacing } from '@/theme/colors';

export default function SettingsScreen() {
  const { unit, theme, setUnit, setTheme } = useSettings();
  const active = useActiveEquipment();
  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}>
      <SectionHeader>Einheiten</SectionHeader>
      <Card>
        <Segmented
          options={[
            { value: 'kg', label: 'kg / cm' },
            { value: 'lbs', label: 'lbs / in' },
          ]}
          value={unit}
          onChange={setUnit}
        />
        <AppText variant="caption" muted>
          Gespeichert wird intern immer in kg – die Umrechnung betrifft nur die Anzeige.
        </AppText>
      </Card>

      <SectionHeader>Darstellung</SectionHeader>
      <Card>
        <Segmented
          options={[
            { value: 'dark', label: 'Dunkel' },
            { value: 'light', label: 'Hell' },
            { value: 'system', label: 'System' },
          ]}
          value={theme}
          onChange={setTheme}
        />
      </Card>

      <SectionHeader>Equipment</SectionHeader>
      <Card style={{ paddingVertical: spacing.xs }}>
        <ListRow
          icon="kettlebell"
          title="Mein Equipment"
          subtitle={active ? `Aktives Profil: ${active.name}` : undefined}
          onPress={() => router.push('/settings/equipment')}
        />
      </Card>
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
