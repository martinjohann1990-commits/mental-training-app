import {
  BACKUP_TABLES, backupFileName, buildBackup, mediaRefs, prepareRow, safeColumns, shouldRemindBackup, validateBackup,
} from '@/domain/backup';

const DAY = 86_400_000;
const now = new Date(2026, 10, 20, 12).getTime();

describe('Backup-Format', () => {
  const tables = {
    workouts: [{ id: 'w1', started_at: now }],
    progress_photos: [{ id: 'p1', uri: 'pp_abc.jpg' }, { id: 'p2', uri: 'data:image/png;base64,xx' }],
    exercises: [{ id: 'e1', media_uri: 'ex_1.mp4' }, { id: 'e2', media_uri: null }],
    habits: [{ id: 'h1', reminder_notification_id: 'n-123', reminder_time: '20:00' }],
  };

  it('Round-Trip über JSON besteht die Prüfung', () => {
    const data = buildBackup(tables, 5, now);
    const check = validateBackup(JSON.parse(JSON.stringify(data)), 5);
    expect(check.ok).toBe(true);
    if (check.ok) expect(check.counts).toMatchObject({ workouts: 1, photos: 2, habits: 1, routines: 0 });
  });

  it('lehnt fremde, neuere oder beschädigte Dateien ab', () => {
    expect(validateBackup(null, 5)).toMatchObject({ ok: false });
    expect(validateBackup({ format: 'other' }, 5)).toMatchObject({ ok: false, error: expect.stringContaining('keine Satzwerk') });
    expect(validateBackup(buildBackup(tables, 6, now), 5)).toMatchObject({ ok: false, error: expect.stringContaining('neueren') });
    expect(validateBackup({ ...buildBackup({}, 5, now), tables: { hackers: [] } }, 5)).toMatchObject({ ok: false });
    expect(validateBackup({ ...buildBackup({}, 5, now), tables: { workouts: [1, 2] } }, 5)).toMatchObject({ ok: false });
  });

  it('ältere Sicherungen werden akzeptiert', () => {
    expect(validateBackup(buildBackup(tables, 3, now), 5).ok).toBe(true);
  });

  it('sammelt nur Dateinamen als Medien', () => {
    expect(mediaRefs(tables).sort()).toEqual(['ex_1.mp4', 'pp_abc.jpg']);
  });

  it('entfernt gerätespezifische Werte und unsichere Spalten', () => {
    expect(prepareRow('habits', tables.habits[0])).toEqual({ id: 'h1', reminder_notification_id: null, reminder_time: '20:00' });
    expect(safeColumns({ id: 1, 'x; DROP TABLE': 2, created_at: 3 })).toEqual(['id', 'created_at']);
  });

  it('Eltern-Tabellen kommen vor Kind-Tabellen', () => {
    const i = (t: string) => BACKUP_TABLES.indexOf(t as never);
    expect(i('workouts')).toBeLessThan(i('workout_exercises'));
    expect(i('workout_exercises')).toBeLessThan(i('workout_sets'));
    expect(i('routine_folders')).toBeLessThan(i('routines'));
    expect(i('habits')).toBeLessThan(i('habit_logs'));
    expect(i('exercises')).toBeLessThan(i('workout_exercises'));
  });

  it('Dateiname mit Datum', () => {
    expect(backupFileName(now)).toBe('satzwerk-backup-2026-11-20.zip');
  });
});

describe('Backup-Erinnerung', () => {
  const base = { now, lastBackupAt: null, firstDataAt: now - 30 * DAY, snoozedUntil: null };
  it('nie gesichert → erinnern', () => expect(shouldRemindBackup(base).remind).toBe(true));
  it('vor 13 Tagen gesichert → nicht', () => expect(shouldRemindBackup({ ...base, lastBackupAt: now - 13 * DAY })).toEqual({ remind: false, daysSince: 13 }));
  it('vor 14 Tagen → erinnern', () => expect(shouldRemindBackup({ ...base, lastBackupAt: now - 14 * DAY }).remind).toBe(true));
  it('neue Nutzer (< 3 Tage Daten) oder keine Daten → nicht', () => {
    expect(shouldRemindBackup({ ...base, firstDataAt: now - DAY }).remind).toBe(false);
    expect(shouldRemindBackup({ ...base, firstDataAt: null }).remind).toBe(false);
  });
  it('weggeklickt → bis Ablauf nicht', () => expect(shouldRemindBackup({ ...base, snoozedUntil: now + DAY }).remind).toBe(false));
});
