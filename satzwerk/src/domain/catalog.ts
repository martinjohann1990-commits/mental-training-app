/**
 * Feste Kataloge (Muskelgruppen, Equipment, Logging-Typen) mit deutschen Labels.
 * Die Keys werden in der Datenbank gespeichert und dürfen nicht umbenannt werden.
 */

export const MUSCLES = {
  chest: 'Brust',
  lats: 'Latissimus',
  upper_back: 'Oberer Rücken',
  lower_back: 'Unterer Rücken',
  traps: 'Trapez',
  shoulders: 'Schultern',
  biceps: 'Bizeps',
  triceps: 'Trizeps',
  forearms: 'Unterarme',
  abs: 'Bauch',
  obliques: 'Seitliche Bauchmuskeln',
  glutes: 'Gesäß',
  quads: 'Quadrizeps',
  hamstrings: 'Beinbeuger',
  adductors: 'Adduktoren',
  abductors: 'Abduktoren',
  calves: 'Waden',
  neck: 'Nacken',
  full_body: 'Ganzkörper',
  cardio: 'Ausdauer',
} as const;
export type Muscle = keyof typeof MUSCLES;
export const MUSCLE_KEYS = Object.keys(MUSCLES) as Muscle[];

export const EQUIPMENT = {
  barbell: 'Langhantel',
  dumbbell: 'Kurzhanteln',
  kettlebell: 'Kettlebells',
  ez_bar: 'SZ-Stange',
  bench: 'Bank',
  rack: 'Rack',
  cable: 'Kabelzug',
  machine: 'Maschinen',
  pullup_bar: 'Klimmzugstange',
  band: 'Widerstandsbänder',
  bodyweight: 'Körpergewicht',
} as const;
export type Equipment = keyof typeof EQUIPMENT;
export const EQUIPMENT_KEYS = Object.keys(EQUIPMENT) as Equipment[];

/** Verweis auf ein Gerät: feste Kategorie oder eigenes Gerät (`custom:<id>`). */
export type EquipmentRef = Equipment | `custom:${string}`;

export function isCustomEquipment(ref: string): ref is `custom:${string}` {
  return ref.startsWith('custom:');
}

export function isEquipmentRef(ref: unknown): ref is EquipmentRef {
  return typeof ref === 'string' && (EQUIPMENT_KEYS.includes(ref as Equipment) || (isCustomEquipment(ref) && ref.length > 7));
}

export const LOGGING_TYPES = {
  weight_reps: { label: 'Gewicht × Wdh.', hint: 'z. B. Bankdrücken 80 kg × 8' },
  bodyweight_reps: {
    label: 'Körpergewicht × Wdh.',
    hint: 'Optional mit Zusatz- oder Unterstützungsgewicht',
  },
  duration: { label: 'Dauer', hint: 'z. B. Plank 60 s' },
  weight_duration_distance: {
    label: 'Gewicht × Dauer/Distanz',
    hint: 'z. B. Farmer’s Carry 2 × 24 kg, 40 m',
  },
  reps_per_side: { label: 'Wdh. pro Seite', hint: 'Einarmig/-beinig, links und rechts getrennt' },
} as const;
export type LoggingType = keyof typeof LOGGING_TYPES;
export const LOGGING_TYPE_KEYS = Object.keys(LOGGING_TYPES) as LoggingType[];

/** Standard-Kettlebell-Stufen in kg. */
export const KETTLEBELL_STEPS = [4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 48] as const;

export type ExerciseDefinition = {
  id: string;
  name: string;
  primaryMuscle: Muscle;
  secondaryMuscles: Muscle[];
  /** Alle hier gelisteten Geräte werden benötigt. Leer = kein Equipment. */
  equipment: EquipmentRef[];
  loggingType: LoggingType;
  instructions: string;
  /** Bei Komplexen/Flows: IDs der enthaltenen Bewegungen in Reihenfolge. */
  complexParts?: string[];
};
