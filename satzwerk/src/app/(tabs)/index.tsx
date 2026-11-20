import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Sheet, SheetItem } from '@/components/sheet';
import { AppText, Button, Card, Chip, ChipRow, Divider, EmptyState, Icon, ListRow, SectionHeader, TextField } from '@/components/ui';
import { useNow } from '@/components/workout/rest-bar';
import {
  allFoldersQuery,
  allRoutinesQuery,
  createFolder,
  deleteFolder,
  deleteRoutine,
  duplicateRoutine,
  moveRoutineToFolder,
  renameFolder,
} from '@/db/repo/routines';
import { recentWorkoutsQuery } from '@/db/repo/workouts';
import type { RoutineRow } from '@/db/schema';
import { routineToDraftExercises } from '@/domain/routine';
import { formatDuration, formatWeight } from '@/domain/units';
import { GoalCard, HabitTodayRow } from '@/components/habits-goals';
import { useBackupReminder } from '@/hooks/use-backup-reminder';
import { useBodyData } from '@/hooks/use-body';
import { useExerciseMap } from '@/hooks/use-exercise-map';
import { useGoals } from '@/hooks/use-goals';
import { useHabits } from '@/hooks/use-habits';
import { confirmAction } from '@/lib/confirm';
import { startWorkoutFrom } from '@/lib/start-workout';
import { useActiveWorkout } from '@/stores/active-workout';
import { useSettings } from '@/stores/settings';
import { radius, spacing } from '@/theme/colors';
import { useColors } from '@/theme/use-theme';

