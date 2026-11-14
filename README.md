# Eisen

Schlankes Trainingslogbuch fürs iPhone: Trainingspläne mit Sätzen, Wiederholungen und Gewichten,
ein Logbuch aller Trainings und der Fortschritt pro Übung.

Eisen ist eine installierbare Web-App (PWA). Sie besteht nur aus statischen Dateien, braucht keinen
Server und kein Konto, und läuft nach der Installation offline. Alle Daten bleiben auf dem Gerät.

## Funktionen

- **Pläne**: Übungen aus der Bibliothek (oder eigene) mit Zielgewicht und Wiederholungen pro Satz.
- **Training**: Sätze abhaken, die Werte vom letzten Mal stehen daneben und sind als Vorschlag
  vorausgefüllt. Pausentimer nach jedem Satz. Ein laufendes Training übersteht das Schließen der App.
- **Verlauf**: jedes Training mit Dauer, Volumen und Bestwerten; nachträglich bearbeitbar.
- **Übungen**: aktuelles Gewicht und Bestwert pro Übung, dazu Diagramme für Gewicht, geschätztes
  1RM und Volumen.
- **Backup**: Export und Import als JSON-Datei.

## Auf dem iPhone installieren

Die App muss über HTTPS erreichbar sein (zum Beispiel GitHub Pages). Dann:

1. Die Adresse in **Safari** öffnen.
2. **Teilen** antippen, dann **Zum Home-Bildschirm**.
3. Die App ab jetzt über das Icon starten.

Die installierte App hat einen eigenen Speicher, getrennt von Safari. Daten also erst nach der
Installation eintragen, oder per Backup übertragen.

iOS kann den Speicher von Web-Apps löschen, wenn die App gelöscht wird. Ab und zu ein Backup
exportieren (Einstellungen, oben rechts im Tab „Training“).

## Entwicklung

Voraussetzung: Node.js 20 oder neuer. Die App selbst hat keinen Build-Schritt und keine Abhängigkeiten.

```sh
npm install                      # nur für Tests und Icons (Playwright)
npm start                        # http://localhost:8080
npm test                         # Unit-Tests
npx playwright install webkit    # einmalig, Safari-Engine für die Browser-Tests
npm run test:e2e                 # klickt die App in WebKit durch, Screenshots in test/screenshots/
npm run icons                    # PNG-Icons aus icons/icon.svg neu erzeugen
```

| Pfad | Inhalt |
|---|---|
| `index.html`, `styles.css` | Gerüst und das komplette Styling |
| `js/model.js` | Datenmodell und Validierung (Speicher, Backup-Import) |
| `js/stats.js` | Berechnungen: Bestwerte, 1RM, Volumen, Vorschlagswerte |
| `js/store.js` | Zustand und Speicherung in `localStorage` |
| `js/editor.js` | Die Satz-Tabelle für Training, Plan und Verlauf |
| `js/views/` | Die Seiten: Training, Verlauf, Übungen, Einstellungen |
| `sw.js` | Service Worker für den Offline-Betrieb |

Neue Dateien unter `js/` oder `icons/` müssen in die Liste in `sw.js`; ein Unit-Test prüft das.

Der Service Worker liefert die App aus dem Cache und aktualisiert ihn im Hintergrund. Eine neue
Version ist deshalb beim zweiten Start nach der Veröffentlichung sichtbar.
