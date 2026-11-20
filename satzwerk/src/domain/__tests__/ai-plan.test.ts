import { defaultEquipmentConfig } from '@/domain/equipment';
import {
  buildPlanPrompt, DEFAULT_AI_PROFILE, describeEquipment, routinesToPlanJson, extractJson, matchExercise, nameSimilarity, parsePlanResponse, parseReps,
  snapWeight, summarizeForRevision, toRoutineExercise,
} from '@/domain/ai-plan';

const library = [
  { id: 'bb_bench_press', name: 'Bankdrücken (Langhantel)' },
  { id: 'db_bench_press', name: 'Bankdrücken (Kurzhanteln)' },
  { id: 'kb_swing', name: 'KB Swing (beidarmig)' },
  { id: 'kb_one_arm_swing', name: 'KB Swing einarmig' },
  { id: 'kb_goblet_squat', name: 'KB Goblet Squat' },
  { id: 'plank', name: 'Unterarmstütz (Plank)' },
];

const answer = `Hier ist dein Plan:
\`\`\`json
{
  "plan_name": "KB Kraft 3×",
  "summary": "Ganzkörper",
  "routines": [
    { "name": "Tag A", "exercises": [
      { "name": "Bankdrücken (Langhantel)", "sets": 3, "warmup_sets": 1, "reps": "6-8", "weight_kg": 71, "rest_sec": 120, "superset_group": null, "interval": null, "notes": "RPE 8", "new_exercise": null },
      { "name": "Kettlebell Swing beidarmig", "sets": "4", "reps": 15, "weight_kg": 22, "rest_sec": 60, "superset_group": 1 },
      { "name": "Plank", "sets": 3, "reps": null, "duration_sec": 45, "rest_sec": 45 },
      { "name": "Sandbag Shouldering", "sets": 3, "reps": "5", "new_exercise": { "primary_muscle": "full_body", "equipment": ["laser"], "logging_type": "reps_per_side" } },
      { "sets": 3 },
    ]},
    { "name": "Tag B", "exercises": [ { "name": "KB Swing einarmig", "sets": 5, "reps": "10", "interval": { "mode": "emom", "minutes": 10, "reps_per_minute": 10 } } ] }
  ]
}
\`\`\`
Viel Erfolg!`;

describe('KI-Antwort parsen', () => {
  it('findet JSON in Markdown und repariert Komma-Fehler', () => {
    expect(extractJson('bla {"a":1} blub')).toBe('{"a":1}');
    const r = parsePlanResponse(answer);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.name).toBe('KB Kraft 3×');
    expect(r.plan.routines).toHaveLength(2);
    const [bench, swing, plank, sandbag] = r.plan.routines[0].exercises;
    expect(bench).toMatchObject({ sets: 3, warmupSets: 1, repsMin: 6, repsMax: 8, weightKg: 71, restSec: 120, notes: 'RPE 8' });
    expect(swing).toMatchObject({ sets: 4, repsMin: 15, supersetGroup: 1 });
    expect(plank).toMatchObject({ durationSec: 45, repsMin: null });
    expect(sandbag.newExercise).toEqual({ primaryMuscle: 'full_body', equipment: [], loggingType: 'reps_per_side' });
    expect(r.warnings.some((w) => w.includes('ohne Namen'))).toBe(true);
    expect(r.plan.routines[1].exercises[0].interval).toEqual({ mode: 'emom', minutes: 10, repsPerMinute: 10 });
  });
  it('klare Fehlermeldungen', () => {
    expect(parsePlanResponse('keine Ahnung')).toMatchObject({ ok: false });
    expect(parsePlanResponse('{"plan_name": "x"}')).toMatchObject({ ok: false, error: expect.stringContaining('routines') });
    expect(parsePlanResponse('{"routines": [ {')).toMatchObject({ ok: false });
  });
  it('parseReps', () => {
    expect(parseReps('8–12')).toEqual({ min: 8, max: 12, text: '8–12' });
    expect(parseReps(10)).toEqual({ min: 10, max: 10, text: null });
    expect(parseReps('AMRAP')).toEqual({ min: null, max: null, text: 'AMRAP' });
  });
});

describe('Übungen zuordnen', () => {
  it('exakt, Synonyme und Mehrdeutigkeit', () => {
    expect(matchExercise('Bankdrücken (Langhantel)', library).id).toBe('bb_bench_press');
    expect(matchExercise('Kettlebell Swing beidarmig', library).id).toBe('kb_swing');
    expect(matchExercise('Kettlebell Goblet Squat', library).id).toBe('kb_goblet_squat');
    const amb = matchExercise('Bankdrücken', library);
    expect(amb.id).toBeNull();
    expect(amb.suggestions.map((s) => s.id)).toContain('bb_bench_press');
    expect(matchExercise('Sandbag Shouldering', library)).toEqual({ id: null, suggestions: [] });
    expect(nameSimilarity('Plank', 'Unterarmstütz (Plank)')).toBeGreaterThan(0.5);
  });
});

