import { router } from 'expo-router';
import { ScrollView } from 'react-native';

import { GoalCard } from '@/components/habits-goals';
import { Button, EmptyState, SectionHeader } from '@/components/ui';
import { useBodyData } from '@/hooks/use-body';
import { useGoals } from '@/hooks/use-goals';
import { useHabits } from '@/hooks/use-habits';
import { useSettings } from '@/stores/settings';
import { spacing } from '@/theme/colors';

export default function GoalsScreen() {
  const unit = useSettings((s) => s.unit);
  const { goals, loaded } = useGoals();
  const { fields } = useBodyData();
  const { habits } = useHabits();
  if (!loaded) return null;
  const open = goals.filter((g) => !g.evaluation.reached);
  const done = goals.filter((g) => g.evaluation.reached);
  const card = (g: (typeof goals)[number]) => (
    <GoalCard
      key={g.id}
      g={g}
      unit={unit}
      measureUnit={fields.find((f) => f.key === g.refId)?.unit}
      habitUnit={habits.find((h) => h.id === g.refId)?.streak.unit}
    />
  );
  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 48 }}>
      <Button title="Neues Ziel" icon="plus" onPress={() => router.push('/goals/edit')} />
      {goals.length === 0 && (
        <EmptyState icon="flag-checkered" title="Noch keine Ziele" text="z. B. „100 kg Bankdrücken × 5 bis März“ oder „80 kg Körpergewicht“." />
      )}
      {open.length > 0 && <SectionHeader>Aktiv</SectionHeader>}
      {open.map(card)}
      {done.length > 0 && <SectionHeader>Erreicht 🏆</SectionHeader>}
      {done.map(card)}
    </ScrollView>
  );
}
