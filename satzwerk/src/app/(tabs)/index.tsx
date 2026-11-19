import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { AppText, Button, Card, SectionHeader } from '@/components/ui';
import { useActiveEquipment } from '@/hooks/use-equipment';
import { spacing } from '@/theme/colors';

export default function TrainingScreen() {
  const active = useActiveEquipment();
  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="title">
          Satz<AppText variant="title" accent>werk</AppText>
        </AppText>
        <AppText muted>Dein Trainingslog – lokal auf deinem Gerät.</AppText>
      </View>

      <Button title="Leeres Workout starten" icon="play" disabled />
      <AppText variant="caption" muted>
        Live-Workouts, Routinen und Pausentimer kommen in Phase 2.
      </AppText>

      <SectionHeader>Schnellzugriff</SectionHeader>
      <Card>
        <AppText variant="label" muted>
          Aktives Equipment-Profil
        </AppText>
        <AppText variant="heading">{active?.name ?? '–'}</AppText>
        <Button title="Equipment verwalten" icon="kettlebell" variant="secondary" small onPress={() => router.push('/settings/equipment')} />
      </Card>
      <Card>
        <AppText variant="label" muted>
          Übungsbibliothek
        </AppText>
        <AppText>Durchsuche alle Übungen inkl. Kettlebell-Komplexe oder lege eigene an.</AppText>
        <Button title="Zur Bibliothek" icon="format-list-bulleted" variant="secondary" small onPress={() => router.push('/exercises')} />
      </Card>
    </ScrollView>
  );
}