function ActiveBanner() {
  const c = useColors();
  const draft = useActiveWorkout((s) => s.draft);
  const now = useNow(1000);
  if (!draft) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Laufendes Workout fortsetzen"
      onPress={() => router.push('/workout/active')}
      style={{ backgroundColor: c.accent, borderRadius: radius.lg, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <Icon name="play-circle" size={32} color={c.onAccent} />
      <View style={{ flex: 1 }}>
        <AppText style={{ color: c.onAccent, fontWeight: '800' }}>Workout läuft · {formatDuration((now - draft.startedAt) / 1000)}</AppText>
        <AppText style={{ color: c.onAccent }} numberOfLines={1}>
          {draft.name} – tippen zum Fortsetzen
        </AppText>
      </View>
    </Pressable>
  );
}

function greetingName(): string {
  const h = new Date().getHours();
  if (h < 11) return 'Morgen-Workout';
  if (h < 17) return 'Mittags-Workout';
  return 'Abend-Workout';
}

export default function TrainingScreen() {
  const c = useColors();
  const map = useExerciseMap();
  const unit = useSettings((s) => s.unit);
  const draft = useActiveWorkout((s) => s.draft);
  const { data: routines } = useLiveQuery(allRoutinesQuery());
  const { data: folders } = useLiveQuery(allFoldersQuery());
  const { data: recent } = useLiveQuery(recentWorkoutsQuery(5));
  const [menuFor, setMenuFor] = useState<RoutineRow | null>(null);
  const [folderMenu, setFolderMenu] = useState<{ id: string; name: string } | null>(null);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const { habits, today } = useHabits();
  const backup = useBackupReminder();
  const { goals } = useGoals();
  const { fields } = useBodyData();
  const openGoals = goals.filter((g) => !g.evaluation.reached).slice(0, 3);

  const groups: { id: string | null; name: string; items: RoutineRow[] }[] = [
    ...folders.map((f) => ({ id: f.id as string | null, name: f.name, items: routines.filter((r) => r.folderId === f.id) })),
    { id: null, name: folders.length ? 'Ohne Ordner' : 'Meine Routinen', items: routines.filter((r) => !r.folderId || !folders.some((f) => f.id === r.folderId)) },
  ];

  const summary = (r: RoutineRow) =>
    r.exercises
      .map((e) => map.get(e.exerciseId)?.name)
      .filter(Boolean)
      .join(', ') || 'Noch keine Übungen';

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 48 }}>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="title">
          Satz<AppText variant="title" accent>werk</AppText>
        </AppText>
      </View>

      <ActiveBanner />
      {backup.remind && (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: c.accent }}>
          <Icon name="cloud-alert-outline" color={c.accent} size={28} />
          <View style={{ flex: 1 }}>
            <AppText style={{ fontWeight: '700' }}>{backup.daysSince === null ? 'Noch kein Backup' : `Letztes Backup vor ${backup.daysSince} Tagen`}</AppText>
            <AppText variant="caption" muted>
              Deine Daten liegen nur auf diesem Handy.
            </AppText>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              <Button title="Jetzt sichern" small onPress={() => router.push('/settings/backup')} />
              <Button title="Später" small variant="ghost" onPress={backup.snooze} />
            </View>
          </View>
        </Card>
      )}
      {!draft && <Button title="Leeres Workout starten" icon="play" onPress={() => startWorkoutFrom(greetingName(), [])} />}

      {habits.length > 0 && (
        <>
          <SectionHeader action={<Button title="Alle" variant="ghost" small onPress={() => router.push('/habits')} />}>Heute</SectionHeader>
          <Card style={{ paddingVertical: 0 }}>
            {habits.map((h, i) => (
              <View key={h.id}>
                {i > 0 && <Divider />}
                <HabitTodayRow h={h} day={today} />
              </View>
            ))}
          </Card>
        </>
      )}

      {openGoals.length > 0 && (
        <>
          <SectionHeader action={<Button title="Alle" variant="ghost" small onPress={() => router.push('/goals')} />}>Ziele</SectionHeader>
          {openGoals.map((g) => (
            <GoalCard
              key={g.id}
              g={g}
              unit={unit}
              measureUnit={fields.find((f) => f.key === g.refId)?.unit}
              habitUnit={habits.find((h) => h.id === g.refId)?.streak.unit}
            />
          ))}
        </>
      )}

      <SectionHeader
        action={
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button title="KI" icon="creation" variant="ghost" small onPress={() => router.push('/ai')} />
            <Button title="Ordner" icon="folder-plus-outline" variant="ghost" small onPress={() => setFolderName('')} />
            <Button title="Routine" icon="plus" variant="ghost" small onPress={() => router.push({ pathname: '/routine/[id]', params: { id: 'new' } })} />
          </View>
        }>
        Routinen
      </SectionHeader>

      {routines.length === 0 && folders.length === 0 && (
        <Card>
          <EmptyState icon="clipboard-list-outline" title="Noch keine Routinen" text="Lege eine Routine an oder speichere ein Workout als Routine." />
        </Card>
      )}

      {groups.map((g) =>
        g.items.length === 0 && g.id === null ? null : (
          <View key={g.id ?? 'none'} style={{ gap: spacing.sm }}>
            {(folders.length > 0 || !!g.id) && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Pressable
                  onPress={() => setCollapsed((s) => ({ ...s, [g.id ?? 'none']: !s[g.id ?? 'none'] }))}
                  onLongPress={() => g.id && setFolderMenu({ id: g.id, name: g.name })}
                  accessibilityRole="button"
                  accessibilityLabel={`Ordner ${g.name}`}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Icon name={collapsed[g.id ?? 'none'] ? 'folder-outline' : 'folder-open-outline'} color={c.textMuted} size={20} />
                  <AppText style={{ fontWeight: '700', flex: 1 }}>
                    {g.name} <AppText muted>({g.items.length})</AppText>
                  </AppText>
                </Pressable>
                {g.id && (
                  <Pressable accessibilityRole="button" accessibilityLabel={`Optionen für Ordner ${g.name}`} hitSlop={10} onPress={() => setFolderMenu({ id: g.id!, name: g.name })}>
                    <Icon name="dots-horizontal" color={c.textMuted} />
                  </Pressable>
                )}
              </View>
            )}
            {!collapsed[g.id ?? 'none'] &&
              g.items.map((r) => (
                <Card key={r.id} style={{ gap: spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Routine ${r.name} öffnen`}
                      onPress={() => router.push({ pathname: '/routine/[id]', params: { id: r.id } })}
                      style={{ flex: 1 }}>
                      <AppText variant="heading">{r.name}</AppText>
                      <AppText variant="caption" muted numberOfLines={2}>
                        {summary(r)}
                      </AppText>
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Optionen für ${r.name}`} hitSlop={10} onPress={() => setMenuFor(r)}>
                      <Icon name="dots-vertical" color={c.textMuted} />
                    </Pressable>
                  </View>
                  <Button
                    title="Routine starten"
                    small
                    icon="play"
                    disabled={r.exercises.length === 0}
                    onPress={() => startWorkoutFrom(r.name, routineToDraftExercises(r.exercises), r.id)}
                  />
                </Card>
              ))}
          </View>
        ),
      )}

      <SectionHeader>Letzte Workouts</SectionHeader>
      {recent.length === 0 ? (
        <AppText muted>Noch keine Workouts gespeichert.</AppText>
      ) : (
        <Card style={{ paddingVertical: spacing.xs }}>
          {recent.map((w, i) => (
            <View key={w.id}>
              {i > 0 && <Divider />}
              <ListRow
                icon="history"
                title={w.name}
                subtitle={`${w.startedAt.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })} · ${formatDuration(
                  (w.endedAt.getTime() - w.startedAt.getTime()) / 1000,
                )} · ${w.setCount} Sätze · ${formatWeight(w.volume, unit)}`}
                onPress={() => router.push({ pathname: '/workout/[id]', params: { id: w.id } })}
              />
            </View>
          ))}
        </Card>
      )}

      <Sheet visible={!!menuFor} onClose={() => setMenuFor(null)} title={menuFor?.name}>
        {menuFor && (
          <>
            <SheetItem icon="pencil-outline" label="Bearbeiten" onPress={() => { setMenuFor(null); router.push({ pathname: '/routine/[id]', params: { id: menuFor.id } }); }} />
            <SheetItem icon="content-copy" label="Duplizieren" onPress={() => { void duplicateRoutine(menuFor.id); setMenuFor(null); }} />
            {folders.length > 0 && (
              <View style={{ paddingVertical: spacing.sm, gap: spacing.sm }}>
                <AppText variant="label" muted>
                  In Ordner verschieben
                </AppText>
                <ChipRow>
                  <Chip label="Kein Ordner" selected={!menuFor.folderId} onPress={() => { void moveRoutineToFolder(menuFor.id, null); setMenuFor(null); }} />
                  {folders.map((f) => (
                    <Chip key={f.id} label={f.name} selected={menuFor.folderId === f.id} onPress={() => { void moveRoutineToFolder(menuFor.id, f.id); setMenuFor(null); }} />
                  ))}
                </ChipRow>
              </View>
            )}
            <SheetItem
              icon="trash-can-outline"
              label="Löschen"
              danger
              onPress={() => {
                const r = menuFor;
                setMenuFor(null);
                confirmAction('Routine löschen?', `„${r.name}“ wird gelöscht.`, 'Löschen', () => void deleteRoutine(r.id));
              }}
            />
          </>
        )}
      </Sheet>

      <Sheet visible={folderName !== null} onClose={() => setFolderName(null)} title={folderMenu ? 'Ordner umbenennen' : 'Neuer Ordner'}>
        <View style={{ gap: spacing.md }}>
          <TextField value={folderName ?? ''} onChangeText={setFolderName} placeholder="z. B. Kettlebell, Push/Pull/Legs" autoFocus />
          <Button
            title="Speichern"
            onPress={async () => {
              if (folderMenu) await renameFolder(folderMenu.id, folderName ?? '');
              else await createFolder(folderName ?? '');
              setFolderName(null);
              setFolderMenu(null);
            }}
          />
        </View>
      </Sheet>

      <Sheet visible={!!folderMenu && folderName === null} onClose={() => setFolderMenu(null)} title={folderMenu?.name}>
        {folderMenu && (
          <>
            <SheetItem icon="plus" label="Neue Routine in diesem Ordner" onPress={() => { const id = folderMenu.id; setFolderMenu(null); router.push({ pathname: '/routine/[id]', params: { id: 'new', folderId: id } }); }} />
            <SheetItem icon="pencil-outline" label="Umbenennen" onPress={() => setFolderName(folderMenu.name)} />
            <SheetItem
              icon="trash-can-outline"
              label="Ordner löschen"
              hint="Routinen bleiben erhalten"
              danger
              onPress={() => {
                const f = folderMenu;
                setFolderMenu(null);
                confirmAction('Ordner löschen?', `„${f.name}“ wird gelöscht. Die Routinen darin bleiben erhalten.`, 'Löschen', () => void deleteFolder(f.id));
              }}
            />
          </>
        )}
      </Sheet>
    </ScrollView>
  );
}
