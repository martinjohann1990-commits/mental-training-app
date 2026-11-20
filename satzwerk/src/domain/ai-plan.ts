/**
 * KI-Trainingsplan: Prompts erzeugen, Antwort parsen, Übungen zuordnen, in Routinen umwandeln.
 * Rein und testbar – keine Abhängigkeit zu DB oder UI.
 */
import { EQUIPMENT_KEYS, type EquipmentRef, LOGGING_TYPE_KEYS, type LoggingType, MUSCLE_KEYS, type Muscle } from './catalog';
import type { EquipmentConfig } from './equipment';
import { normalizeSearch } from './exercise-filter';
import type { RoutineExerciseData } from './routine';
import { estimate1RM, type HistorySet } from './stats';
import type { IntervalConfig, SetType } from './workout';

// ── Profil & Prompts ──────────────────────────────────────────

export const AI_GOALS = {
  strength: 'Maximalkraft',
  hypertrophy: 'Muskelaufbau',
  fatloss: 'Fettabbau / Körperkomposition',
  conditioning: 'Kondition / Kraftausdauer',
  general: 'Allgemeine Fitness & Gesundheit',
} as const;
export type AIGoal = keyof typeof AI_GOALS;

export const AI_LEVELS = {
  beginner: 'Anfänger (< 1 Jahr)',
  intermediate: 'Fortgeschritten (1–3 Jahre)',
  advanced: 'Erfahren (> 3 Jahre)',
} as const;
export type AILevel = keyof typeof AI_LEVELS;

export type AIProfile = {
  goal: AIGoal;
  level: AILevel;
  daysPerWeek: number;
  minutesPerSession: number;
  injuries: string;
  wishes: string;
};

export const DEFAULT_AI_PROFILE: AIProfile = {
  goal: 'hypertrophy',
  level: 'intermediate',
  daysPerWeek: 3,
  minutesPerSession: 60,
  injuries: '',
  wishes: '',
};

const SCHEMA_EXAMPLE = `{
  "plan_name": "Kurzer Name des Plans",
  "summary": "2–4 Sätze: Aufbau, Progression, worauf achten",
  "changes": "Nur bei Überarbeitung: was wurde warum geändert",
  "routines": [
    {
      "name": "Tag A – Oberkörper",
      "notes": "optional",
      "exercises": [
        {
          "name": "<exakter Name aus der Übungsliste>",
          "sets": 3,
          "warmup_sets": 1,
          "reps": "6-8",
          "weight_kg": 70,
          "duration_sec": null,
          "distance_m": null,
          "rest_sec": 120,
          "superset_group": null,
          "interval": null,
          "notes": "RPE 8, letzte Wdh. sauber",
          "new_exercise": null
        }
      ]
    }
  ]
}`;

const RULES = `Regeln für die Antwort:
- Antworte NUR mit einem einzigen JSON-Objekt exakt in diesem Format (keine Erklärungen davor oder danach, kein Markdown):
${SCHEMA_EXAMPLE}
- "name": Verwende wenn möglich EXAKT einen Namen aus der Übungsliste unten.
- Nur wenn eine Übung dort fehlt: eigener Name und "new_exercise": {"primary_muscle": "<key>", "equipment": ["<key>"], "logging_type": "<key>"}.
  primary_muscle ∈ ${MUSCLE_KEYS.join(', ')}
  equipment ∈ ${EQUIPMENT_KEYS.filter((e) => e !== 'bodyweight').join(', ')} (leer = Körpergewicht)
  logging_type ∈ ${LOGGING_TYPE_KEYS.join(', ')}
- "reps": Zahl oder Bereich als Text ("8-12"); bei Zeitübungen null und stattdessen "duration_sec".
- "weight_kg": Startgewicht in kg oder null (bei Kettlebells/Kurzhanteln nur vorhandene Gewichte nutzen).
- "superset_group": gleiche Zahl = Supersatz/Zirkel (z. B. 1), sonst null.
- "interval": null oder {"mode":"emom","minutes":10,"reps_per_minute":8} | {"mode":"amrap","minutes":12} | {"mode":"tabata","work_sec":20,"rest_sec":10,"rounds":8}.
- Genau so viele Einträge in "routines" wie Trainingstage pro Woche.`;

const FORMAT_REMINDER = `

ERINNERUNG: Antworte jetzt NUR mit dem JSON-Objekt (beginnt mit { und endet mit }). Keine Erklärungen davor oder danach – Erklärungen gehören in \"summary\" bzw. \"changes\".`;

