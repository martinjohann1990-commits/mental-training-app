# Satzwerk – Spezifikation

Eigenständiger Workout-Tracker für Android (eigener Name, eigenes Design, eigene Inhalte), erweitert um Ziele, Gewohnheiten, Fototagebuch und KI-Trainingsplan-Import.

## 1. Rahmen

| Thema | Entscheidung |
|---|---|
| Plattform | Android über Expo (React Native). Test per Expo Go, Web-Build für automatisierte Tests. Store-Release später (EAS Build). |
| Stack | Expo SDK (aktuell), TypeScript (strict), expo-router (Tabs), expo-sqlite + Drizzle ORM, Zustand, Jest/Vitest für Logik |
| Daten | Lokal-first (SQLite). Datenschicht gekapselt, damit später ein Backend mit Sync dazukommen kann. |
| Social | Nein |
| Sprache/Einheiten | Deutsch; kg/cm Standard, lbs/in umschaltbar |
| Design | Dark Mode Standard + Light Mode, Akzentfarbe Signal-Orange |

## 2. Übungsbibliothek
- Ca. 150 Standardübungen + **alle gängigen Kettlebell-Übungen** (Swing-Varianten, Clean, Snatch, Press, Jerk, Turkish Get-up, Goblet Squat, Windmill, Halo, Rows, Carries, Komplexe …), selbst erstellt, ohne fremde Bilder/Animationen
- Je Übung: deutscher Name, Muskelgruppen (primär/sekundär), Equipment, Ausführungshinweise, Logging-Typ
- Eigene Übungen anlegbar, optional eigenes Foto/Video anhängen
- **Logging-Typen:** Gewicht × Wdh. · Körpergewicht × Wdh. (± Zusatz-/Unterstützungsgewicht) · Dauer · Gewicht × Dauer/Distanz · Wdh. pro Seite (L/R)
- **Komplexe/Flows:** eine Übung aus mehreren Bewegungen

## 3. Equipment (Einstellungen)
- Mehrere Profile (z. B. „Home Gym“, „Studio“), ein aktives Profil
- Kategorien: Langhantel, Kurzhanteln, Kettlebells, SZ-Stange, Bank, Rack, Kabelzug, Maschinen, Klimmzugstange, Widerstandsbänder, Körpergewicht
- Gewichte pro Kategorie:
  - Kettlebells: Auswahl aus den Stufen 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 48 kg
  - **Kurzhanteln: in 1,5-kg-Schritten** (Bereich einstellbar)
  - Hantelscheiben-Bestand (für den Scheibenrechner)
- Genutzt für: Übungsfilter, Gewichtsauswahl beim Loggen, KI-Prompt

## 4. Routinen & Live-Workout
- Routinen anlegen, in Ordnern organisieren
- Live-Workout: Sätze abhaken, Vorschlag aus den Werten vom letzten Mal, Satztypen (Warm-up, Normal, Drop, Failure)
- Pro Satz Notiz + optional RPE; pro Workout Notiz + Gefühls-/Energie-Rating
- **Supersätze/Zirkel** (Pause erst nach der Runde)
- **Intervall-Modi:** EMOM, AMRAP, Tabata/Intervall-Timer
- **Pausentimer** automatisch, mit Benachrichtigung + Vibration auch bei gesperrtem Gerät
- **Scheibenrechner**
- Laufendes Workout übersteht das Schließen der App
- Workout aus dem Verlauf wiederholen oder als Routine speichern

## 5. Verlauf & Statistiken
- Verlauf aller Workouts (Liste + Kalender)
- Persönliche Rekorde, geschätztes 1RM, Volumen pro Woche, Charts pro Übung, Muskelgruppen-Verteilung
- Automatische Wochen- und Monatsrückblicke

## 6. Körpermaße & Fototagebuch
- Maße: Gewicht, Körperfett %, Brust, Taille, Hüfte, Oberarm L/R, Oberschenkel L/R, Wade, Nacken, Schultern + eigene Felder
- Fotos aus Kamera/Galerie, mehrere Posen pro Datum (vorne/seitlich/hinten), verknüpft mit den Maßen vom selben Tag
- Vorher/Nachher-Vergleich nebeneinander und mit Schieberegler
- Fotos nur app-intern gespeichert (nicht in der Galerie sichtbar)
- **App-Sperre** (Biometrie/Geräte-PIN): standardmäßig nur für das Fototagebuch, umschaltbar auf die ganze App

## 7. Ziele
- Typen: Kraftziel (Übung + Gewicht × Wdh. oder 1RM), Körpergewicht (ab/zu), Körpermaß, Gewohnheits-/Frequenzziel
- Startwert, Zielwert, optionale Deadline, Fortschrittsbalken, Prognose („bei aktuellem Tempo erreicht am …“)

## 8. Gewohnheiten
- Frei anlegbar: Typ Ja/Nein oder Zahl mit Tagesziel (Wasser, Schritte, Protein, Schlaf …)
- Häufigkeit: täglich oder x-mal pro Woche
- Streaks, Kalender-Heatmap, optionale tägliche Erinnerung
- Trainingsfrequenz-Ziel (z. B. 4 Workouts/Woche), das automatisch aus den geloggten Workouts erfüllt wird

## 9. KI-Trainingsplan
- **Phase jetzt: Import.** Die App erzeugt einen Prompt, der Ziel, Erfahrung, Tage/Woche, Dauer, Equipment (aktives Profil inkl. KB-Bestand) und Verletzungen abfragt bzw. einsetzt und eine Antwort als JSON nach festem Schema verlangt (Routinen → Übungen → Sätze/Wdh./Pausen/Notizen)
- Beim Import: unbekannte Übungen der Bibliothek zuordnen oder neu anlegen
- **Adaptiv:** Ein „Plan überarbeiten“-Prompt enthält eine Verlaufszusammenfassung (Progression, Stagnation, RPE, Ratings, Ziele) für Progression- und Deload-Vorschläge
- **Später:** direkter Claude-API-Aufruf über ein eigenes Backend (der API-Key liegt dann auf dem Server)

## 10. Backup
- Export als ZIP (Daten als JSON + Fotos), Import zur Wiederherstellung
- Erinnerung, wenn das letzte Backup älter als 14 Tage ist

## 11. Phasen
1. Gerüst, Datenbank, Übungsbibliothek (inkl. KB), Equipment-Einstellungen
2. Routinen + Live-Workout + Pausentimer + Intervall-Modi + Supersätze + Scheibenrechner
3. Verlauf + Statistiken + Rückblicke
4. Körpermaße + Fototagebuch + App-Sperre
5. Ziele + Gewohnheiten
6. KI-Import + adaptiver Überarbeitungs-Prompt
7. Backup/Export

Jede Phase wird committet und gepusht, mit Testanleitung für Expo Go.

## Später / nicht im Umfang
- Social-Features
- Backend mit Login und Sync, direkte KI-Integration
- iOS, Store-Release
