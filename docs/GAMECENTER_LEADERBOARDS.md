# Bestenlisten: Game Center und CloudKit

Status: Konzept (Stand 2026-10-04), noch nicht beauftragt. Bevorzugte Variante ist CloudKit ohne Namen, die beschlossenen Regeln stehen im gleichnamigen Abschnitt. Nichts davon ist implementiert. Dieses Dokument hält die Recherche und die Abwägung fest, damit sie nicht neu erarbeitet werden muss.

## Entscheidung und Gründe

Game Center und ein eigener Server scheiden aus. Als gangbarer Weg gilt CloudKit ohne Namen mit iCloud-Pflicht nur beim Einreichen. Bis zur Beauftragung bleiben Bestzeiten lokal.

- Game Center scheidet aus: Eingereichte Scores sind für Nutzer nicht löschbar, für uns nur eingeschränkt. Das widerspricht dem Anspruch, Datenschutzfunktionen vollständig umzusetzen, inklusive Löschung.
- CloudKit erfüllt die Löschbarkeit, aber nur Nutzer mit verfügbarem iCloud-Account können Zeiten einreichen. Schreiben ohne Anmeldung ist bei CloudKit nicht möglich.
- Ein eigener Server wäre die einzige Lösung ohne Login, bedeutet aber eigene Datenhaltung, Hosting, Missbrauchsschutz und volle Verantwortung. Das widerspricht "so wenig wie nötig".

Die iCloud-Pflicht gilt als akzeptabel, weil sie nur das Einreichen betrifft, die Teilnahme freiwillig ist und die Löschung vollständig möglich bleibt.

## Gewünschte Funktion

- Getrackt wird die Gesamtzeit pro abgeschlossener Kampagne, und nur wenn die Kampagne vollständig abgeschlossen wurde. Einzelmissionen werden bei Kampagnen nicht eingereicht.
- Weitere Boards waren angedacht für Musterzulassungen und Szenario-Missionen. Anzahl und Wertungsregel (ebenfalls nur Gesamtzeit?) sind offen.
- Alle Nutzer dürfen teilnehmen, Free und IAP. Free-Nutzer können nur Kampagnen abschließen, die sie spielen dürfen, eine zusätzliche Sperre ist nicht nötig.
- Eigener Menüpunkt "Bestenlisten" im Hauptmenü.
- Teilnahme ist Opt-in. Der erste Tap auf "Bestenlisten" zeigt einen Erklär-Dialog, erst danach wird irgendetwas übertragen.
- Zusätzlich ein Schalter in den Einstellungen, über den die Teilnahme jederzeit ein- und ausgeschaltet werden kann.
- Wird der Speicherstand gelöscht, wird auch die Zustimmung entfernt. Danach wird nichts mehr eingereicht, und der nächste Tap auf "Bestenlisten" zeigt wieder den Erklär-Dialog.
- Anzeige: Top 10, die eigene Zeit hervorgehoben, wenn sie in den Top 10 liegt, sonst abgesetzt darunter. Kein exakter Rang nötig.
- Namen: Andere Spieler erscheinen nur mit Zeit. Der Pilot-Name wird höchstens in der eigenen Zeile angezeigt.

Bei einer Umsetzung gelten die üblichen Projektregeln: UI-Komponenten mounten sich selbst, nutzen `.ui-screen`, die zugehörige `*.ui.ts` wird mitgepflegt, Steuerung muss für Touch und Tastatur (Mac) funktionieren, neue Session-Felder werden in Swift migriert (`migrateSession`), nicht als Fallback in TypeScript.

## Beschlossene Regeln für CloudKit ohne Namen

