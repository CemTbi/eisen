# Eisen

Schlankes Trainingslogbuch fürs iPhone: Trainingspläne mit Sätzen, Wiederholungen und Gewichten,
ein Logbuch pro Übung zum Eintragen von Hand und der Fortschritt über die Zeit.

Eisen ist eine installierbare Web-App (PWA). Sie besteht nur aus statischen Dateien, braucht keinen
Server und kein Konto, und läuft nach der Installation offline. Alle Daten bleiben auf dem Gerät.

## Funktionen

- **Pläne**: Trainingspläne mit Übungen, Sätzen, Wiederholungen und Gewichten.
- **Logbuch**: pro Übung von Hand eintragen, was geschafft wurde (Datum, Sätze, Wiederholungen,
  Gewicht), auch rückwirkend, etwa alte Bestwerte. Ein Eintrag lässt sich direkt aus dem Plan
  starten und ist dann mit dessen Werten vorausgefüllt.
- **Fortschritt**: letztes Gewicht und Bestwert pro Übung, Diagramme für Gewicht, geschätztes 1RM
  und Volumen, Bestwerte werden markiert.
- **Sprache und Design**: Deutsch und Englisch, Designs „Midnight“ und „Schwarz“ (Einstellungen).
- **Backup**: Export und Import als JSON-Datei.

## Auf dem iPhone installieren

1. **https://cemtbi.github.io/eisen/** in **Safari** öffnen.
2. **Teilen** antippen, dann **Zum Home-Bildschirm**.
3. Die App ab jetzt über das Icon starten.

Die installierte App hat einen eigenen Speicher, getrennt von Safari. Daten also erst nach der
Installation eintragen, oder per Backup übertragen.

iOS kann den Speicher von Web-Apps löschen, wenn die App gelöscht wird. Ab und zu ein Backup
exportieren (Tab „Einstellungen“).

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
| `index.html`, `styles.css` | Gerüst und das komplette Styling, inklusive der Designs |
| `js/locales/` | Alle Texte und Übungsnamen, eine Datei pro Sprache |
| `js/model.js` | Datenmodell und Validierung (Speicher, Backup-Import) |
| `js/stats.js` | Berechnungen: Bestwerte, 1RM, Volumen |
| `js/store.js` | Zustand und Speicherung in `localStorage` |
| `js/editor.js` | Die Satz-Tabelle für Plan und Logbuch-Eintrag |
| `js/views/` | Die Seiten: Pläne, Logbuch, Eintrag, Einstellungen |
| `sw.js` | Service Worker für den Offline-Betrieb |

**Neue Sprache**: `js/locales/de.js` kopieren und übersetzen, in `js/i18n.js` unter `LOCALES`
eintragen. Ein Unit-Test prüft, dass keine Schlüssel fehlen.

**Neues Design**: einen Block `:root[data-theme="…"]` in `styles.css` ergänzen und den Namen in
`THEMES` (`js/model.js`), `BACKGROUND` (`js/appearance.js`) und den Sprachdateien eintragen.

Neue Dateien unter `js/` oder `icons/` müssen in die Liste in `sw.js`; ein Unit-Test prüft das.

## Veröffentlichen

GitHub Pages liefert den Branch `main` direkt aus: Ein `git push` veröffentlicht die neue Version
nach etwa einer Minute. Danach lässt sich die Live-Version prüfen:

```sh
BASE_URL=https://cemtbi.github.io/eisen/ npm run test:e2e
```

Der Service Worker liefert die App aus dem Cache und aktualisiert ihn im Hintergrund. Eine neue
Version ist deshalb beim zweiten Start nach der Veröffentlichung sichtbar.