export function describeProfile(p: AIProfile): string {
  return [
    `- Ziel: ${AI_GOALS[p.goal]}`,
    `- Erfahrung: ${AI_LEVELS[p.level]}`,
    `- Trainingstage pro Woche: ${p.daysPerWeek}`,
    `- Dauer pro Einheit: ca. ${p.minutesPerSession} Minuten`,
    `- Verletzungen/Einschränkungen: ${p.injuries.trim() || 'keine'}`,
    `- Wünsche/Vorlieben: ${p.wishes.trim() || 'keine'}`,
  ].join('\n');
}

export function buildPlanPrompt(p: AIProfile, equipmentText: string, exerciseNames: string[]): string {
  return `WICHTIG: Deine Antwort besteht ausschließlich aus einem einzigen JSON-Objekt im unten beschriebenen Format – kein Fließtext, keine Überschriften, kein Markdown.

Du bist ein erfahrener Kraft- und Athletiktrainer. Erstelle mir einen Trainingsplan als wiederkehrende Wochenstruktur.

Über mich:
${describeProfile(p)}

Verfügbares Equipment:
${equipmentText}

${RULES}

Übungsliste (bevorzugt diese Namen verwenden):
${exerciseNames.join('\n')}${FORMAT_REMINDER}`;
}

export function buildRevisePrompt(p: AIProfile, equipmentText: string, currentPlanJson: string, historySummary: string, exerciseNames: string[]): string {
  return `WICHTIG: Deine Antwort besteht ausschließlich aus einem einzigen JSON-Objekt im unten beschriebenen Format – kein Fließtext, keine Überschriften, kein Markdown.

Du bist ein erfahrener Kraft- und Athletiktrainer. Überarbeite meinen bestehenden Trainingsplan anhand meines Trainingsverlaufs.
Passe Gewichte, Wiederholungen und Volumen an (Progression), erkenne Stagnation und schlage bei Bedarf einen Deload oder Übungswechsel vor.
Behalte bewährte Übungen bei, wenn sie sich gut entwickeln. Erkläre die Änderungen im Feld "changes".

Über mich:
${describeProfile(p)}

Verfügbares Equipment:
${equipmentText}

Aktueller Plan (JSON):
${currentPlanJson}

Mein Verlauf:
${historySummary}

${RULES}

Übungsliste (bevorzugt diese Namen verwenden):
${exerciseNames.join('\n')}${FORMAT_REMINDER}`;
}

/**
 * Kurzer Nachfass-Prompt für denselben Chat, wenn die KI Text statt JSON geliefert hat.
 * Die Übungsliste wird mitgeschickt, damit die Namen zur Bibliothek passen.
 */
export function buildFormatFixPrompt(exerciseNames: string[]): string {
  return `Danke! Bitte gib genau diesen Plan jetzt noch einmal aus – unverändert im Inhalt, aber ausschließlich als ein einziges JSON-Objekt. Kein Text davor oder danach, kein Markdown.
Allgemeine Tipps (z. B. Ernährung, Alltagsbewegung) gehören in "summary". Ausdauereinheiten (Laufen, Rad, Rudern) als eigene Routine mit "duration_sec" bzw. "distance_m".

${RULES}

Übungsliste (bevorzugt diese Namen verwenden):
${exerciseNames.join('\n')}${FORMAT_REMINDER}`;
}

// ── Antwort parsen ────────────────────────────────────────────

export type ParsedExercise = {
  name: string;
  sets: number;
  warmupSets: number;
  repsMin: number | null;
  repsMax: number | null;
  repsText: string | null;
  weightKg: number | null;
  durationSec: number | null;
  distanceM: number | null;
  restSec: number;
  supersetGroup: number | null;
  interval: IntervalConfig | null;
  notes: string;
  newExercise: { primaryMuscle: Muscle; equipment: EquipmentRef[]; loggingType: LoggingType } | null;
};

export type ParsedRoutine = { name: string; notes: string; exercises: ParsedExercise[] };
export type ParsedPlan = { name: string; summary: string; changes: string; routines: ParsedRoutine[] };

export type ParseErrorCode = 'no_json' | 'prose' | 'invalid_json' | 'no_routines';
export type ParseResult = { ok: true; plan: ParsedPlan; warnings: string[] } | { ok: false; error: string; code: ParseErrorCode };

