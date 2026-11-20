import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { AppText, Button, Card, Icon, SectionHeader } from '@/components/ui';
import { readSetting } from '@/db/repo/settings';
import { formatNumber } from '@/domain/units';
import { confirmAction, notify } from '@/lib/confirm';
import { exportBackup, type LoadedBackup, pickBackup, reloadApp, restoreBackup } from '@/lib/backup';
import { spacing } from '@/theme/colors';
import { useColors } from '@/theme/use-theme';

const formatSize = (b: number) => (b > 1_000_000 ? `${formatNumber(b / 1_000_000, 1)} MB` : `${formatNumber(b / 1000)} KB`);

export default function BackupScreen() {
  const c = useColors();
  const [last, setLast] = useState<number | null>(null);
  const [busy, setBusy] = useState<'export' | 'import' | 'restore' | null>(null);
  const [loaded, setLoaded] = useState<LoadedBackup | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void readSetting('lastBackupAt').then((v) => setLast(typeof v === 'number' ? v : null));
    }, []),
  );

  async function doExport() {
    setBusy('export');
    setResult(null);
    try {
      const r = await exportBackup();
      setLast(Date.now());
      setResult(
        `${r.fileName} · ${formatSize(r.bytes)} · ${formatNumber(r.counts.rows)} Einträge · ${r.counts.media} Fotos/Videos` +
          (r.counts.missingMedia ? ` · ${r.counts.missingMedia} Dateien fehlten` : ''),
      );
    } catch (e) {
      notify('Backup fehlgeschlagen', e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setBusy(null);
    }
  }

  async function doPick() {
    setBusy('import');
    try {
      setLoaded(await pickBackup());
    } catch (e) {
      notify('Datei konnte nicht gelesen werden', e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setBusy(null);
    }
  }

  function doRestore() {
    if (!loaded?.check.ok) return;
    const data = loaded.check.data;
    confirmAction(
      'Alle Daten ersetzen?',
      'Alle aktuellen Workouts, Routinen, Maße, Fotos, Ziele und Gewohnheiten werden durch die Sicherung ersetzt. Das kann nicht rückgängig gemacht werden – erstelle vorher ggf. ein Backup.',
      'Ersetzen',
      async () => {
        setBusy('restore');
        try {
          await restoreBackup(data, loaded.files);
          notify('Wiederhergestellt', 'Satzwerk startet jetzt neu.');
          await reloadApp();
        } catch (e) {
          notify('Wiederherstellung fehlgeschlagen', `${e instanceof Error ? e.message : 'Unbekannter Fehler'} – deine bisherigen Daten sind unverändert.`);
        } finally {
          setBusy(null);
        }
      },
    );
  }

  const exported = loaded?.check.ok ? new Date(loaded.check.data.exportedAt) : null;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 48 }}>
      <Card>
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
          <Icon name={last ? 'cloud-check-outline' : 'cloud-alert-outline'} size={32} color={last ? c.success : c.danger} />
          <View style={{ flex: 1 }}>
            <AppText style={{ fontWeight: '700' }}>{last ? 'Letztes Backup' : 'Noch kein Backup'}</AppText>
            <AppText muted>
              {last
                ? new Date(last).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                : 'Deine Daten liegen nur auf diesem Gerät.'}
            </AppText>
          </View>
        </View>
      </Card>

      <SectionHeader>Sichern</SectionHeader>
      <AppText muted>
        Erstellt eine ZIP-Datei mit allen Daten und Fotos. Speichere sie z. B. in Google Drive oder schick sie dir selbst – Satzwerk lädt nichts automatisch hoch.
      </AppText>
      <Button title={busy === 'export' ? 'Erstelle Backup …' : 'Backup erstellen'} icon="archive-arrow-down-outline" disabled={!!busy} onPress={() => void doExport()} />
      {result && (
        <AppText variant="caption" style={{ color: c.success }}>
          ✓ {result}
        </AppText>
      )}

      <SectionHeader>Wiederherstellen</SectionHeader>
      <Button title={busy === 'import' ? 'Lese Datei …' : 'Backup-Datei wählen'} icon="archive-arrow-up-outline" variant="secondary" disabled={!!busy} onPress={() => void doPick()} />
      {loaded && !loaded.check.ok && <AppText style={{ color: c.danger }}>{loaded.check.error}</AppText>}
      {loaded?.check.ok && exported && (
        <Card>
          <AppText style={{ fontWeight: '700' }}>{loaded.fileName}</AppText>
          <AppText variant="caption" muted>
            Erstellt am {exported.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}
          </AppText>
          <AppText>
            {loaded.check.counts.workouts} Workouts · {loaded.check.counts.routines} Routinen · {loaded.check.counts.measurements} Messwerte ·{' '}
            {loaded.check.counts.photos} Fotos · {loaded.check.counts.habits} Gewohnheiten · {loaded.check.counts.goals} Ziele
          </AppText>
          <Button title={busy === 'restore' ? 'Stelle wieder her …' : 'Alle Daten durch diese Sicherung ersetzen'} icon="restore" variant="danger" disabled={!!busy} onPress={doRestore} />
        </Card>
      )}
    </ScrollView>
  );
}
