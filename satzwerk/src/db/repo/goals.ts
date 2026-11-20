import { asc, eq } from 'drizzle-orm';

import type { GoalType } from '@/domain/goals';
import { newId } from '@/lib/id';

import { db } from '../client';
import { goals } from '../schema';

export const allGoalsQuery = () => db.select().from(goals).where(eq(goals.archived, false)).orderBy(asc(goals.createdAt));

export type GoalInput = {
  type: GoalType;
  title: string;
  refId: string | null;
  metric: string | null;
  targetReps: number | null;
  startValue: number;
  targetValue: number;
  deadline: string | null;
};

export function validateGoal(g: GoalInput): string | null {
  if (!g.title.trim()) return 'Bitte einen Titel eingeben.';
  if ((g.type === 'strength' || g.type === 'measurement' || g.type === 'habit') && !g.refId) {
    return g.type === 'strength' ? 'Bitte eine Übung wählen.' : g.type === 'habit' ? 'Bitte eine Gewohnheit wählen.' : 'Bitte ein Maß wählen.';
  }
  if (!Number.isFinite(g.targetValue) || g.targetValue <= 0) return 'Bitte einen Zielwert größer 0 eingeben.';
  if (!Number.isFinite(g.startValue) || g.startValue < 0) return 'Ungültiger Startwert.';
  if (g.startValue === g.targetValue) return 'Start- und Zielwert sind gleich – das Ziel wäre schon erreicht.';
  return null;
}

export async function createGoal(input: GoalInput): Promise<string> {
  const id = newId('gl_');
  const now = new Date();
  await db.insert(goals).values({ id, ...input, title: input.title.trim(), createdAt: now, updatedAt: now });
  return id;
}

export async function updateGoal(id: string, input: GoalInput): Promise<void> {
  await db.update(goals).set({ ...input, title: input.title.trim(), achievedAt: null, updatedAt: new Date() }).where(eq(goals.id, id));
}

export async function markGoalAchieved(id: string, at: Date): Promise<void> {
  await db.update(goals).set({ achievedAt: at, updatedAt: new Date() }).where(eq(goals.id, id));
}

export async function deleteGoal(id: string): Promise<void> {
  await db.delete(goals).where(eq(goals.id, id));
}