/** Sieht der Text wie ein ausformulierter Plan aus (statt JSON)? */
export function looksLikeProsePlan(text: string): boolean {
  const t = text.toLowerCase();
  const hits = ['tag ', 'sätze', 'wiederholung', 'wdh', 'satz', 'übung', 'minuten', 'pause', 'training'].filter((w) => t.includes(w)).length;
  return text.trim().length > 200 && hits >= 3;
}

/** Sucht das JSON-Objekt in beliebigem Text (Markdown-Codeblöcke, Text davor/danach). */
export function extractJson(text: string): string | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const src = fenced ? fenced[1] : text;
  const start = src.indexOf('{');
  const end = src.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  return src.slice(start, end + 1);
}

const num = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(',', '.').replace(/[^\d.\-]/g, ''));
    return v.trim() && Number.isFinite(n) ? n : null;
  }
  return null;
};
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** "8-12", "8–12", "10", 10, "AMRAP" → min/max. */
export function parseReps(v: unknown): { min: number | null; max: number | null; text: string | null } {
  if (typeof v === 'number' && v > 0) return { min: Math.round(v), max: Math.round(v), text: null };
  if (typeof v !== 'string' || !v.trim()) return { min: null, max: null, text: null };
  const m = /(\d+)\s*(?:-|–|bis)\s*(\d+)/.exec(v);
  if (m) return { min: Number(m[1]), max: Number(m[2]), text: v.trim() };
  const single = /^\s*(\d+)\s*$/.exec(v);
  if (single) return { min: Number(single[1]), max: Number(single[1]), text: null };
  return { min: null, max: null, text: v.trim() };
}

function parseInterval(v: unknown): IntervalConfig | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const mode = str(o.mode).toLowerCase();
  const pos = (x: unknown, d: number) => {
    const n = num(x);
    return n && n > 0 ? Math.round(n) : d;
  };
  if (mode === 'emom') return { mode: 'emom', minutes: pos(o.minutes, 10), repsPerMinute: num(o.reps_per_minute) ? pos(o.reps_per_minute, 0) : null };
  if (mode === 'amrap') return { mode: 'amrap', minutes: pos(o.minutes, 10) };
  if (mode === 'tabata' || mode === 'interval') {
    return { mode: 'tabata', workSeconds: pos(o.work_sec, 20), restSeconds: Math.max(0, Math.round(num(o.rest_sec) ?? 10)), rounds: pos(o.rounds, 8) };
  }
  return null;
}

function parseNewExercise(v: unknown): ParsedExercise['newExercise'] {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const pm = str(o.primary_muscle) as Muscle;
  const lt = str(o.logging_type) as LoggingType;
  const eq = Array.isArray(o.equipment) ? o.equipment.map(str).filter((e): e is EquipmentRef => EQUIPMENT_KEYS.includes(e as never) && e !== 'bodyweight') : [];
  return {
    primaryMuscle: MUSCLE_KEYS.includes(pm) ? pm : 'full_body',
    equipment: eq,
    loggingType: LOGGING_TYPE_KEYS.includes(lt) ? lt : 'weight_reps',
  };
}

// ── Fremde JSON-Formate tolerant übersetzen ───────────────────

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

/** Entfernt Quellen-Artefakte mancher KIs (z. B. „[span_0](start_span)“, „[cite: 3]“). */
export function stripCitationArtifacts(text: string): string {
  return text.replace(/\[span_\d+\]\((?:start|end)_span\)/g, '').replace(/\[cite(?::[^\]]*)?\]/gi, '');
}

const NAME_KEYS = ['name', 'exercise', 'übung', 'uebung', 'title', 'bezeichnung'];
const LIST_KEYS = /exerc|übung|uebung|workout|circuit|zirkel|block|items|movements|bewegung/i;

function pick(o: Obj, keys: string[]): unknown {
  for (const k of Object.keys(o)) if (keys.includes(k.toLowerCase())) return o[k];
  return undefined;
}
function pickRe(o: Obj, re: RegExp): unknown {
  for (const k of Object.keys(o)) if (re.test(k)) return o[k];
  return undefined;
}
const isExerciseObj = (v: unknown) => isObj(v) && typeof pick(v, NAME_KEYS) === 'string';