- Gespeichert werden pro Spieler die Bestzeit und die meisten Geretteten, jeweils mit Board-ID und pseudonymer ID. Keine Namen und kein Freitext.
- Ohne Zustimmung findet nichts statt: keine Datenabfrage beim Start, keine iCloud-Statusprüfung, kein Einreichen. Zustimmung geschieht über den Schalter in den Einstellungen oder über den Menüpunkt "Bestenlisten" (mit Erklär-Dialog).
- Mit Zustimmung wird die Liste beim App-Start geladen. Kommt nichts zurück, steht an der Stelle ein Text, dass die Daten gerade nicht geladen werden können. Kein Hinweis auf iCloud oder mögliche Ursachen.
- Der iCloud-Status (`CKContainer.accountStatus`) wird erst nach der Zustimmung geprüft, nicht beim App-Start. Er liefert nur einen Zustand, keine Mail-Adresse und keine Apple-ID.
- Ist iCloud beim Einreichen nicht verfügbar, passiert still nichts. Die Zeit bleibt lokal, ein späteres Nachreichen ist möglich. Bekannte Folge: Der Nutzer sieht die Top 10, aber seine eigene Zeit taucht nicht auf, ohne Erklärung.
- Gespeichert wird pseudonymisiert. Die pseudonyme Kennung dient nur dazu, den eigenen Eintrag wiederzufinden, zu überschreiben und zu löschen. Anderen Spielern wird sie nie angezeigt, sie sehen ausschließlich die Zeiten (und Geretteten) der anderen.
- Kennung: Die CloudKit-Nutzer-ID ist bereits undurchsichtig und wird deshalb nicht erneut gehasht. Stattdessen wird die Record-ID per HMAC-SHA256 aus Nutzer-ID, Board-ID und einem geheimen "Pfeffer" abgeleitet, der nur im Swift-Code liegt (nie in TS/JS, dort wäre er im Bundle im Klartext lesbar). So ist der eigene Eintrag nach Neuinstallation oder auf einem neuen Gerät deterministisch wiederauffindbar.
- Pfeffer-Verwaltung: Er darf nicht im Repository stehen. Vorschlag: gitignorierte Datei (z. B. `Secrets.swift` oder `.xcconfig`) plus eingechecktes Beispiel ohne Wert, bei CI als Umgebungsvariable. Er muss dauerhaft gleich bleiben und zusätzlich sicher gesichert werden (Passwortmanager), denn bei Verlust oder Wechsel finden Nutzer ihre bestehenden Einträge nicht mehr und können sie nicht löschen. Geht er je in die Git-Historie, ist eine Rotation praktisch nur mit Verwaisen der alten Einträge möglich.
- Grenze des Pfeffers: Er steckt im App-Binary und ist damit für jemanden mit Jailbreak oder Mac-Version auslesbar. Er schützt gegen beiläufiges Zuordnen, nicht gegen einen gezielten Angreifer. Die serverseitig gesetzte Ersteller-ID (siehe nächster Punkt) wird durch den Pfeffer nicht verborgen.
- Zu klären: Jeder Record der öffentlichen Datenbank trägt eine Ersteller-ID (`creatorUserRecordID`), die für jeden lesbar ist, der die Datenbank abfragt, auch wenn die App sie nicht anzeigt. Sie ist undurchsichtig und pro Container vergeben, bleibt aber eine stabile Kennung. Prüfen, ob sie genügt oder ob stattdessen eine zufällige lokale Kennung genutzt wird.
- Anzeige: Top 10, die eigene Zeit hervorgehoben, wenn sie in den Top 10 liegt, sonst abgesetzt darunter.
- Löschen: Beim Ausschalten des Schalters und beim Löschen des Speicherstands werden die eigenen Records entfernt und die Zustimmung zurückgesetzt.
- Transparenz: Hinweis im Legal-Text (LEGAL_DATENSCHUTZ, neutral formuliert) und zusätzlich im FAQ auf der Homepage. Inhalt: was gespeichert wird, dass es freiwillig ist, dass iCloud zum Einreichen nötig ist und wie man Einträge löscht.

## Inhalt der Erklärung (Opt-in-Dialog, Legal-Text, FAQ)

Die Daten sind personenbezogen, auch wenn wir keine Namen speichern: Apple kann die Kennung dem iCloud-Account zuordnen. Das Wort "anonym" wird deshalb nirgends verwendet. Die Erklärung trennt klar, was wo liegt.

- Lokal auf dem Gerät: Spielstand, Bestzeiten, meiste Gerettete, Pilot-Name und die Zustimmung zu den Bestenlisten. Das verlässt das Gerät nie ohne Zustimmung.
- Bei Apple (CloudKit), nur nach Zustimmung: pro Board die Bestzeit und die meisten Geretteten, eine technische Kennung sowie Datum der Erstellung und Änderung. Kein Name.
- Hinweis zur Zuordnung: Die technische Kennung kann nur Apple deinem iCloud-Account zuordnen. Andere Spieler sehen ausschließlich Zeiten, wir sehen weder Namen noch Accounts. Die Kennung ist technisch für Abfragen der App lesbar, wird aber nie angezeigt.
- iCloud: Zum Einreichen ist ein aktiver iCloud-Account nötig. Das steht im Legal-Text und im FAQ, nicht als Fehlermeldung im Spiel.
- Löschen: Ausschalten des Schalters oder Löschen des Speicherstands entfernt die eigenen Einträge bei Apple.

