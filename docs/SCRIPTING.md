# Missions-Skripte

Anforderungsanalyse, gemeinsam erarbeitet am 2026-10-18. Grundlage für die Umsetzung (siehe „Umsetzungsphasen“ am Ende).

Die API-Referenz zum Skripten steht in [SCRIPTING_API.md](SCRIPTING_API.md).

## Ziel

Missionen bekommen Verhalten über die Zeit per Skript statt per JSON-Event: Objekte auf der Karte sind Objekte im Skript-Code und lassen sich „programmieren“. Die `.zcampaign` bleibt für Karte, Platzierung und Startzustand (z.B. `onFire`) zuständig.

Das bisherige JSON-Event-System (`events` im Level, `event-system.ts`, Events-Panel im Editor) war noch im Aufbau und wird durch Skripte ersetzt, nicht parallel weitergeführt.

## Nicht-Ziele (vorerst)

- Brand/Rauch, der während der Mission entsteht (bräuchte zusätzlich einen Blitz-Effekt)
- Intro-Sequenzen (Eingabe sperren, Kamerafahrten)
- Sprachausgabe für Funksprüche (es gibt nur Text)
- Ausblenden (Fade) von Objekten, z.B. auf Wasser
- Eigener Skript-Interpreter / Lua: Skripte schreibt nur der Entwickler, sie werden mitgebündelt

## Anwendungsfälle

- **Zephyr „Ikarus“:** Versorgungsschiff treibt manövrierunfähig seitlich auf Windrad 2 zu, funkt dabei um Hilfe; bei Berührung stürzen Schiff und Windrad ein, Mission fehlgeschlagen.
- **Zephyr, brennendes Windrad:** Das Skript legt fest, wann es einstürzt.
- **Xmas „Absturz“:** Die Person am abgestürzten Schlitten kommt in den Heli und meldet, dass noch Rentiere da draußen sind. Rentiere erscheinen erst auf der Minimap, wenn der Heli in der Nähe ist.

## Dateien und Einbindung

- **Skripte sind optional:** Kampagnen ohne Skriptdatei und Missionen ohne Skript-Eintrag laufen unverändert.
- Die **Vorschau im Kampagneneditor** wendet das Skript der Kampagne ebenfalls an.
- Pro Kampagne eine TypeScript-Datei neben der Kampagne: `src/game/campaigns/<key>.script.ts` (z.B. `zephyr.script.ts`).
- Volle TypeScript-Möglichkeiten: Hilfsfunktionen, Konstanten, Imports eigener Dateien, auch kampagnenübergreifend.
- Skripte importieren nur die Skript-API (`@/game/script`), keine Spiel-Interna (`state`, `sim/…`). Wird per Lint-Regel erzwungen.
- Geladen wird automatisch per Dateiname, im Spiel und in der Kampagnen-Vorschau.
- Missionen werden über eine feste `id` im Level angesprochen (nicht über die Nummer, die sich beim Löschen von Missionen verschiebt). Missionen ohne Skript-Eintrag laufen ohne Skript.

## Objektmodell

- **Alle platzierbaren Objekte** sind ansprechbar: Schiffe, Windräder, Plattformen, Gebäude/Props, Personen, Kisten, Rentiere, und der Heli.
- Objekte bekommen im Editor einen **optionalen Namen** (`"name": "versorger"`). Personen/Kisten (`payloads`) und Objekte teilen sich einen Namensraum; Namen sind pro Mission eindeutig.
- Unbenannte Objekte erreicht man über den Typ: `all('reindeer')`.
- **Typsicherheit:** Aus der `.zcampaign` wird pro Kampagne eine Typdatei erzeugt (Namen und Typen pro Mission). `object('versorgr')` (Tippfehler) oder ein Name, der in dieser Mission nicht platziert ist, ist ein Kompilierfehler; der Rückgabetyp ergibt sich automatisch (`object('versorger')` ist ein `Vessel`). Personen, die an Bord starten, sind enthalten.
- Jedes Objekt hat ein `type`-Feld; TypeScript schränkt darüber ein (`if (ziel.type === 'wind_turbine')`).
- Aktionen, die ein Objekttyp nicht kann, gibt es an seinem Typ nicht (z.B. kein `onTouch` für Rentiere, die keine Kollisionsbox haben).

## API (Entwurf)

```ts
// src/game/campaigns/zephyr.script.ts
import { defineCampaignScript } from '@/game/script';
import type { ZephyrObjects } from './zephyr.script-objects'; // generiert

export default defineCampaignScript<ZephyrObjects>({
    ikarus: async ({ object, wait, mission }) => {
        const versorger = object('versorger');   // Vessel
        const wt2 = object('wt2');               // WindTurbine

        versorger.speed = 3;                            // treibt seitlich, Bug bleibt
        versorger.course = versorger.bearingTo(wt2);

        versorger.onTouch(wt2, () => {
            versorger.destroy();
            wt2.destroy();
            mission.fail({ de: '…', en: '…', fr: '…', es: '…', pt: '…' });
        });

        await wait(5);
        versorger.radio({ de: 'Mayday, Mayday! …', en: '…', fr: '…', es: '…', pt: '…' });
    },
});
```

### Mission