/** „3x10“, „12 Wdh.“, „30 Meter“, „45 Sek“, „25 Minuten“, „8-10“ → Felder im Satzwerk-Schema. */
export function parseAmount(text: string): { sets?: number; reps?: string; distance_m?: number; duration_sec?: number } {
  const t = text.toLowerCase();
  const out: { sets?: number; reps?: string; distance_m?: number; duration_sec?: number } = {};
  const sx = /(\d+)\s*[x×]\s*(\d+(?:\s*[-–]\s*\d+)?)/.exec(t);
  if (sx) {
    out.sets = Number(sx[1]);
    out.reps = sx[2].replace(/\s/g, '');
    return out;
  }
  const dist = /(\d+(?:[.,]\d+)?)\s*(km|m|meter)\b/.exec(t);
  if (dist) out.distance_m = Number(dist[1].replace(',', '.')) * (dist[2] === 'km' ? 1000 : 1);
  const sec = /(\d+)\s*(s|sek|sec|sekunden|seconds)\b/.exec(t);
  const min = /(\d+)(?:\s*[-–]\s*\d+)?\s*(min|minuten|minutes)\b/.exec(t);
  if (sec) out.duration_sec = Number(sec[1]);
  else if (min) out.duration_sec = Number(min[1]) * 60;
  if (!dist && !sec && !min) {
    const range = /(\d+)\s*[-–]\s*(\d+)/.exec(t);
    const one = /(\d+)/.exec(t);
    if (range) out.reps = `${range[1]}-${range[2]}`;
    else if (one) out.reps = one[1];
  }
  return out;
}

/** Übung in fremdem Format → Satzwerk-Schema. */
function looseExercise(e: unknown, circuit: boolean): Obj | null {
  if (typeof e === 'string') {
    const m = /^\s*(\d+(?:\s*[x×]\s*\d+)?(?:\s*(?:wdh\.?|reps|meter|m|sek\.?|min\.?))?)\s+(.+)$/i.exec(e);
    const name = (m ? m[2] : e).replace(/\s*\(.*?\)\s*$/, '').trim();
    if (!name) return null;
    return { name, ...(m ? parseAmount(m[1]) : {}), ...(circuit ? { superset_group: 1, sets: 1 } : {}) };
  }
  if (!isObj(e)) return null;
  const name = str(pick(e, NAME_KEYS));
  if (!name) return null;
  const sets = num(pick(e, ['sets', 'sätze', 'saetze', 'satz', 'runden', 'rounds']));
  const repsRaw = pick(e, ['reps', 'wdh', 'wiederholungen', 'repetitions']);
  const amountRaw = pickRe(e, /volume|menge|umfang|dosierung|amount|prescription|vorgabe/i);
  const amount = typeof amountRaw === 'string' ? parseAmount(amountRaw) : typeof repsRaw === 'string' ? parseAmount(repsRaw) : {};
  const restRaw = pick(e, ['rest', 'rest_sec', 'pause', 'pausen', 'pause_sec']);
  const rest = typeof restRaw === 'string' ? parseAmount(restRaw).duration_sec ?? num(restRaw) : num(restRaw);
  const durRaw = pick(e, ['duration', 'dauer', 'duration_sec', 'zeit', 'time']);
  const notes = [str(pick(e, ['notes', 'note', 'hinweis', 'hinweise', 'tipp', 'description', 'beschreibung', 'cue'])), typeof amountRaw === 'string' && !amount.reps ? amountRaw : '']
    .filter(Boolean)
    .join(' · ');
  return {
    name,
    sets: sets ?? amount.sets ?? (circuit ? 1 : undefined),
    reps: typeof repsRaw === 'number' ? repsRaw : (amount.reps ?? (typeof repsRaw === 'string' ? repsRaw : null)),
    weight_kg: pick(e, ['weight_kg', 'weight', 'gewicht', 'gewicht_kg', 'load']),
    duration_sec: amount.duration_sec ?? (typeof durRaw === 'string' ? parseAmount(durRaw).duration_sec : num(durRaw)),
    distance_m: amount.distance_m ?? null,
    rest_sec: rest ?? undefined,
    notes,
    superset_group: circuit ? 1 : (pick(e, ['superset_group', 'superset']) ?? null),
  };
}