### Zweistufiger Aufbau

Der Dialog bleibt kurz und nicht bedrohlich, die vollständige Information liegt eine Ebene tiefer. Nichts wird versteckt: Die Details sind per Link "Mehr erfahren" erreichbar und stehen identisch im Legal-Text und im FAQ.

Stufe 1, Dialog, in dieser Reihenfolge:

1. Nutzen: "Vergleiche deine Zeit mit anderen Piloten."
2. Was andere sehen: "Andere sehen nur Zeiten, keine Namen."
3. Was passiert: "Deine Zeit wird mit einer technischen Kennung bei Apple gespeichert. Du kannst sie jederzeit löschen."
4. Schaltflächen: Teilnehmen, Nicht jetzt, Mehr erfahren.

Stufe 2, Details ("Mehr erfahren", Legal-Text, FAQ):

- Was lokal bleibt und was bei Apple liegt (siehe oben).
- Hinweis, dass nur Apple die Kennung dem iCloud-Account zuordnen kann.
- Dass zum Einreichen ein aktiver iCloud-Account nötig ist.
- Wie man Einträge löscht.

Wichtig für die Wirkung: nicht mit dem Risiko eröffnen und keine juristischen Sätze im Dialog. Ob der Dialog die Teilnahmequote spürbar senkt, lässt sich erst nach dem Start beurteilen.

## Variante A: Game Center

### Technik

- Native Bridge über GameKit in Swift (WKWebView-Message-Handler). TS sendet nur `submitScore(leaderboardId, centiseconds)`.
- API: Anmelden über `GKLocalPlayer.local.authenticateHandler`, Einreichen über `GKLeaderboard.submitScore(_:context:player:leaderboardIDs:completionHandler:)`, Lesen über `GKLeaderboard.loadLeaderboards(IDs:)` und `loadEntries(for:timeScope:range:)`, native Anzeige über `GKGameCenterViewController`.
- Game Center verwaltet die Liste. Wir definieren in App Store Connect nur das Leaderboard (ID, Name, Beschreibung je DE/EN, optional Bild, optional Leaderboard Set).
- Pro Kampagne ein Leaderboard, Score-Format "Elapsed Time", Sortierung "niedrig ist besser". Apple clustert nicht automatisch nach Mission oder Kampagne, jedes Board ist nur eine ID.
- Limits: 100 Leaderboards pro App, mit Leaderboard Sets bis 500. Pro Art ein Set wäre möglich (Kampagnen, Musterzulassungen, Szenarien).
- Entitlement "Game Center" aktivieren. Funktioniert auch in der Mac-Version.
- Pro Spieler zählt nur der beste Score. Ein schlechterer Wert überschreibt nichts.
- Classic Leaderboards behalten Scores dauerhaft, Recurring Leaderboards setzen sich automatisch zurück (5 Minuten bis 30 Tage).
- Score-Bereich: Jedes Leaderboard hat in App Store Connect einen Mindest- und Höchstscore. Damit lassen sich 0 und unmögliche Zeiten abfangen.
- Typisierung: `submitScore` nimmt eine Zahl. Ein String oder nil lässt sich nicht einreichen. Über die Bridge validiert Swift vor dem Aufruf (endliche Zahl im erlaubten Bereich).

### Anzeige: native UI oder eigene Liste

- Native UI: kaum Aufwand, Apple zeigt Heute, Woche, Gesamt, Freunde, Global, Rang, Alias und Zeit. Wir können nichts filtern.
- Eigene Liste per `loadEntries`: Spiel-Look, Filtern von 0 und Unplausiblem möglich, mehr Aufwand. `loadEntries` liefert pro Anfrage etwa bis zu 100 Einträge, weiteres Blättern per Range ist möglich (noch zu verifizieren). Ränge müssten nach dem Filtern selbst neu gezählt werden.
- In beiden Fällen erscheint der Game-Center-Alias, nie der Pilot-Name. Der Score trägt nur eine Zahl und einen numerischen `context`, keinen String.

### Datenschutz und Löschbarkeit

