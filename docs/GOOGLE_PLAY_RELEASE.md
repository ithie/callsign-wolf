# Google Play: Veröffentlichung

Status: Planung (Stand 2026-10-16). Beschreibt nur den Weg in den Play Store und die lokale Werkzeugkette, nicht die Portierung der Swift-Shell nach Kotlin.

## Entwicklerkonto

- Konto als Organisation in der Google Play Console anlegen, einmalige Gebühr 25 USD.
- Die D-U-N-S-Nummer aus dem Apple-Developer-Account wird wiederverwendet, neu beantragen muss man nichts. Firmenname und Adresse in der Play Console müssen exakt dem D-U-N-S-Eintrag entsprechen, sonst schlägt die Verifizierung fehl.
- Für Organisationskonten gilt die Pflicht nicht, vor dem ersten Release einen geschlossenen Test mit 12 Testern über 14 Tage zu fahren. Die gilt nur für private Konten.
- Händlerstatus nach EU-DSA angeben, wie bei Apple. Adresse, Telefon und E-Mail werden im Store öffentlich angezeigt.
- Payments-Profil (Händlerkonto) einrichten: Bankverbindung, Steuerdaten. Ohne das lässt sich der IAP nicht anbieten. Die Umsatzsteuer in der EU führt Google selbst ab.

## Lokale Werkzeuge

- **Android Studio** (`brew install --cask android-studio`). Enthält das JDK (JetBrains Runtime), Gradle, den Kotlin-Compiler und den SDK Manager. Ein separates JDK oder Kotlin braucht man nicht.
- **Über den SDK Manager**:
  - Android SDK Platform für das geforderte Target-API-Level (aktuell API 36, vor dem Upload in der Console prüfen)
  - Android SDK Build-Tools
  - Android SDK Platform-Tools (`adb`)
  - Android Emulator samt System-Image (ARM64, läuft nativ auf Apple Silicon)
- **Ein echtes Android-Gerät** mit aktiviertem USB-Debugging. Der Emulator zeigt keine realistische WebView- und Audio-Performance.
- **Chrome** zum Debuggen der WebView über `chrome://inspect`. Entspricht dem Safari-Web-Inspector unter iOS.
- **keytool** (im JDK von Android Studio enthalten) zum Erzeugen des Upload-Keystores.
- **bundletool** (optional, `brew install bundletool`), um ein `.aab` lokal in APKs zu zerlegen und auf dem Gerät zu installieren, wie Google es ausliefert.
- **Upload-Automatisierung** (optional): fastlane `supply` oder Gradle Play Publisher. Für den Anfang reicht der manuelle Upload in der Console.
- Node und Vite sind schon vorhanden. Ein `build:android`-Skript analog zu `build:ios` kopiert das Bundle dann in die Assets des Android-Projekts.

## Signierung und Build

- Hochgeladen wird ein App Bundle (`.aab`), keine APK.
- Play App Signing: Den eigentlichen Signaturschlüssel verwaltet Google. Lokal gibt es nur den Upload-Key, der sicher aufbewahrt wird (Passwortmanager plus Backup). Geht er verloren, kann der Google-Support ihn zurücksetzen.
- Package Name festlegen, z. B. passend zur iOS-Bundle-ID. Er lässt sich später nicht mehr ändern.
- Jede Version braucht einen höheren `versionCode` (Ganzzahl). `versionName` ist der sichtbare Versionsstring.

## Store-Eintrag

- App-Icon 512×512 PNG
- Feature-Grafik 1024×500. Gibt es bei Apple nicht, muss neu erstellt werden.
- Screenshots für Smartphone, optional für 7"- und 10"-Tablets
- Kurzbeschreibung (max. 80 Zeichen) und vollständige Beschreibung (max. 4000 Zeichen) pro Sprache
- URL zur Datenschutzerklärung (Pflicht)

## Pflichtangaben unter „App-Inhalte“

- **Datensicherheit** (Data Safety): entspricht Apples Privacy Labels. Muss zu dem passen, was die App tatsächlich tut.
- **Altersfreigabe**: IARC-Fragebogen. USK, PEGI usw. werden daraus automatisch vergeben.
- **Zielgruppe und Inhalte**: Kinder werden einbezogen, die Families Policy gilt damit (siehe unten).
- **Werbung**: nein
- **App-Zugriff**: Prüfung ohne Login möglich
- Kurze Erklärungen zu News-, Regierungs- und Gesundheits-Apps: jeweils nein

## Families Policy

Werden Kinder in die Zielgruppe aufgenommen, prüft Google strenger. Für Callsign WOLF passt das voraussichtlich ohne Änderungen:

- Keine Werbe- oder Analyse-SDKs, die nicht für Families zertifiziert sind. Die App enthält keine.
- Keine Erhebung personenbezogener Daten von Kindern. Der Spielstand liegt nur auf dem Gerät.
- IAP ist erlaubt, darf aber nicht irreführend platziert sein. Der Kauf muss klar als Kauf erkennbar sein.
- Inhalte und Store-Grafiken müssen altersgerecht sein.
- Optional kann die App für das Programm „Lehrerempfehlung“ (Teacher Approved) in Frage kommen.

## In-App-Kauf

- Unter Monetarisierung ein einmaliges Produkt anlegen, gleiche Product-ID wie unter iOS (`i.thie.softworks.wolf.fullgame`), Preis 1,99 €.
- Grandfathering wie unter iOS (< v1.5) entfällt, auf Android gibt es keine Bestandsnutzer.
- Käufe müssen innerhalb von 3 Tagen bestätigt werden (acknowledge), sonst erstattet Google sie automatisch.
- Zum Testen Lizenztester in der Play Console eintragen. Deren Käufe werden nicht belastet.

## Test-Tracks

- **Intern**: bis zu 100 Tester, sofort verfügbar, keine Prüfung. Entspricht TestFlight intern.
- **Geschlossen**: eingeladene Tester oder Google-Gruppen
- **Offen**: öffentliche Beta, Tester tragen sich selbst ein
- **Production**: gestaffelter Rollout möglich (z. B. 10 %, 50 %, 100 %)

## Prüfung

Das erste Review dauert oft mehrere Tage, Updates meist Stunden bis 1–2 Tage. Google prüft stärker automatisiert als Apple, meldet Policy-Verstöße dafür auch nachträglich.

## Reihenfolge

1. Organisationskonto mit der vorhandenen D-U-N-S-Nummer anlegen und verifizieren lassen.
2. Payments-Profil und Händlerstatus einrichten.
3. Store-Eintrag, App-Inhalte und IAP-Produkt anlegen. Geht parallel zur Portierung, ein Build ist dafür noch nicht nötig. Das IAP-Produkt lässt sich erst nach dem ersten Upload eines Builds anlegen, der die Billing-Library enthält.
4. Android Studio und SDK einrichten, Upload-Keystore erzeugen.
5. Erster Build in den internen Test, IAP mit Lizenztestern prüfen.
6. Production mit gestaffeltem Rollout.