/** Sucht Trainingstage samt Übungslisten irgendwo im JSON (fremde Strukturen). */
export function findLooseRoutines(raw: unknown): { routines: Obj[]; summary: string[] } {
  const routines: Obj[] = [];
  const summary: string[] = [];
  const titleOf = (o: Obj, key: string) => {
    const parts = [str(pick(o, ['day', 'tag'])), str(pick(o, ['name', 'title', 'titel', 'focus', 'fokus']))].filter(Boolean);
    const fallback = key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
    return parts.join(': ') || fallback || `Tag ${routines.length + 1}`;
  };
  const walk = (node: unknown, key: string, depth: number) => {
    if (depth > 6 || node === null || node === undefined) return;
    if (Array.isArray(node)) {
      if (node.every((x) => typeof x === 'string') && /guideline|tipp|regel|rule|hinweis|note|ernährung|nutrition/i.test(key)) {
        summary.push(...(node as string[]));
        return;
      }
      node.forEach((n, i) => walk(n, `${key} ${i + 1}`, depth + 1));
      return;
    }
    if (!isObj(node)) return;
    // Ist dieses Objekt ein Trainingstag? → hat eine Liste mit Übungen
    for (const [k, v] of Object.entries(node)) {
      if (!Array.isArray(v) || v.length === 0) continue;
      const exerciseList = v.every(isExerciseObj) || (LIST_KEYS.test(k) && v.every((x) => typeof x === 'string' || isExerciseObj(x)));
      if (!exerciseList) continue;
      const formatText = [str(pick(node, ['format', 'type', 'typ', 'art', 'structure', 'struktur', 'protocol'])), str(pick(node, ['description', 'beschreibung', 'notes', 'hinweis']))]
        .filter(Boolean)
        .join(' · ');
      const circuit = /zirkel|circuit|amrap|emom|runden|rounds|metcon/i.test(`${formatText} ${titleOf(node, key)} ${k}`);
      const exercises = v.map((x) => looseExercise(x, circuit)).filter((x): x is Obj => !!x);
      if (exercises.length) {
        const amrap = /amrap|so viele runden/i.test(formatText) ? /(\d+)\s*min/i.exec(formatText) : null;
        routines.push({
          name: titleOf(node, key),
          notes: formatText,
          exercises: amrap ? exercises.map((x, i) => (i === 0 ? { ...x, interval: { mode: 'amrap', minutes: Number(amrap[1]) } } : x)) : exercises,
        });
        return;
      }
    }
    // Ausdauertag ohne Übungsliste (z. B. „activity“: „Laufen“, „duration“: „30-45 Min“)
    const activity = str(pickRe(node, /^(activity|aktivität|aktivitaet|sport|einheit|cardio)$/i));
    const dur = pickRe(node, /^(duration|dauer|zeit)$/i);
    if (activity && depth > 0) {
      const d = typeof dur === 'string' ? parseAmount(dur).duration_sec : num(dur);
      routines.push({ name: titleOf(node, key), notes: str(pick(node, ['description', 'beschreibung', 'notes', 'hinweis'])), exercises: [{ name: activity, sets: 1, reps: null, duration_sec: d ?? null, rest_sec: 0 }] });
      return;
    }
    for (const [k, v] of Object.entries(node)) walk(v, k, depth + 1);
  };
  walk(raw, '', 0);
  return { routines, summary };
}

