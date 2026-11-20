import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { AppText, Button, Card, ListRow, Segmented, SectionHeader, ToggleRow } from '@/components/ui';
import { useActiveEquipment } from '@/hooks/use-equipment';
import { playSound } from '@/lib/sounds';
import { useSettings } from '@/stores/settings';
import { spacing } from '@/theme/colors';

export default function SettingsScreen() {
  const { unit, theme, setUnit, setTheme, appLock, setAppLock, restSound, setRestSound } = useSettings();
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

      <SectionHeader>Pausentimer</SectionHeader>
      <Card>
        <ToggleRow
          label="Signalton"
          hint="3-2-1-Ticks und Ton am Pausenende (zusätzlich Vibration). Bei gesperrtem Handy meldet sich die Benachrichtigung."
          value={restSound}
          onChange={setRestSound}
        />
        <Button title="Ton testen" icon="volume-high" variant="secondary" small onPress={() => playSound('end', true)} />
        <AppText variant="caption" muted>
          Der Ton nutzt die Medienlautstärke deines Handys.
        </AppText>
      </Card>

      <SectionHeader>Privatsphäre</SectionHeader>
      <Card>
        <AppText style={{ fontWeight: '600' }}>App-Sperre</AppText>
        <Segmented
          options={[
            { value: 'off', label: 'Aus' },
            { value: 'photos', label: 'Fototagebuch' },
            { value: 'app', label: 'Ganze App' },
          ]}
          value={appLock}
          onChange={setAppLock}
        />
        <AppText variant="caption" muted>
          Entsperren per Fingerabdruck, Gesicht oder Geräte-PIN. Die Sperre greift wieder, sobald die App im Hintergrund war.
        </AppText>
      </Card>

      <SectionHeader>Daten</SectionHeader>
      <Card style={{ paddingVertical: spacing.xs }}>
        <ListRow icon="archive-outline" title="Backup & Wiederherstellung" subtitle="Alle Daten und Fotos als ZIP" onPress={() => router.push('/settings/backup')} />
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