describe('Umwandlung', () => {
  it('rastet Gewichte ein', () => {
    expect(snapWeight(22, [16, 20, 24])).toBe(20);
    expect(snapWeight(23, [16, 20, 24])).toBe(24);
    expect(snapWeight(71.1, null)).toBe(71);
    expect(snapWeight(null, [16])).toBeNull();
  });
  it('Aufwärm- + Arbeitssätze, Bereich in Notiz', () => {
    const r = parsePlanResponse(answer);
    if (!r.ok) throw new Error();
    const bench = toRoutineExercise(r.plan.routines[0].exercises[0], 'bb_bench_press', 'weight_reps', null);
    expect(bench.sets.map((s) => s.type)).toEqual(['warmup', 'normal', 'normal', 'normal']);
    expect(bench.sets[1]).toMatchObject({ weight: 71, reps: 6 });
    expect(bench.sets[0].weight).toBe(35.5);
    expect(bench.note).toBe('6-8 Wdh. · RPE 8');
    const swing = toRoutineExercise(r.plan.routines[0].exercises[1], 'kb_swing', 'weight_reps', [16, 20, 24]);
    expect(swing.sets[0].weight).toBe(20);
    expect(swing.supersetGroup).toBe(1);
    const plank = toRoutineExercise(r.plan.routines[0].exercises[2], 'plank', 'duration', null);
    expect(plank.sets[0]).toMatchObject({ duration: 45, reps: null });
  });
});

describe('Prompts & Verlauf', () => {
  it('Prompt enthält Profil, Equipment, Schema und Übungsliste', () => {
    const p = buildPlanPrompt({ ...DEFAULT_AI_PROFILE, injuries: 'Knie links' }, '- Kettlebells: 16, 24 kg', ['KB Swing (beidarmig)']);
    expect(p).toContain('Knie links');
    expect(p).toContain('16, 24 kg');
    expect(p).toContain('"routines"');
    expect(p).toContain('KB Swing (beidarmig)');
  });
  it('Verlaufszusammenfassung erkennt Trend', () => {
    const DAY = 86_400_000;
    const now = new Date(2026, 10, 20).getTime();
    const s = (w: string, d: number, weight: number, reps: number, rpe: number | null = null) => ({
      workoutId: w, startedAt: now - d * DAY, endedAt: now - d * DAY, exerciseId: 'bb_bench_press', type: 'normal' as const,
      weight, reps, repsRight: null, duration: null, distance: null, rpe,
    });
    const text = summarizeForRevision({
      history: [s('a', 20, 80, 5, 8), s('b', 10, 82.5, 5, 8.5), s('c', 2, 85, 5, 9)],
      workouts: [{ startedAt: now - 20 * DAY, rating: 4, energy: 3 }, { startedAt: now - 2 * DAY, rating: 5, energy: 4 }],
      exerciseName: () => 'Bankdrücken (Langhantel)',
      bodyweight: [{ day: '2026-11-01', value: 84 }, { day: '2026-11-19', value: 83 }],
      goals: [{ title: 'Bank 100 × 5', progress: 0.25 }],
      plannedDaysPerWeek: 3,
      now,
      weeks: 4,
    });
    expect(text).toContain('2 Workouts');
    expect(text).toContain('80 kg × 5 → 85 kg × 5');
    expect(text).toContain('(steigend)');
    expect(text).toContain('RPE 8,5');
    expect(text).toContain('84 kg → 83 kg');
    expect(text).toContain('Bank 100 × 5 (25 %)');
  });
});


describe('Equipment & Plan-JSON', () => {
  it('beschreibt Equipment inkl. eigener Geräte', () => {
    const cfg = { ...defaultEquipmentConfig('home'), available: [...defaultEquipmentConfig('home').available, 'custom:x' as const] };
    const t = describeEquipment(cfg, (r) => ({ bench: 'Bank', pullup_bar: 'Klimmzugstange', band: 'Widerstandsbänder' } as Record<string, string>)[r] ?? r, [
      { ref: 'custom:x', name: 'Sandsack', weights: [10, 20] },
    ]);
    expect(t).toContain('Kettlebells: 12, 16, 24 kg');
    expect(t).toContain('Kurzhanteln: 2–32 kg in 1,5-kg-Schritten');
    expect(t).toContain('Bank, Klimmzugstange, Widerstandsbänder');
    expect(t).toContain('Sandsack (10, 20 kg)');
    expect(t).not.toContain('Langhantel');
  });
  it('Routinen → JSON im KI-Schema', () => {
    const json = JSON.parse(routinesToPlanJson('P', [{ name: 'A', notes: '', exercises: [{
      exerciseId: 'kb_swing', supersetGroup: null, restSeconds: 60, note: '', interval: null,
      sets: [{ type: 'warmup', weight: 12, reps: 10, repsRight: null, duration: null, distance: null }, { type: 'normal', weight: 24, reps: 15, repsRight: null, duration: null, distance: null }],
    }] }], () => 'KB Swing (beidarmig)'));
    expect(json.routines[0].exercises[0]).toMatchObject({ name: 'KB Swing (beidarmig)', sets: 1, warmup_sets: 1, reps: 15, weight_kg: 24, rest_sec: 60 });
  });
});