export function parsePlanResponse(text: string): ParseResult {
  const json = extractJson(stripCitationArtifacts(text));
  if (!json) {
    return looksLikeProsePlan(text)
      ? { ok: false, code: 'prose', error: 'Die KI hat den Plan als Text statt als JSON geschickt. Schick ihr den Korrektur-Prompt unten – dann liefert sie denselben Plan im richtigen Format.' }
      : { ok: false, code: 'no_json', error: 'Kein JSON gefunden. Füge die komplette Antwort der KI ein.' };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    // Häufige KI-Fehler: Kommas vor schließenden Klammern.
    try {
      raw = JSON.parse(json.replace(/,\s*([}\]])/g, '$1'));
    } catch (e) {
      return { ok: false, code: 'invalid_json', error: `Das JSON ist fehlerhaft (${e instanceof Error ? e.message : 'Syntaxfehler'}). Bitte die KI, nur gültiges JSON zu liefern.` };
    }
  }
  const o = (raw ?? {}) as Record<string, unknown>;
  const warnings: string[] = [];
  let routinesRaw: unknown[] | null = Array.isArray(o.routines) && o.routines.length ? o.routines : null;
  let looseSummary: string[] = [];
  if (!routinesRaw) {
    // Fremdes Format: Trainingstage selbst suchen.
    const loose = findLooseRoutines(raw);
    if (loose.routines.length) {
      routinesRaw = loose.routines;
      looseSummary = loose.summary;
      warnings.push('Die KI hat ein eigenes Format verwendet – Satzwerk hat es übersetzt. Bitte Übungen und Vorgaben prüfen.');
    }
  }
  if (!routinesRaw || routinesRaw.length === 0) {
    return { ok: false, code: 'no_routines', error: 'Im JSON wurden keine Trainingstage mit Übungen gefunden.' };
  }

  const routines: ParsedRoutine[] = [];
  routinesRaw.forEach((r, ri) => {
    const ro = (r ?? {}) as Record<string, unknown>;
    const exRaw = Array.isArray(ro.exercises) ? ro.exercises : [];
    const exercises: ParsedExercise[] = [];
    exRaw.forEach((e, ei) => {
      const eo = (e ?? {}) as Record<string, unknown>;
      const name = str(eo.name);
      if (!name) {
        warnings.push(`Routine ${ri + 1}, Übung ${ei + 1}: ohne Namen – übersprungen.`);
        return;
      }
      const reps = parseReps(eo.reps);
      const sets = Math.min(15, Math.max(1, Math.round(num(eo.sets) ?? 3)));
      exercises.push({
        name,
        sets,
        warmupSets: Math.min(5, Math.max(0, Math.round(num(eo.warmup_sets) ?? 0))),
        repsMin: reps.min,
        repsMax: reps.max,
        repsText: reps.text,
        weightKg: (() => {
          const w = num(eo.weight_kg ?? eo.weight);
          return w && w > 0 ? w : null;
        })(),
        durationSec: (() => {
          const d = num(eo.duration_sec);
          return d && d > 0 ? Math.round(d) : null;
        })(),
        distanceM: (() => {
          const d = num(eo.distance_m);
          return d && d > 0 ? d : null;
        })(),
        restSec: Math.min(600, Math.max(0, Math.round(num(eo.rest_sec) ?? 90))),
        supersetGroup: (() => {
          const g = num(eo.superset_group);
          return g && g > 0 ? Math.round(g) : null;
        })(),
        interval: parseInterval(eo.interval),
        notes: str(eo.notes),
        newExercise: parseNewExercise(eo.new_exercise),
      });
    });
    if (exercises.length === 0) warnings.push(`Routine „${str(ro.name) || ri + 1}“ hat keine Übungen.`);
    routines.push({ name: str(ro.name) || `Tag ${ri + 1}`, notes: str(ro.notes), exercises });
  });

  return {
    ok: true,
    plan: {
      name: str(o.plan_name) || str(pick(o, ['name', 'title', 'titel', 'plan', 'planname'])) || 'KI-Plan',
      summary: [str(o.summary), ...looseSummary].filter(Boolean).join('\n'),
      changes: str(o.changes),
      routines,
    },
    warnings,
  };
}

// ── Übungen zuordnen ──────────────────────────────────────────

const SYNONYMS: [RegExp, string][] = [
  [/\bkettlebell[s]?\b/g, 'kb'],
  [/\bkurzhantel[n]?\b/g, 'kurzhanteln'],
  [/\bdumbbell[s]?\b/g, 'kurzhanteln'],
  [/\bbarbell\b/g, 'langhantel'],
  [/\bsquat[s]?\b/g, 'squat'],
];

function tokens(s: string): string[] {
  let n = normalizeSearch(s);
  for (const [re, rep] of SYNONYMS) n = n.replace(re, rep);
  return n.split(' ').filter((t) => t.length > 1 || /\d/.test(t));
}

/** Ähnlichkeit 0–1 (Dice-Koeffizient über Wort-Token). */
export function nameSimilarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.length || !tb.length) return 0;
  if (ta.join(' ') === tb.join(' ')) return 1;
  const setB = new Set(tb);
  const common = ta.filter((t) => setB.has(t)).length;
  return (2 * common) / (ta.length + tb.length);
}

export type MatchResult = { id: string | null; suggestions: { id: string; name: string; score: number }[] };

export function matchExercise(name: string, library: { id: string; name: string }[]): MatchResult {
  const scored = library
    .map((e) => ({ id: e.id, name: e.name, score: nameSimilarity(name, e.name) }))
    .filter((s) => s.score > 0.3)
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  // Eindeutig: exakter Treffer oder sehr ähnlich und klar vor dem Zweitbesten.
  const auto = best && (best.score === 1 || (best.score >= 0.8 && (scored[1]?.score ?? 0) < best.score - 0.1));
  return { id: auto ? best.id : null, suggestions: scored.slice(0, 3) };
}

// ── In Routinen umwandeln ─────────────────────────────────────

/** Rastet ein Gewicht auf die nächste verfügbare Stufe ein. */
export function snapWeight(kg: number | null, options: number[] | null): number | null {
  if (kg === null) return null;
  if (!options || options.length === 0) return Math.round(kg * 4) / 4;
  return options.reduce((best, w) => (Math.abs(w - kg) < Math.abs(best - kg) ? w : best), options[0]);
}

