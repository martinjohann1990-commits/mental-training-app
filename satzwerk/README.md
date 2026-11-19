# Satzwerk

Workout-Tracker für Android (Expo / React Native). Spezifikation: [`../SPEC.md`](../SPEC.md).

## Stand: Phase 1 ✅
- Grundgerüst: Expo SDK 58, TypeScript strict, expo-router (Tabs: Training · Übungen · Profil)
- Lokale Datenbank: expo-sqlite + Drizzle ORM mit Migrationen (`drizzle/`)
- Übungsbibliothek: 162 Standard- + 82 Kettlebell-Übungen (inkl. Komplexe/Flows), Suche (umlaut-tolerant), Filter nach Muskel, Gerät und „nur mein Equipment“
- Eigene Übungen anlegen, bearbeiten, löschen – inkl. eigener Komplexe
- Equipment-Profile („Home Gym“, „Studio“, beliebig viele): Geräte, Kettlebell-Stufen, Kurzhanteln (Bereich + 1,5-kg-Schritte), Stange + Scheibenbestand, SZ-Stange
- Einstellungen: kg/lbs, Dunkel/Hell/System (Standard: Dunkel)

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