- Wir selbst erhalten keine Daten und betreiben keinen Server. Alias und Spieler-ID sind aber pseudonyme personenbezogene Daten und liegen bei Apple. Der Alias ist in globalen Bestenlisten öffentlich.
- Ohne Opt-in wird weder authentifiziert noch eingereicht.
- Es gibt keine GameKit-API, um eingereichte Scores zu löschen. Auch ein "Reset" per Null-Wert funktioniert nicht: Eine 0 ist bei "niedrig ist besser" die beste Zeit und würde Platz 1 belegen.
- Nutzer können einzelne Scores nach Recherche nicht selbst löschen. Ein Weg auf Account-Ebene über Apples Datenschutzportal (privacy.apple.com, siehe auch Apples Seite "Game Center & Privacy") ist wahrscheinlich, aber nicht sauber verifiziert, die gefundenen Quellen waren teils unzuverlässig.
- Wir können in App Store Connect Scores der Top 100 einzeln entfernen oder Spieler sperren, was ihre Scores entfernt. Wiederherstellung ist 30 Tage möglich. Für Spieler außerhalb der Top 100 gibt es keine gezielte Entfernung. Das macht den manuellen Weg zu keinem vollständigen Ersatz.
- Rechtlich offen: Nach dem EuGH-Urteil Fashion ID (2019, nach meinem Kenntnisstand nicht aufgehoben) kann, wer einen Drittdienst einbindet, für die Übermittlung mitverantwortlich sein. Ob das auf Game Center übertragbar ist, ist unklar. Eine abschließende rechtliche Bewertung braucht eine Datenschutzprüfung.
- Privacy-Label in App Store Connect müsste geprüft werden. Daten, die Game Center selbst erhebt, liegen grundsätzlich bei Apple.

### Manipulation

- Auf einem normalen iPhone mit App-Store-Build praktisch nicht möglich: kein Debugger-Attach, Verbindung zu Apple über TLS mit Pinning, Tools wie Burp helfen nicht.
- Theoretische Wege sind Jailbreak-Geräte (z. B. Frida) und die Mac-Version, bei der der Nutzer die Maschine kontrolliert. Eine Jailbreak-Erkennung ist nicht vorgesehen.
- Apple validiert Scores nicht. Gegenmaßnahmen: Score-Bereich in App Store Connect und eine Plausibilitätsprüfung in Swift (Mindestzeit pro Kampagne).

## Variante B: CloudKit ohne Namen

Konzept: Zeiten werden in der öffentlichen CloudKit-Datenbank gespeichert, die Liste wird im Spiel selbst gerendert. Ein Vorschlag aus einer externen Diskussion sah zusätzlich einen SHA-256-Hash der Game-Center-`teamPlayerID` als Spieler-Kennung vor. Das ist unnötig umständlich: CloudKit kennt den iCloud-Nutzer bereits, Game Center und GameKit würden komplett entfallen. Ein Hash ohne Salt bliebe außerdem ein stabiler Pseudonym-Wert.

### Vorteile

- Volle Löschbarkeit: Beim Opt-out oder Löschen des Speicherstands werden die eigenen Records per Code gelöscht (Security Role "Creator" darf eigene Records ändern und löschen, noch zu verifizieren).
- Kein Server nötig, das Freikontingent reicht für die kleine Datenmenge (noch zu verifizieren).
- Eigene Liste im Spiel-Look.
- Wenn nur Zeit, Board-ID und pseudonyme ID gespeichert werden, gibt es keinen Freitext. Damit entfällt die Pflicht zur Moderation von Nutzerinhalten (App-Review-Richtlinie 1.2). Ein freier Pilot-Name für andere Spieler würde sie auslösen: Filter, Melden, Sperren, Kontakt.
- Anzeige Top 10 plus eigene Zeile braucht keine Zählung: Top 10 abfragen, eigenen Record über eine feste Record-ID (Spieler und Board) laden.

### Nachteile und Pflichten

