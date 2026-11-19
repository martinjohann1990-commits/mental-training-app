# Satzwerk

Workout-Tracker für Android (Expo / React Native). Spezifikation: [`../SPEC.md`](../SPEC.md).

## Stand: Phase 1 ✅
- Grundgerüst: Expo SDK 58, TypeScript strict, expo-router (Tabs: Training · Übungen · Profil)
- Lokale Datenbank: expo-sqlite + Drizzle ORM mit Migrationen (`drizzle/`)
- Übungsbibliothek: 162 Standard- + 82 Kettlebell-Übungen (inkl. Komplexe/Flows), Suche (umlaut-tolerant), Filter nach Muskel, Gerät und „nur mein Equipment“
- Eigene Übungen anlegen, bearbeiten, löschen – inkl. eigener Komplexe
- Equipment-Profile („Home Gym“, „Studio“, beliebig viele): Geräte, Kettlebell-Stufen, Kurzhanteln (Bereich + 1,5-kg-Schritte), Stange + Scheibenbestand, SZ-Stange
- Einstellungen: kg/lbs, Dunkel/Hell/System (Standard: Dunkel)

## Stand: Phase 2 ✅
- Routinen anlegen/bearbeiten/duplizieren, in Ordnern organisieren
- Live-Workout: Sätze abhaken, Satztypen (Aufwärmen/Normal/Drop/Versagen), „Vorher“-Spalte mit Werten vom letzten Mal, RPE + Notiz pro Satz
- Pausentimer mit ±15 s, Benachrichtigung + Vibration (auch bei gesperrtem Handy)
- Supersätze/Zirkel (Pause erst nach der Runde)
- Intervall-Modi: EMOM, AMRAP, Intervall/Tabata mit Vollbild-Timer; Ergebnis wird als Sätze eingetragen
- Kettlebell-/Kurzhantel-Gewichte per Auswahl aus dem Equipment-Profil, Scheibenrechner für Langhantel
- Laufendes Workout übersteht das Schließen der App
- Abschluss mit Gefühl/Energie/Notiz, Workout-Detail, „Wiederholen“ und „Als Routine speichern“

## Stand: Phase 3 ✅
- Neue Tabs **Verlauf** (Liste nach Monaten + Kalender) und **Statistik**
- Statistik: Workouts, Trainingszeit, Volumen, Wochenserie; Volumen pro Woche (Säulen), Muskelgruppen-Verteilung, neueste Rekorde; Zeitraum 4/12/52 Wochen
- Pro Übung: Fortschritts-Chart (1RM geschätzt, Max. Gewicht, Volumen, Wdh./Dauer/Distanz je nach Typ), Bestwerte, Verlaufstabelle
- Rekord-Abzeichen 🏆 im Workout-Detail (ab der zweiten Einheit einer Übung)
- Wochen- und Monatsrückblicke mit Vergleich zum Vorzeitraum, Ø Gefühl/Energie, Top-Übungen, Rekorden

## APK / Updates
- APK-Builds über EAS (`eas.json`, Profil `preview`), Projekt: https://expo.dev/accounts/martinjo90/projects/satzwerk
- Updates ohne Neuinstallation über EAS Update (Kanal `preview`), solange keine neuen nativen Module dazukommen
- `version` in `app.json` = Runtime-Version: bei neuen nativen Modulen erhöhen und neue APK bauen

## Auf dem Android-Handy testen (Expo Go)
1. **Expo Go** aus dem Play Store installieren.
2. Repo klonen, Branch auschecken, dann:
   ```bash
   cd satzwerk
   npm install
   npx expo start
   ```
3. QR-Code im Terminal mit Expo Go scannen (Handy und Rechner im selben WLAN; sonst `npx expo start --tunnel`).

## Entwicklung
```bash
npm test             # Unit-Tests (Jest)
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm run db:generate  # neue Migration nach Änderung an src/db/schema.ts
npm run web          # Web-Version (nur für automatisierte Tests)
```

## Struktur
```
src/app/        Screens (expo-router)
src/components/ UI-Bausteine
src/data/       Mitgelieferte Übungen
src/db/         Schema, Client, Seed, Repositories
src/domain/     Reine Logik (getestet): Kataloge, Equipment, Filter
src/stores/     Zustand-Stores (Einstellungen)
src/theme/      Farben (Signal-Orange), Theme-Hook
drizzle/        Generierte SQL-Migrationen
```
