import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { AppText, Button, Card, Divider, Icon, ListRow, SectionHeader } from '@/components/ui';
import { createProfile } from '@/db/repo/equipment';
import { parseEquipmentConfig } from '@/domain/equipment';
import { useEquipmentProfiles } from '@/hooks/use-equipment';
import { useEquipmentCatalog } from '@/hooks/use-equipment-catalog';
import { useSettings } from '@/stores/settings';
import { spacing } from '@/theme/colors';
import { useColors } from '@/theme/use-theme';

export default function EquipmentProfilesScreen() {
  const c = useColors();
  const profiles = useEquipmentProfiles();
  const { label: equipmentLabel } = useEquipmentCatalog();
  const { activeProfileId, setActiveProfileId } = useSettings();

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}>
      <AppText muted>
        Das aktive Profil bestimmt, welche Übungen und Gewichte dir vorgeschlagen werden – und was der KI-Prompt als
        verfügbares Equipment angibt.
      </AppText>
      <SectionHeader>Profile</SectionHeader>
      <Card style={{ paddingVertical: spacing.xs }}>
        {profiles.map((p, i) => {
          const cfg = parseEquipmentConfig(p.config);
          const isActive = p.id === activeProfileId;
          return (
            <View key={p.id}>
              {i > 0 && <Divider />}
              <ListRow
                icon={isActive ? 'check-circle' : 'circle-outline'}
                title={p.name}
                subtitle={cfg.available.filter((e) => e !== 'bodyweight').map(equipmentLabel).join(', ') || 'Nur Körpergewicht'}
                onPress={() => router.push({ pathname: '/settings/equipment/[id]', params: { id: p.id } })}
                right={
                  isActive ? (
                    <AppText variant="caption" accent>
                      Aktiv
                    </AppText>
                  ) : (
                    <Button title="Aktivieren" small variant="ghost" onPress={() => setActiveProfileId(p.id)} />
                  )
                }
              />
            </View>
          );
        })}
      </Card>
      <Button
        title="Neues Profil"
        icon="plus"
        variant="secondary"
        onPress={async () => {
          const id = await createProfile('Neues Profil');
          router.push({ pathname: '/settings/equipment/[id]', params: { id } });
        }}
      />
      <AppText variant="caption" muted style={{ marginTop: spacing.sm }}>
        <Icon name="information-outline" size={14} color={c.textMuted} /> Tippe auf ein Profil, um Geräte und Gewichte zu
        bearbeiten.
      </AppText>
    </ScrollView>
  );
}