export function toRoutineExercise(
  p: ParsedExercise,
  exerciseId: string,
  loggingType: LoggingType,
  weightOptions: number[] | null,
): RoutineExerciseData {
  const weight = snapWeight(p.weightKg, weightOptions);
  const usesReps = loggingType !== 'duration';
  const set = (type: SetType) => ({
    type,
    weight: type === 'warmup' && weight !== null ? snapWeight(weight * 0.5, weightOptions) : weight,
    reps: usesReps ? (type === 'warmup' ? (p.repsMin ? Math.max(p.repsMin, 8) : null) : p.repsMin) : null,
    repsRight: loggingType === 'reps_per_side' && usesReps && type !== 'warmup' ? p.repsMin : null,
    duration: p.durationSec,
    distance: p.distanceM,
  });
  const noteParts = [
    p.repsText && p.repsMin !== p.repsMax ? `${p.repsText} Wdh.` : p.repsText && p.repsMin === null ? p.repsText : null,
    p.notes || null,
  ].filter(Boolean);
  return {
    exerciseId,
    supersetGroup: p.supersetGroup,
    restSeconds: p.restSec,
    note: noteParts.join(' · '),
    interval: p.interval,
    sets: [...Array.from({ length: p.warmupSets }, () => set('warmup')), ...Array.from({ length: p.sets }, () => set('normal'))],
  };
}

// ── Verlaufszusammenfassung für die Überarbeitung ─────────────

export type RevisionInput = {
  history: (HistorySet & { rpe?: number | null })[];
  workouts: { startedAt: number; rating: number | null; energy: number | null }[];
  exerciseName: (id: string) => string;
  bodyweight: { day: string; value: number }[];
  goals: { title: string; progress: number }[];
  plannedDaysPerWeek: number;
  now: number;
  weeks: number;
};

const fmtKg = (n: number) => `${String(Math.round(n * 10) / 10).replace('.', ',')} kg`;

/** Kompakte, KI-lesbare Zusammenfassung der letzten Wochen. */
export function summarizeForRevision(i: RevisionInput): string {
  const since = i.now - i.weeks * 7 * 86_400_000;
  const sets = i.history.filter((s) => s.startedAt >= since && s.type !== 'warmup');
  const ws = i.workouts.filter((w) => w.startedAt >= since);
  const lines: string[] = [];
  lines.push(`Zeitraum: letzte ${i.weeks} Wochen, ${ws.length} Workouts (Ø ${(ws.length / i.weeks).toFixed(1).replace('.', ',')}/Woche, geplant ${i.plannedDaysPerWeek}/Woche).`);
  const avg = (v: (number | null)[]) => {
    const x = v.filter((n): n is number => n !== null);
    return x.length ? (x.reduce((a, b) => a + b, 0) / x.length).toFixed(1).replace('.', ',') : null;
  };
  const r = avg(ws.map((w) => w.rating));
  const e = avg(ws.map((w) => w.energy));
  if (r || e) lines.push(`Ø Gefühl ${r ?? '–'}/5, Ø Energie ${e ?? '–'}/5.`);
  const bw = i.bodyweight.filter((b) => new Date(`${b.day}T12:00:00`).getTime() >= since).sort((a, b) => a.day.localeCompare(b.day));
  if (bw.length >= 2) lines.push(`Körpergewicht: ${fmtKg(bw[0].value)} → ${fmtKg(bw[bw.length - 1].value)}.`);
  if (i.goals.length) lines.push(`Ziele: ${i.goals.map((g) => `${g.title} (${Math.round(g.progress * 100)} %)`).join('; ')}.`);

  lines.push('', 'Übungen (Einheiten · bester Satz erste → letzte Einheit · Trend 1RM geschätzt · Ø RPE):');
  const byEx = new Map<string, typeof sets>();
  for (const s of sets) byEx.set(s.exerciseId, [...(byEx.get(s.exerciseId) ?? []), s]);
  for (const [id, list] of byEx) {
    const byWorkout = new Map<string, typeof list>();
    for (const s of list) byWorkout.set(s.workoutId, [...(byWorkout.get(s.workoutId) ?? []), s]);
    const sessions = [...byWorkout.values()].sort((a, b) => a[0].startedAt - b[0].startedAt);
    const best = (ss: typeof list) => {
      const top = [...ss].sort((a, b) => (estimate1RM(b.weight, b.reps) ?? (b.weight ?? 0) + (b.reps ?? 0) / 100) - (estimate1RM(a.weight, a.reps) ?? (a.weight ?? 0) + (a.reps ?? 0) / 100))[0];
      if (top.duration && !top.reps) return { text: `${top.duration}s`, e1rm: null };
      return { text: `${top.weight ? fmtKg(top.weight) : 'KG'} × ${top.reps ?? '?'}`, e1rm: estimate1RM(top.weight, top.reps) };
    };
    const first = best(sessions[0]);
    const last = best(sessions[sessions.length - 1]);
    let trend = 'n/a';
    if (first.e1rm && last.e1rm && sessions.length >= 2) {
      const pct = Math.round(((last.e1rm - first.e1rm) / first.e1rm) * 100);
      trend = pct >= 3 ? `+${pct} % (steigend)` : pct <= -3 ? `${pct} % (fallend)` : `${pct >= 0 ? '+' : ''}${pct} % (stagniert)`;
    }
    const rpes = list.map((s) => s.rpe ?? null).filter((x): x is number => x !== null);
    const rpe = rpes.length ? ` · RPE ${(rpes.reduce((a, b) => a + b, 0) / rpes.length).toFixed(1).replace('.', ',')}` : '';
    lines.push(`- ${i.exerciseName(id)}: ${sessions.length}× · ${first.text} → ${last.text} · ${trend}${rpe}`);
  }
  if (byEx.size === 0) lines.push('- (keine Workouts im Zeitraum)');
  return lines.join('\n');
}

