import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { AppText, Card, Divider, Icon, ListRow } from '@/components/ui';
import { spacing } from '@/theme/colors';
import { useColors } from '@/theme/use-theme';

const STEPS = [
  ['1', 'Prompt erzeugen', 'Satzwerk baut aus Ziel, Erfahrung, Equipment und (beim Überarbeiten) deinem Verlauf einen fertigen Prompt.'],
  ['2', 'In eine KI einfügen', 'Teile ihn an Claude, ChatGPT o. ä. oder kopiere ihn. Die KI antwortet mit einem JSON-Plan.'],
  ['3', 'Antwort importieren', 'Antwort hier einfügen, Übungen prüfen – fertig sind deine Routinen.'],
];

export default function AIHubScreen() {
  const c = useColors();
  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 48 }}>
      <Card>
        {STEPS.map(([n, title, text]) => (
          <View key={n} style={{ flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.xs }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.accentMuted, alignItems: 'center', justifyContent: 'center' }}>
              <AppText accent style={{ fontWeight: '800' }}>
                {n}
              </AppText>
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={{ fontWeight: '700' }}>{title}</AppText>
              <AppText variant="caption" muted>
                {text}
              </AppText>
            </View>
          </View>
        ))}
      </Card>
      <Card style={{ paddingVertical: spacing.xs }}>
        <ListRow icon="creation" title="Neuen Plan erstellen" subtitle="Plan von Grund auf" onPress={() => router.push({ pathname: '/ai/prompt', params: { mode: 'new' } })} />
        <Divider />
        <ListRow icon="chart-timeline-variant" title="Plan überarbeiten" subtitle="Progression & Deload anhand deines Verlaufs" onPress={() => router.push({ pathname: '/ai/prompt', params: { mode: 'revise' } })} />
        <Divider />
        <ListRow icon="content-paste" title="KI-Antwort einfügen" subtitle="Direkt zum Import" onPress={() => router.push({ pathname: '/ai/import', params: { mode: 'new' } })} />
      </Card>
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
        <Icon name="shield-check-outline" size={18} color={c.textMuted} />
        <AppText variant="caption" muted style={{ flex: 1 }}>
          Satzwerk sendet nichts selbst an eine KI. Du entscheidest, was du wohin teilst. Der Prompt enthält keine Fotos und keinen Namen.
        </AppText>
      </View>
    </ScrollView>
  );
}