- Schreiben braucht einen verfügbaren iCloud-Account. Ohne Anmeldung kann man die Top 10 lesen, aber keine Zeit einreichen. Die Rolle "World" hat nur Leserechte, Schreibrechte lassen sich ihr nicht geben. `CKContainer.accountStatus` verrät vorab, ob iCloud verfügbar ist. Gerade datenschutzbewusste Nutzer schalten iCloud häufiger ab.
- Wir sind selbst Verantwortliche für die Daten: Datenschutzerklärung, Privacy-Label ("mit dem Nutzer verknüpft"), Löschwünsche. Eine mögliche Auftragsverarbeitung durch Apple ist zu klären.
- Kein automatisches Ablaufdatum. Wer die App ohne vorheriges Löschen deinstalliert, hinterlässt den Eintrag. Ohne eigenen Server gibt es keine automatische Bereinigung.
- Security Roles müssen sorgfältig gesetzt werden: nur der Ersteller darf seinen Eintrag ändern oder löschen, pro Spieler und Board genau ein Record (feste Record-ID, nur überschreiben, wenn besser).
- Plausibilitätsprüfung für Zeiten müssen wir selbst bauen. Den Score-Bereich von Game Center gibt es nicht.
- Deutlich höherer Aufwand als Game Center: Schema, Rollen, Swift-Bridge, eigene Liste, Offline-Queue, Hinweis bei fehlendem iCloud.

## Variante C: Eigener Server

Einzige Lösung ohne Login (anonyme Geräte-ID, Löschen über diese ID). Dafür Hosting, Missbrauchsschutz, Wartung und volle Verantwortung. Nicht empfohlen.

Hinweis: CloudKit kann auch hinter einem eigenen Server als reiner Speicher dienen. Ein Server-to-Server-Key erlaubt Schreiben in die öffentliche Datenbank ohne iCloud-Nutzer. Der Key darf aber nie in die App, die Anfragen müssten über einen eigenen Endpunkt laufen. Damit gelten wieder Hosting und Missbrauchsschutz.

## Vergleich

| Kriterium | Game Center | CloudKit ohne Namen | Eigener Server |
| --- | --- | --- | --- |
| Aufwand | niedrig | hoch | sehr hoch |
| Nutzer kann Eintrag löschen | nein | ja (über die App) | ja (über die App) |
| Login nötig | Game Center (meist vorhanden) | iCloud (nicht immer) | keiner |
| Pilot-Name möglich | nein | ja, aber Moderationspflicht | ja, aber Moderationspflicht |
| Eigene Liste im Spiel-Look | optional | ja | ja |
| Verantwortlich für Daten | überwiegend Apple | wir | wir |
| Passt zu "so wenig wie nötig" | ja | mittel | nein |

## Weitere Optionen, die geprüft wurden

- Recurring Leaderboards bei Game Center: Einträge werden nach höchstens 30 Tagen zurückgesetzt. Das ergäbe Monatslisten statt "Bestzeit aller Zeiten". Verhalten der Vorperioden ist ungeprüft.
- Löschwünsche manuell in App Store Connect: nur Top 100, siehe oben.

## Offene Punkte für eine spätere Wiederaufnahme

- "Meiste gerettete": pro Board oder insgesamt, und als eigene Liste neben der Bestzeit oder zusammen in einem Eintrag? Plausibilitätsprüfung dafür festlegen.
- Wird für Kampagnen aktuell eine Gesamtzeit gespeichert, und wo?
- Anzahl und Wertungsregel für Musterzulassung und Szenario-Missionen.
- Endless-Modus: eigenes Board oder nicht?
- Mindestzeiten pro Kampagne für die Plausibilitätsprüfung.
- CloudKit-Details gegen die Apple-Doku verifizieren: Ersteller darf löschen, Freikontingent, Abfrage von Top 10 plus eigenem Record, Score-Typen.
- Wording des Erklär-Dialogs (DE und EN) und der Datenschutzerklärung. LEGAL_DATENSCHUTZ bleibt neutral formuliert ("auf deinem Gerät", nicht "localStorage").
- Release-Zeitpunkt: mit welcher Version soll das erscheinen?

## Quellen

- Apple: Game Center properties, https://developer.apple.com/help/app-store-connect/reference/game-center/game-center-properties
- Apple: Manage scores and players, https://www.developer.apple.com/help/app-store-connect/configure-game-center/manage-scores-and-players
- Apple: Manage leaderboard sets, https://www.developer.apple.com/help/app-store-connect/configure-game-center/manage-leaderboard-sets
- Apple: Game Center & Privacy, https://www.apple.com/legal/privacy/data/en/game-center/
- Apple Forums: CloudKit Permissions, https://developer.apple.com/forums/thread/664845
- Apple Forums: Unable to create record in public CloudKit database for missing/not authenticated iCloud user, https://developer.apple.com/forums/thread/816523
