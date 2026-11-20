import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { HabitTodayRow } from '@/components/habits-goals';
import { Button, Card, Divider, EmptyState } from '@/components/ui';
import { useHabits } from '@/hooks/use-habits';
import { spacing } from '@/theme/colors';

export default function HabitsScreen() {
  const { habits, today, loaded } = useHabits();
  if (!loaded) return null;
  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 48 }}>
      <Button title="Neue Gewohnheit" icon="plus" onPress={() => router.push('/habits/edit')} />
      {habits.length === 0 ? (
        <EmptyState
          icon="checkbox-marked-circle-outline"
          title="Noch keine Gewohnheiten"
          text="z. B. „Dehnen“ (Ja/Nein), „Wasser 3 l“ (Zahl) oder „4× Training pro Woche“."
        />
      ) : (
        <Card style={{ paddingVertical: spacing.xs }}>
          {habits.map((h, i) => (
            <View key={h.id}>
              {i > 0 && <Divider />}
              <HabitTodayRow h={h} day={today} />
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}
