import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo, useState } from 'react';
import { FlatList, Modal, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { allExercisesQuery } from '@/db/repo/exercises';
import { MUSCLES } from '@/domain/catalog';
import { EMPTY_FILTER, filterExercises } from '@/domain/exercise-filter';
import { spacing } from '@/theme/colors';
import { useColors } from '@/theme/use-theme';

import { exerciseIcon } from './icons';
import { AppText, Button, Divider, Icon, ListRow, TextField } from './ui';

/**
 * Modal zur Auswahl von Übungen. Mit `multi` können mehrere markiert und
 * gemeinsam hinzugefügt werden (Reihenfolge = Auswahlreihenfolge).
 */
export function ExercisePicker({
  visible,
  onClose,
  onPick,
  onPickMany,
  multi,
  excludeIds = [],
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (id: string) => void;
  onPickMany?: (ids: string[]) => void;
  multi?: boolean;
  excludeIds?: string[];
}) {
  const c = useColors();
  const { data } = useLiveQuery(allExercisesQuery());
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const close = () => {
    setSelected([]);
    setQuery('');
    onClose();
  };
  const list = useMemo(
    () => filterExercises(data.filter((e) => !excludeIds.includes(e.id)), { ...EMPTY_FILTER, query }, null),
    [data, query, excludeIds],
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: spacing.md }}>
          <AppText variant="heading" style={{ flex: 1 }}>
            Übung auswählen
          </AppText>
          <Button title="Schließen" variant="ghost" small onPress={close} />
        </View>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <TextField placeholder="Suchen …" value={query} onChangeText={setQuery} autoFocus accessibilityLabel="Übung suchen" />
        </View>
        <FlatList
          data={list}
          keyExtractor={(e) => e.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 48 }}
          ItemSeparatorComponent={Divider}
          renderItem={({ item }) => (
            <ListRow
              title={item.name}
              subtitle={MUSCLES[item.primaryMuscle]}
              icon={exerciseIcon(item.primaryMuscle, item.equipment)}
              right={
                multi ? (
                  <Icon
                    name={selected.includes(item.id) ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                    color={selected.includes(item.id) ? c.accent : c.textMuted}
                  />
                ) : (
                  <View />
                )
              }
              onPress={() => {
                if (multi) {
                  setSelected((sel) => (sel.includes(item.id) ? sel.filter((x) => x !== item.id) : [...sel, item.id]));
                  return;
                }
                onPick(item.id);
                setQuery('');
              }}
            />
          )}
        />
        {multi && selected.length > 0 && (
          <View style={{ padding: spacing.lg }}>
            <Button
              title={`${selected.length} ${selected.length === 1 ? 'Übung' : 'Übungen'} hinzufügen`}
              icon="plus"
              onPress={() => {
                onPickMany?.(selected);
                setSelected([]);
                setQuery('');
              }}
            />
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}
