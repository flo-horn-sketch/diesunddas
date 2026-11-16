# Pegel – Promille-Tracker

Eine kleine Handy-App (Progressive Web App), die deinen **geschätzten Blutalkohol** verfolgt.
Du trägst ein, was du trinkst, und Pegel zeigt dir:

- eine Getränke-Datenbank mit über 200 Einträgen (Biere, Weine, Cocktails, Longdrinks, Schnäpse, Liköre, Cider) zum Durchsuchen
- eine Stoppuhr: Getränk antippen startet sie sofort, „Stopp“ beendet sie; ein neues Getränk stoppt das laufende automatisch (Shots werden direkt eingetragen)
- Menge des laufenden Getränks direkt in der Stoppuhr-Karte ändern
- nachträgliches Eintragen („Nachtragen“) und Ändern (von–bis, Menge, Prozent)
- ein Bierglas-Maskottchen, das sich mit dem Pegel füllt, schwankt und das Gesicht verzieht, dazu Stufen wie „Leicht angeschwipst“ oder „Sternhagelvoll“
- Pegelbert spricht (Sprüche je Stufe, antippen für einen neuen), Kater-Wetterbericht, Bierdeckel mit Strichliste, Wasser-Knopf, Trinktempo-Urteil und Lall-Test mit Zungenbrechern
- den aktuellen Promillewert (aktualisiert sich alle 30 Sekunden)
- wann du voraussichtlich unter 0,5 ‰ bist und wann du rechnerisch nüchtern bist (mit Spanne)
- den Höchstwert und den Verlauf als Kurve inklusive Prognose
- die Einordnung nach deutscher Rechtslage (0,3 / 0,5 / 1,1 / 1,6 ‰)

Alle Daten bleiben **nur auf deinem Handy** (localStorage), es gibt keinen Server und kein Konto.

> ⚠️ Pegel liefert nur eine Schätzung. Der echte Wert kann deutlich abweichen.
> Nutze die App nie, um zu entscheiden, ob du Auto fahren kannst.

## Auf dem Handy installieren

Die App muss über **HTTPS** erreichbar sein, z. B. über GitHub Pages:

1. Im Repo auf GitHub: *Settings → Pages → Branch* wählen → *Save*.
2. Die angezeigte Adresse auf dem Handy öffnen.
3. **iPhone (Safari):** Teilen-Symbol → *Zum Home-Bildschirm*.
   **Android (Chrome):** Menü ⋮ → *App installieren*.

Danach startet Pegel wie eine normale App im Vollbild und funktioniert auch offline.

## Lokal entwickeln

Kein Build-Schritt nötig, es ist reines HTML/CSS/JavaScript.

```bash
python3 -m http.server 8080   # oder: npm start
# → http://localhost:8080
npm test                      # Tests für das Rechenmodell
```

Wenn du Dateien änderst, erhöhe `VERSION` in `sw.js`, damit installierte Apps das Update laden.

## So wird gerechnet

| Schritt | Modell |
|---|---|
| Alkoholmenge | Volumen × Vol.-% × 0,789 g/ml |
| Verteilung | Watson-Formel (Gesamtkörperwasser aus Geschlecht, Alter, Größe, Gewicht): BAK = 0,8 · A / (1,055 · TBW) |
| Trinkdauer | jedes Getränk hat „von–bis“; der Alkohol kommt gleichmäßig über diese Zeit in den Magen |
| Aufnahme | exponentiell; leerer Magen: Halbwertszeit 8 min, 10 % Resorptionsdefizit; voller Magen: 20 min, 20 % |
| Abbau | linear nach Widmark, 0,15 ‰/h (Spanne für „nüchtern“: 0,1 bis 0,2 ‰/h) |

Die Rechenlogik steckt komplett in `js/bac.js`, die Oberfläche in `js/app.js`.

## Projektstruktur

```
index.html            Oberfläche
css/style.css         Design (dunkel, Bernstein-Akzent)
js/bac.js             Rechenmodell (ohne DOM, testbar)
js/drinks.js          Getränke-Datenbank und Suche
js/icons.js           Strich-Icons
js/fun.js             Sprüche, Kater-Wetterbericht, Trinktempo, Zungenbrecher
fonts/                Inter und Space Grotesk (SIL Open Font License)
js/app.js             UI, Speicherung, Diagramm
sw.js                 Service Worker (Offline)
manifest.webmanifest  App-Manifest (Name, Icons)
icons/                App-Icons
test/*.test.js        Tests (node --test)
```

## Ideen für später

- Verlauf vergangener Abende / Statistik
- Erinnerung „Wasser trinken“ oder Push, wenn 0,0 ‰ erreicht
- Native App (z. B. mit Capacitor) für App Store / Play Store
