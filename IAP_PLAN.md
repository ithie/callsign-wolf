# IAP-Plan: Callsign WOLF — Vollversion freischalten

## Was ist kostenlos / was kostet?

| Inhalt | Kostenlos | Vollversion |
|---|---|---|
| Tutorial | ✓ | ✓ |
| Free Flight: "Seenotrettung" (Index 1) | ✓ | ✓ |
| Free Flight: alle anderen Missionen (inkl. "Personenrettung") | — | ✓ |
| Callsign-Wolf-Kampagne | — | ✓ |
| Zephyr, X-Mas, weitere Szenarien | — | ✓ |
| Rang-Progression + Heli-Freischaltungen | — | ✓ |
| Musterzulassung Coast Hawk | ✓ | ✓ |
| Ornithopter-Wrack Easter Egg | — | ✓ |

**Preis:** 1,99 € (non-consumable IAP) — App im Store wird kostenlos.

---

## Storage

Neuer Key: `z_unlocked = '1'`  
Wird von Swift gesetzt, TypeScript liest ihn nur.

```typescript
export const isUnlocked = (): boolean => storageGet('z_unlocked') === '1';
```

Key muss in `initAppStorage([..., 'z_unlocked'])` ergänzt werden.

---

## TypeScript-Änderungen

**`session.ts` — `isCampaignUnlocked()`**  
Alle Nicht-Tutorial-, Nicht-FreeFlight-Kampagnen → `!isUnlocked()` → gesperrt.

**`session.ts` — `isMissionUnlocked()`**  
Für `FREE_FLIGHT`: `missionIndex !== 1 && !isUnlocked()` → gesperrt. (Nur "Seenotrettung" = Mission **1** ist kostenlos; Personenrettung = 0 ist gesperrt.)

**`game-flow.ts` — Orni-Wreck-Spawn**  
`_maybeSpawnOrniWreck()`: Guard `if (!isUnlocked()) return;` ganz oben.

**`campaign-select` / `mission-select` — Badge**  
Neuer Badge-Typ neben den bestehenden (Rang, Training): **"Vollversion"**  
Gleicher Stil wie bestehende Lock-Badges, anderer Text. Beim Tippen → Native IAP-Sheet via Swift-Bridge.

**Settings**  
"Käufe wiederherstellen"-Button → ruft Swift-Bridge auf.

---

## Swift-Änderungen (StoreKit 2)

**App-Start — 3 Checks:**

```swift
// 1. Aktiver IAP-Kauf vorhanden
for await result in Transaction.currentEntitlements {
    if case .verified(let tx) = result,
       tx.productID == "com.xxx.wolf.fullgame" {
        setUnlocked()
    }
}

// 2. Grandfathering — App vor Freemium-Datum gekauft
if case .verified(let appTx) = await AppTransaction.shared {
    if appTx.originalPurchaseDate < conversionDate {
        setUnlocked()
    }
}
```

**Kaufflow:**

```swift
let products = try await Product.products(for: ["com.xxx.wolf.fullgame"])
let result = try await products.first?.purchase()
// .success → setUnlocked() + JS-Reload der Kampagnenauswahl
```

**Restore:**  
`AppStore.sync()` → danach nochmal `currentEntitlements` prüfen.

**`setUnlocked()`:**  
Setzt `z_unlocked = '1'` in `__nativeStorage` (bestehende Bridge).

---

## Release-Reihenfolge (kritisch!)

**Problem:** Wenn das neue Update (mit Gate-Code) live geht, bevor der Preis auf kostenlos fällt, zahlen Nutzer 1,99 € und bekommen nur "Seenotrettung" — kein IAP zum Entsperren vorhanden.

**Lösung — alles gleichzeitig, per "Manueller Release":**

1. Neues App-Update einreichen (Gate-Code drin, Preis noch 1,99 €)
2. IAP in App Store Connect anlegen und einreichen
3. Beides von Apple genehmigen lassen
4. Beides auf **"Manueller Release"** stellen (App Store Connect → Version Details → "Manually Release")
5. Dann in einem einzigen Schritt:
   - App-Preis → kostenlos
   - App-Update live stellen
   - IAP live stellen

So gibt es keine Lücke, in der jemand Geld zahlt aber nur das freemium bekommt.

---

## Offene Punkte vor der Umsetzung

- **`conversionDate`** festlegen (Datum des Wechsels auf kostenlos) — muss hardcoded in Swift
- **Produkt-ID** festlegen (`com.[bundle-id].fullgame`)
- **Badge-Text:** "Nur in der Vollversion" (DE) / "Full Version Only" (EN)
- **IAP-Flow:** Tap auf gesperrten Inhalt → eigener Infoscreen (was ist in der Vollversion enthalten) → Kaufen-Button → nativer StoreKit-Sheet
