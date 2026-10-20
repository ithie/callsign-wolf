# Skript-API

Referenz für Kampagnen-Skripte. Hintergrund und Anforderungen stehen in [SCRIPTING.md](SCRIPTING.md), die Typen in [src/game/script/index.ts](../src/game/script/index.ts).

## Einstieg

Ein Skript ist optional. Es liegt neben der Kampagne als `src/game/campaigns/<key>.script.ts` und wird automatisch geladen, im Spiel und in der Kampagnen-Vorschau.

```ts
import { defineCampaignScript } from '@/game/script';
import type { ZephyrObjects } from './zephyr.script-objects';

export default defineCampaignScript<ZephyrObjects>({
    ikarus: async ({ object, all, heli, mission, wait, when, every, onTick }) => {
        // …
    },
});
```

- **Schlüssel** sind die Missions-`id` aus der `.zcampaign` (`"id": "ikarus"`). Missionen ohne `id` oder ohne Eintrag laufen ohne Skript.
- **Start:** nach dem Briefing. **Ende:** bei Sieg, Niederlage, Absturz, Neustart oder Verlassen der Mission. Laufende `wait(…)` und alle Bedingungen werden dann verworfen.
- **Imports:** nur `@/game/script` und Dateien in `src/game/campaigns/` (z. B. eigene Hilfsfunktionen). Alles andere bricht den Build ab.
- **Fehler** zur Laufzeit zeigen den roten Debug-Screen.

## Namen und Typen

Objekte und Personen/Kisten bekommen in der `.zcampaign` ein optionales `"name"`. Namen sind pro Mission eindeutig, Objekte und Personen teilen sich einen Namensraum.

Beim Build und im Dev-Server entsteht daraus `<key>.script-objects.ts` (nicht von Hand bearbeiten). Dadurch gilt:

- `object('versorgr')` (Tippfehler) oder ein Name, der in dieser Mission nicht existiert, ist ein **Kompilierfehler**.
- Der Rückgabetyp ergibt sich aus dem Objekt: `object('versorger')` ist ein `Vessel`, `object('wt2')` ein `WindTurbine`.

Nicht ansprechbar sind `pad`, `lighthouse`, `ornithopter_wreck`, `volleyball_court` und `ring`.

## Kontext

| Name | Beschreibung |
|---|---|
| `object(name)` | Benanntes Objekt dieser Mission, typisiert. |
| `all(type)` | Alle Objekte eines Typs, auch unbenannte, z. B. `all('reindeer')`. |
| `heli` | Der Spieler-Heli (siehe unten). |
| `mission` | Sieg, Niederlage, Fortschritt, Meldungen (siehe unten). |
| `await wait(sek)` | Wartet Spielzeit ab. Pausiert mit dem Spiel. |
| `when(bedingung, aktion)` | Prüft jeden Physik-Tick, löst **einmal** aus. |
| `every(sek, aktion)` | Wiederholt alle `sek` Sekunden Spielzeit. |
| `onTick(dt => …)` | Jeder Physik-Tick, `dt` in Sekunden. |

## Mission

| Name | Beschreibung |
|---|---|
| `mission.win()` | Mission gewonnen. |
| `mission.fail(text?)` | Mission gescheitert; der Text erscheint als Grund. Der Screen kommt nach 3 s, damit man sieht, was passiert ist. |
| `mission.rescued` | Anzahl geretteter/abgelieferter Ziele. |
| `mission.onBoard` | Personen im Heli. |
| `mission.remaining` | Noch offene Ziele. |
| `mission.endless` | `true` im Endlosmodus. |
| `mission.message(text)` | Meldung als Funkzeile. |
| `mission.setWind(bft)` | Windstärke in Beaufort ändern. |

- Ziele aus der `.zcampaign` und das Skript gelten beide: **was zuerst eintritt, entscheidet.** Danach wirken weitere `win`/`fail` nicht mehr.
- Im Endlosmodus beendet `win()` die Mission nicht.
- In der Editor-Vorschau zeigen `win`/`fail` nur eine Meldung (✔/✖) statt des Ergebnis-Screens.

## Objekte

### Alle Objekte

| Name | Beschreibung |
|---|---|
| `type`, `name` | Objekttyp (`'wind_turbine'`, `'supply_vessel'`, …) und Name. |
| `x`, `y`, `z` | Position; `z` ist die Basis (Wasserlinie bei Schiffen). |
| `destroyed` | `true` nach `destroy()`. |
| `distanceTo(obj)` | Horizontaler Abstand zu einem anderen Objekt oder zum Heli. |
| `bearingTo(obj)` | Richtung zu einem anderen Objekt in Grad (0° = +x), z. B. für `course`. |
| `onHeliNear(abstand, aktion)` | Einmal, sobald der Heli horizontal näher als `abstand` ist. |
| `minimap.hidden` | Punkt auf der Minimap aus-/einblenden. |
| `destroy()` | Einsturz (siehe unten). Nicht bei Personen/Kisten. |

Über `type` schränkt TypeScript ein: `if (o.type === 'wind_turbine') o.setOnFire();`

### Mit Kollisionsbox

Alle Objekte außer `buoy`, `reindeer`, `sleigh`, `xmas_candy_cane`, `xmas_tree`:

| Name | Beschreibung |
|---|---|
| `onTouch(anderes, aktion)` | Einmal, sobald sich die Kollisionsboxen beider Objekte in x, y **und** z überschneiden (gedreht mit dem Objektwinkel). Ein Schiff unter einer Gondel berührt sie nicht. Zerstörte Objekte berühren nichts mehr. |

