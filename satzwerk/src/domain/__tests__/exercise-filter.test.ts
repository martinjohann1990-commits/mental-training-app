import type { FilterableExercise } from '@/domain/exercise-filter';
import { EMPTY_FILTER, filterExercises, normalizeSearch } from '@/domain/exercise-filter';
import { defaultEquipmentConfig } from '@/domain/equipment';

const list: FilterableExercise[] = [
  { name: 'Kreuzheben', primaryMuscle: 'lower_back', secondaryMuscles: ['glutes'], equipment: ['barbell'] },
  { name: 'KB Swing (beidarmig)', primaryMuscle: 'glutes', secondaryMuscles: ['hamstrings'], equipment: ['kettlebell'] },
  { name: 'Liegestütz', primaryMuscle: 'chest', secondaryMuscles: ['triceps'], equipment: [] },
  { name: 'Bankdrücken (Langhantel)', primaryMuscle: 'chest', secondaryMuscles: [], equipment: ['barbell', 'bench', 'rack'] },
];
const names = (l: FilterableExercise[]) => l.map((e) => e.name);

describe('normalizeSearch', () => {
  it('löst Umlaute und Sonderzeichen auf', () => {
    expect(normalizeSearch('  Bankdrücken (Langhantel) ')).toBe('bankdruecken langhantel');
    expect(normalizeSearch('Farmer’s Walk')).toBe('farmer s walk');
  });
});

describe('filterExercises', () => {
  it('sortiert alphabetisch (deutsch)', () => {
    expect(names(filterExercises(list, EMPTY_FILTER, null))).toEqual([
      'Bankdrücken (Langhantel)', 'KB Swing (beidarmig)', 'Kreuzheben', 'Liegestütz',
    ]);
  });
  it('sucht umlaut-tolerant und mit mehreren Wörtern', () => {
    expect(names(filterExercises(list, { ...EMPTY_FILTER, query: 'bankdrucken' }, null))).toEqual([]);
    expect(names(filterExercises(list, { ...EMPTY_FILTER, query: 'Bankdrücken' }, null))).toHaveLength(1);
    expect(names(filterExercises(list, { ...EMPTY_FILTER, query: 'swing kb' }, null))).toEqual(['KB Swing (beidarmig)']);
  });
  it('filtert nach Muskel inkl. sekundärer Muskeln', () => {
    expect(names(filterExercises(list, { ...EMPTY_FILTER, muscle: 'glutes' }, null))).toEqual([
      'KB Swing (beidarmig)', 'Kreuzheben',
    ]);
  });
  it('Equipment-Filter „Körpergewicht“ findet Übungen ohne Geräte', () => {
    expect(names(filterExercises(list, { ...EMPTY_FILTER, equipment: 'bodyweight' }, null))).toEqual(['Liegestütz']);
  });
  it('„nur mein Equipment“ nutzt das aktive Profil', () => {
    const home = defaultEquipmentConfig('home');
    expect(names(filterExercises(list, { ...EMPTY_FILTER, onlyAvailable: true }, home))).toEqual([
      'KB Swing (beidarmig)', 'Liegestütz',
    ]);
  });
});
