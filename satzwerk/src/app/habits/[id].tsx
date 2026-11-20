import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { StatTile } from '@/components/charts';
import { HabitHeatmap, HabitTodayRow, habitTargetText } from '@/components/habits-goals';
import { AppText, Button, Card, EmptyState } from '@/components/ui';
import { completionRate } from '@/domain/habits';
import { useHabits } from '@/hooks/use-habits';
import { spacing } from '@/theme/colors';

export default function HabitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { habits, today, loaded } = useHabits();
  const h = habits.find((x) => x.id === id);
  if (!loaded) return null;
  if (!h) return <EmptyState icon="alert-circle-outline" title="Gewohnheit nicht gefunden" />;
  const weekly = h.frequency === 'weekly' || h.kind === 'workouts';

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 48 }}>
      <Stack.Screen options={{ title: h.name }} />
      <AppText muted>{habitTargetText(h)}</AppText>
      <Card style={{ paddingVertical: 0 }}>
        <HabitTodayRow h={h} day={today} />
      </Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <StatTile label="Aktuelle Serie" value={`${h.streak.current} ${h.streak.unit}`} />
        <StatTile label="Beste Serie" value={`${h.streak.best} ${h.streak.unit}`} />
        <StatTile
          label={weekly ? 'Erfüllt (8 Wochen)' : 'Erfüllt (30 Tage)'}
          value={`${completionRate(h, h.values, today, weekly ? 8 : 30)} %`}
        />
        {weekly && <StatTile label="Diese Woche" value={`${h.streak.periodCount} / ${h.streak.periodTarget}`} />}
      </View>
      <Card>
        <HabitHeatmap h={h} today={today} />
      </Card>
      {h.reminderTime && (
        <AppText variant="caption" muted>
          Erinnerung täglich um {h.reminderTime} Uhr
        </AppText>
      )}
      <Button title="Bearbeiten" icon="pencil-outline" variant="secondary" onPress={() => router.push({ pathname: '/habits/edit', params: { id: h.id } })} />
    </ScrollView>
  );
}