### Schiffe (`Vessel`)

`carrier`, `boat`, `pilot_boat`, `sar_boat`, `salvage_tug`, `supply_vessel`, `frigate`, `submarine`

| Name | Beschreibung |
|---|---|
| `heading` | Wohin der Bug zeigt, in Grad (0° = +x, wie der Objektwinkel im Editor). |
| `course` | Wohin sich das Schiff tatsächlich bewegt, in Grad. Folgt `heading`, bis es gesetzt wird; weicht es ab, treibt das Schiff seitlich. |
| `speed` | Fahrt in Knoten, `0` = steht. |
| `radio(text)` | Funkspruch, mit `vesselName` als Absender, falls gesetzt. |

- **Startwerte** kommen aus der `.zcampaign`: `heading` = Objektwinkel, `speed` = eingetragene Geschwindigkeit (bei statischen Schiffen 0), `course` = `heading`. Bei einer Route folgen sie laufend der Route.
- Sobald das Skript einen der drei Werte **setzt**, übernimmt es das Schiff: Die Route aus dem Editor endet, das Schiff fährt mit den aktuellen Werten weiter.

```ts
boot.heading = 45; boot.speed = 8;               // normal fahren
versorger.speed = 3;                             // treiben: Bug bleibt,
versorger.course = versorger.bearingTo(wt2);     // Bewegung Richtung Windrad
versorger.speed = 0;                             // anhalten
```

### Windrad (`WindTurbine`)

| Name | Beschreibung |
|---|---|
| `setOnFire(an = true)` | Feuer an der Gondel. Feuer bringt immer Rauch mit. |
| `setOnSmoke(an = true)` | Rauch an der Gondel. `setOnSmoke(false)` löscht auch ein Feuer. |
| `spin(an)` | Rotor drehen lassen oder anhalten. |

### Personen und Kisten (`Payload`)

| Name | Beschreibung |
|---|---|
| `state` | `'waiting'` (am Boden), `'hanging'` (an der Winde), `'onBoard'` (im Heli), `'rescued'` (abgeliefert). |
| `onBoard(aktion)` | Sobald die Person im Heli ist. |
| `onRescued(ziel => …)` | Sobald abgeliefert. `ziel` ist das Objekt, auf dem abgesetzt wurde, oder `{ type: 'pad' }`. Retten und Abliefern sind dasselbe Ereignis. |
| `radio(text)` | Funkspruch der Person. |
| `x`, `y` | Folgen dem Heli, solange die Person an Bord ist. |

Personen, die an Bord starten (`spawnOnboard`), sind ebenfalls über ihren Namen erreichbar. Im Endlosmodus nachgespawnte Ziele sind es nicht.

## Heli

`heli.x`, `heli.y`, `heli.z`, `heli.speedKmh`, `heli.onBoard`, `heli.distanceTo(obj)`, `heli.bearingTo(obj)`

## Texte

Alle Texte brauchen alle fünf Sprachen, sonst gibt es einen Kompilierfehler:

```ts
{ de: '…', en: '…', fr: '…', es: '…', pt: '…' }
```

## Einsturz (`destroy()`)

- Das Objekt fällt über ca. 3,5 s **aus sich heraus** zusammen, es gibt kein eigenes Wrack-Modell. Schiffe **platzen** dabei in Trümmerteile, die flach auf dem Wasser liegen bleiben.
- Teile fallen bevorzugt in Windrichtung (fest im Moment des Einsturzes).
- Explosion plus Gischt (Wasser) oder Staub (Land) am Fuß.
- Feuer/Rauch des Objekts wandern auf den Trümmerhaufen und brennen weiter, bis das Skript sie abschaltet.
- Personen/Kisten, die noch auf dem Objekt warten (`attachTo`), stürzen mit und verschwinden. Sie gelten weiter als nicht gerettet, die Mission ist damit nicht mehr zu gewinnen, läuft aber weiter (wie wenn der Carrier die Kartengrenze verlässt). Wer an der Winde hängt oder im Heli sitzt, ist nicht betroffen.
- Danach: keine Kollisionsbox, keine Absetzzone, keine Positionslichter. Das Objekt bleibt auf Karte und Minimap, bis das Skript es ausblendet (`minimap.hidden = true`).
- Folgen einer Berührung baut das Spiel nicht selbst ein. Was passiert, entscheidet allein das Skript.

## Beispiele

Schiff treibt auf ein Windrad zu, bei Berührung stürzen beide ein:

```ts
ikarus: async ({ object, wait, mission }) => {
    const versorger = object('versorger');
    const wt2 = object('wt2');
    versorger.speed = 3;
    versorger.course = versorger.bearingTo(wt2);
    versorger.onTouch(wt2, () => {
        versorger.destroy();
        wt2.destroy();
        mission.fail({ de: 'Kollision.', en: 'Collision.', fr: 'Collision.', es: 'Colisión.', pt: 'Colisão.' });
    });
    await wait(5);
    versorger.radio({ de: 'Mayday!', en: 'Mayday!', fr: 'Mayday !', es: '¡Mayday!', pt: 'Mayday!' });
},
```

Rentiere erst auf der Minimap zeigen, wenn der Heli in der Nähe ist:

```ts
absturz: ({ all }) => {
    for (const r of all('reindeer')) {
        r.minimap.hidden = true;
        r.onHeliNear(15, () => { r.minimap.hidden = false; });
    }
},
```

Brennendes Windrad stürzt nach zwei Minuten ein:

```ts
finale: async ({ object, wait }) => {
    await wait(120);
    object('brennend').destroy();
},
```
