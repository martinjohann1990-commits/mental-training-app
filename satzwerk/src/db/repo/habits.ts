import { and, asc, eq } from 'drizzle-orm';

import type { HabitFrequency, HabitKind } from '@/domain/habits';
import { newId } from '@/lib/id';
import { cancelReminder, scheduleDailyReminder } from '@/lib/rest-alerts';

import { db } from '../client';
import { habitLogs, habits } from '../schema';

export const allHabitsQuery = () => db.select().from(habits).where(eq(habits.archived, false)).orderBy(asc(habits.sort), asc(habits.createdAt));
export const allHabitLogsQuery = () => db.select().from(habitLogs);

export type HabitInput = {
  name: string;
  kind: HabitKind;
  dailyTarget: number | null;
  unit: string;
  frequency: HabitFrequency;
  timesPerWeek: number | null;
  reminderTime: string | null;
};

export function validateHabit(h: HabitInput): string | null {
  if (!h.name.trim()) return 'Bitte einen Namen eingeben.';
  if (h.kind === 'number' && (!h.dailyTarget || h.dailyTarget <= 0)) return 'Bitte ein Tagesziel größer 0 angeben.';
  if (h.frequency === 'weekly' && (!h.timesPerWeek || h.timesPerWeek < 1 || h.timesPerWeek > 14)) return 'Bitte 1–14 Mal pro Woche angeben.';
  if (h.reminderTime && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(h.reminderTime)) return 'Uhrzeit bitte als HH:MM, z. B. 20:30.';
  return null;
}

function normalize(h: HabitInput) {
  return {
    name: h.name.trim(),
    kind: h.kind,
    dailyTarget: h.kind === 'number' ? h.dailyTarget : null,
    unit: h.kind === 'number' ? h.unit.trim() : '',
    // Trainingsfrequenz ist immer wöchentlich.
    frequency: h.kind === 'workouts' ? ('weekly' as const) : h.frequency,
    timesPerWeek: h.kind === 'workouts' || h.frequency === 'weekly' ? h.timesPerWeek : null,
    reminderTime: h.reminderTime || null,
  };
}

async function reschedule(id: string, name: string, time: string | null, oldNotificationId: string | null) {
  await cancelReminder(oldNotificationId);
  const nid = time ? await scheduleDailyReminder(name, 'Erinnerung an deine Gewohnheit 💪', time) : null;
  await db.update(habits).set({ reminderNotificationId: nid }).where(eq(habits.id, id));
}

export async function createHabit(input: HabitInput): Promise<string> {
  const id = newId('hb_');
  const now = new Date();
  const v = normalize(input);
  await db.insert(habits).values({ id, ...v, sort: now.getTime(), createdAt: now, updatedAt: now });
  await reschedule(id, v.name, v.reminderTime, null);
  return id;
}

export async function updateHabit(id: string, input: HabitInput): Promise<void> {
  const [old] = await db.select().from(habits).where(eq(habits.id, id));
  const v = normalize(input);
  await db.update(habits).set({ ...v, updatedAt: new Date() }).where(eq(habits.id, id));
  await reschedule(id, v.name, v.reminderTime, old?.reminderNotificationId ?? null);
}

export async function deleteHabit(id: string): Promise<void> {
  const [old] = await db.select().from(habits).where(eq(habits.id, id));
  await cancelReminder(old?.reminderNotificationId);
  await db.delete(habits).where(eq(habits.id, id));
}

/** Setzt den Tageswert (0 bzw. null löscht den Eintrag). */
export async function setHabitValue(habitId: string, day: string, value: number | null): Promise<void> {
  if (value === null || value <= 0) {
    await db.delete(habitLogs).where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.day, day)));
    return;
  }
  const now = new Date();
  await db
    .insert(habitLogs)
    .values({ id: newId('hl_'), habitId, day, value, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: [habitLogs.habitId, habitLogs.day], set: { value, updatedAt: now } });
}