// ── Equipment-Beschreibung & aktueller Plan für den Prompt ────


const kg = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

export function describeEquipment(
  cfg: EquipmentConfig,
  label: (ref: EquipmentRef) => string,
  custom: { ref: EquipmentRef; name: string; weights: number[] }[],
): string {
  const lines: string[] = [];
  const has = (r: EquipmentRef) => cfg.available.includes(r);
  if (has('kettlebell')) lines.push(`- Kettlebells: ${cfg.kettlebells.length ? `${cfg.kettlebells.map(kg).join(', ')} kg` : 'Gewichte unbekannt'}`);
  if (has('dumbbell')) lines.push(`- Kurzhanteln: ${kg(cfg.dumbbells.min)}–${kg(cfg.dumbbells.max)} kg in ${kg(cfg.dumbbells.step)}-kg-Schritten`);
  if (has('barbell')) {
    const plates = cfg.barbell.plates.filter((p) => p.pairs > 0).map((p) => `${p.pairs * 2}×${kg(p.weight)}`).join(', ');
    lines.push(`- Langhantel (${kg(cfg.barbell.barWeight)} kg)${plates ? ` mit Scheiben ${plates} kg` : ''}`);
  }
  if (has('ez_bar')) lines.push(`- SZ-Stange (${kg(cfg.ezBar.barWeight)} kg)`);
  const simple = cfg.available.filter((r) => !['kettlebell', 'dumbbell', 'barbell', 'ez_bar', 'bodyweight'].includes(r) && !r.startsWith('custom:'));
  if (simple.length) lines.push(`- ${simple.map(label).join(', ')}`);
  for (const c of custom) {
    if (has(c.ref)) lines.push(`- ${c.name}${c.weights.length ? ` (${c.weights.map(kg).join(', ')} kg)` : ''}`);
  }
  lines.push('- Körpergewicht');
  return lines.join('\n');
}

/** Routinen → kompaktes JSON im KI-Schema (für die Überarbeitung). */
export function routinesToPlanJson(
  name: string,
  routines: { name: string; notes: string; exercises: RoutineExerciseData[] }[],
  exerciseName: (id: string) => string,
): string {
  const plan = {
    plan_name: name,
    routines: routines.map((r) => ({
      name: r.name,
      notes: r.notes || undefined,
      exercises: r.exercises.map((e) => {
        const work = e.sets.filter((s) => s.type !== 'warmup');
        const first = work[0] ?? e.sets[0];
        return {
          name: exerciseName(e.exerciseId),
          sets: work.length || e.sets.length,
          warmup_sets: e.sets.length - work.length || undefined,
          reps: first?.reps ?? null,
          weight_kg: first?.weight ?? null,
          duration_sec: first?.duration ?? undefined,
          rest_sec: e.restSeconds,
          superset_group: e.supersetGroup ?? undefined,
          notes: e.note || undefined,
        };
      }),
    })),
  };
  return JSON.stringify(plan, null, 1);
}
