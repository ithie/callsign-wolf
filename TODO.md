# Callsign WOLF — Release TODO (v1.5 Freemium)

## 1. App Store Connect — IAP anlegen

- [ ] In App Store Connect → Deine App → In-App Purchases → "+" → **Non-Consumable**
- [ ] Produkt-ID: `i.thie.softworks.fullgame`
- [ ] Name (DE): "Vollversion", (EN): "Full Version"
- [ ] Preis: **1,99 €** (Tier 2)
- [ ] Lokalisierungen für DE, EN, FR, ES, PT-BR, PT-PT ausfüllen
- [ ] Screenshot für den Review hochladen (Paywall-Screen reicht)
- [ ] IAP zur Review einreichen — **aber noch NICHT aktivieren**

---

## 2. Xcode — Lokales Testen mit StoreKit

### StoreKit Configuration

~~Datei anlegen + Produkt eintragen~~ ✓ (`Configuration.storekit` ist fertig konfiguriert und im Projekt)

- [ ] Schema verknüpfen: **Edit Scheme → Run → Options → StoreKit Configuration** → `Configuration.storekit` auswählen

### Was du im Simulator testen kannst

- [ ] Paywall-Screen öffnet sich beim Tippen auf gesperrte Kampagne
- [ ] Preis wird korrekt angezeigt ("1,99 €")
- [ ] "FREISCHALTEN" → StoreKit-Test-Sheet erscheint → "Buy" → Screen kehrt zurück, Banner "VOLLVERSION AKTIV!"
- [ ] Nach Kauf: vorher gesperrte Kampagnen sind zugänglich, Rang-System aktiv
- [ ] "KÄUFE WIEDERHERSTELLEN" → findet den simulierten Kauf
- [ ] App neu starten → `z_unlocked` bleibt erhalten (UserDefaults)

### Grandfathering testen

Im `.storekit`-Editor: **App Store Sync → Original Application Version** auf `"1.4"` setzen.
→ App starten → Vollversion muss automatisch aktiv sein, ohne IAP-Dialog.

Dann `"1.5"` setzen → Vollversion muss gesperrt bleiben.

### Sandbox auf echtem Gerät

- App Store Connect → Benutzer & Zugriff → Sandbox-Tester → neuen Sandbox-Account anlegen
- Auf iPhone: **Einstellungen → App Store → Sandbox-Account** eintragen
- App über Xcode installieren → Kaufflow läuft gegen Sandbox-Server (keine echten Kosten)

---

## 3. App Store Connect — Release koordinieren

**Reihenfolge ist kritisch** — IAP muss live sein bevor die App kostenlos wird, sonst ist die Paywall nicht kaufbar.

- [ ] App-Update einreichen (v1.5 mit Gate-Code)
- [ ] IAP einreichen (s. Schritt 1)
- [ ] Beide von Apple genehmigen lassen (läuft getrennt)
- [ ] Sobald beide approved:
    1. **IAP veröffentlichen**
    2. ~10 Minuten warten
    3. **App-Update veröffentlichen** + App-Preis auf **Kostenlos** stellen

---

## 4. Review Notes für Apple

Beim App-Update-Submit unter **"Notes for reviewer"** eintragen:

> This update introduces a freemium model. The app is now free to download.
> A one-time non-consumable in-app purchase ("Full Version", product ID: `i.thie.softworks.fullgame`, price: €1.99) unlocks all campaigns, scenarios, and rank progression.
>
> **Free tier:** Tutorial + one Free Flight scenario ("Seenotrettung").
> **Full version:** All campaigns, all Free Flight scenarios, rank progression, full helicopter roster.
>
> Users who previously purchased the app (originalApplicationVersion < "1.5") are automatically grandfathered and receive the full version without an additional purchase.
>
> **Sandbox test account:**
> Login: [sandbox-email@example.com]
> Password: [sandbox-password]
>
> To test the purchase flow: start the app, navigate to "Kampagne wählen", tap any campaign card with the purple "VOLLVERSION" stamp.

_(Sandbox-Account-Daten vorher in App Store Connect anlegen und hier eintragen.)_
