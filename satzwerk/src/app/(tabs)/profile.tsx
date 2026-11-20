import { router } from 'expo-router';
import { ScrollView } from 'react-native';

import { Card, Divider, ListRow, SectionHeader } from '@/components/ui';
import { useActiveEquipment } from '@/hooks/use-equipment';
import { spacing } from '@/theme/colors';

export default function ProfileScreen() {
  const active = useActiveEquipment();
  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
      <SectionHeader>Training</SectionHeader>
      <Card style={{ paddingVertical: spacing.xs }}>
        <ListRow
          icon="kettlebell"
          title="Mein Equipment"
          subtitle={active ? `Aktiv: ${active.name}` : undefined}
          onPress={() => router.push('/settings/equipment')}
        />
      </Card>
      <SectionHeader>App</SectionHeader>
      <Card style={{ paddingVertical: spacing.xs }}>
        <ListRow icon="cog-outline" title="Einstellungen" subtitle="Einheiten, Darstellung, App-Sperre" onPress={() => router.push('/settings')} />
        <Divider />
        <ListRow icon="chart-line" title="Statistiken" subtitle="Rekorde, Volumen, Rückblicke" onPress={() => router.push('/stats')} />
        <Divider />
        <ListRow icon="human" title="Körpermaße & Fototagebuch" subtitle="Gewicht, Umfänge, Fortschrittsfotos" onPress={() => router.push('/body')} />
      </Card>
    </ScrollView>
  );
}