- `mission.win()`, `mission.fail(text?)`
- `mission.rescued`, `mission.onBoard`, `mission.remaining`, `mission.endless`
- `mission.message(text)`, `mission.setWind(stärke)`

### Ablauf und Zeit

- `await wait(sekunden)`
- `when(bedingung, aktion)`: prüft jeden Tick, löst einmal aus
- `every(sekunden, aktion)`, `onTick(dt => …)`

### Objekte (Auswahl)

- Alle: `x`, `y`, `type`, `name`, `destroyed`, `distanceTo(obj)`, `bearingTo(obj)`, `destroy()`, `onHeliNear(abstand, aktion)`, `minimap.hidden`
- Mit Kollisionsbox zusätzlich: `onTouch(obj, aktion)`
- Schiff: `heading`, `course`, `speed` (Startwerte aus der `.zcampaign`), `radio(text)`
- Windrad: `setOnFire()`, `setOnSmoke()`, `spin(an)`
- Person/Kiste: `state` (`'waiting' | 'hanging' | 'onBoard' | 'rescued'`), `onBoard(aktion)`, `onRescued(ziel => …)` (Ort des Absetzens wird mitgegeben, Retten und Abliefern sind dasselbe Ereignis), `radio(text)`

### Texte

Alle Texte (Funk, Meldungen, Fail-Grund) stehen im Skript und brauchen **alle 5 Sprachen** (de, en, fr, es, pt), sonst Kompilierfehler. Funk erstmal nur als Text.

## Missionsablauf

- Das Skript startet zum Missionsstart (nach dem Briefing) und wird bei Abbruch, Neustart oder Missionsende sauber beendet; laufende `wait(…)` werden verworfen.
- Ziele aus der `.zcampaign` und Skript-Bedingungen gelten beide: was zuerst eintritt (Sieg oder Niederlage), entscheidet.
- Skripte laufen auch im Endlosmodus (`mission.endless` abfragbar).
- Laufzeitfehler im Skript zeigen den roten Debug-Screen.

## Zerstörung (Einsturz)

- Keine Wrack-Modelle mehr: Jedes Objekt stürzt **aus sich heraus** ein, animiert über einige Sekunden.
- Prinzip: Die Bauteile (Knoten des D3F-Modells) kippen um ihren Fußpunkt Richtung Boden, jeweils leicht unterschiedlich, und sacken ab, sodass die oberen Teile in die unteren fallen. Dazu Explosion, Trümmer und Rauch.
- Gilt für alle Objekte, auch Schiffe: Die Teile bleiben schwimmend liegen, nichts verschwindet.
- Nach dem Einsturz hat das Objekt keine Kollisionsbox mehr.
- Beim Einsturz entsteht am Fuß des Objekts je nach Untergrund eine Gischtwolke (Wasser) oder Staubwolke (Land), wie beim Heli-Abwind.
- Feuer und Rauch, die zum Objekt gehören (`onFire`/`onSmoke`), wandern mit auf den Trümmerhaufen und brennen dort weiter; abschalten per Skript (`setOnFire(false)`/`setOnSmoke(false)`). Frei platzierte Emitter bleiben unberührt. Alle Partikel werden vom Wind mitgenommen.
- Es gibt keine fest eingebauten Folgen von Berührungen mehr (die bisherige Schiff-trifft-Windrad-Regel entfällt): was passiert, entscheidet ausschließlich das Skript.

## Berührung (Kollision)

- `onTouch` prüft, ob sich die Kollisionsboxen zweier Objekte im **3D-Raum** überschneiden (x, y und z, gedreht mit dem Objektwinkel). Überdeckung im Bild spielt keine Rolle: Ein Schiff unter einer Gondel berührt sie nicht.
- Objekte ohne Kollisionsbox (z.B. Rentiere) haben kein `onTouch`.

## Editor

- Optionales Namensfeld für Objekte, Personen und Kisten; Namen auf der Karte sichtbar.
- Missions-`id` pro Level.
- Button „Skript öffnen“: öffnet `<key>.script.ts`, legt sie bei Bedarf mit Vorlage an.
- Beim Speichern der `.zcampaign` wird die Typdatei (Namen und Typen pro Mission) neu erzeugt.

## Rahmenbedingungen

- Keine spürbare Last auf iOS: Bedingungen und Berührungen werden einmal pro Physik-Tick geprüft, nur für Objekte, die das Skript abfragt.
- Skripte sind normaler gebündelter Code (App-Store-konform, kein Nachladen von Code).

## Umsetzungsphasen

1. **Spiel-Kern** (umgesetzt 2026-10-18): Skript-Laufzeit und API, Namen/IDs in den Daten, Typgenerierung, seitliches Treiben, Einsturz, Berührung, Funk/Meldungen, Sieg/Niederlage, Fortschritt, Personen-Ereignisse, Minimap-Sichtbarkeit. Skripte in der Kampagnen-Vorschau. „Ikarus“ und die Demo-Absetz-Testkarte auf Skript, altes JSON-Event-System komplett entfernen (Typen, Laufzeit, Editor-Panel, Kartenlinien, Daten). Unit-Tests.
2. **Editor:** Namensfeld, Missions-ID, Namen auf der Karte, „Skript öffnen“, Typgenerierung beim Speichern.
3. **Doku:** `docs/CAMPAIGN_FORMAT.md` um Namen, Missions-ID und Skripte ergänzen.
