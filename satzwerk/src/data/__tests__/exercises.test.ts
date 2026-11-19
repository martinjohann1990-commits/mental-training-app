import { BUILTIN_EXERCISES } from '@/data/exercises';
import { EQUIPMENT_KEYS, LOGGING_TYPE_KEYS, MUSCLE_KEYS } from '@/domain/catalog';

describe('mitgelieferte Übungsbibliothek', () => {
  it('enthält mindestens 150 Standard- und 60 Kettlebell-Übungen', () => {
    const kb = BUILTIN_EXERCISES.filter((e) => e.id.startsWith('kb_'));
    expect(BUILTIN_EXERCISES.length - kb.length).toBeGreaterThanOrEqual(150);
    expect(kb.length).toBeGreaterThanOrEqual(60);
  });

  it('hat eindeutige IDs und Namen', () => {
    const ids = BUILTIN_EXERCISES.map((e) => e.id);
    const names = BUILTIN_EXERCISES.map((e) => e.name.toLowerCase());
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(BUILTIN_EXERCISES.map((e) => [e.id, e] as const))('%s ist gültig', (_id, e) => {
    expect(e.id).toMatch(/^[a-z0-9_]+$/);
    expect(e.name.trim()).not.toBe('');
    expect(e.instructions.trim()).not.toBe('');
    expect(MUSCLE_KEYS).toContain(e.primaryMuscle);
    e.secondaryMuscles.forEach((m) => expect(MUSCLE_KEYS).toContain(m));
    expect(e.secondaryMuscles).not.toContain(e.primaryMuscle);
    expect(LOGGING_TYPE_KEYS).toContain(e.loggingType);
    e.equipment.forEach((q) => expect(EQUIPMENT_KEYS).toContain(q));
    // Körpergewicht wird über eine leere Equipment-Liste ausgedrückt.
    expect(e.equipment).not.toContain('bodyweight');
  });

  it('alle Kettlebell-Übungen benötigen Kettlebells', () => {
    BUILTIN_EXERCISES.filter((e) => e.id.startsWith('kb_')).forEach((e) =>
      expect(e.equipment).toContain('kettlebell'),
    );
  });

  it('Komplexe verweisen nur auf existierende Übungen', () => {
    const ids = new Set(BUILTIN_EXERCISES.map((e) => e.id));
    const complexes = BUILTIN_EXERCISES.filter((e) => e.complexParts);
    expect(complexes.length).toBeGreaterThan(0);
    complexes.forEach((c) => {
      expect(c.complexParts!.length).toBeGreaterThanOrEqual(2);
      c.complexParts!.forEach((p) => expect(ids).toContain(p));
    });
  });
});
