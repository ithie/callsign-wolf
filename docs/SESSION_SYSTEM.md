# Session System

SAR: Callsign WOLF saves player progress locally on the device via `@capacitor/preferences` (iOS: `UserDefaults`). This document describes the data model, save code format, and privacy aspects.

---

## Overview

| Component             | File                  | Responsibility                    |
| --------------------- | --------------------- | --------------------------------- |
| Data model & encoding | `src/game/session.ts` | Load, save, rank, save code       |
| UI integration        | `src/game/game.ts`    | Settings screen, rank overlay     |
| Strings               | `src/game/i18n.ts`    | All player-facing text            |

---

## Data Model (`PlayerSession`)

```typescript
interface PlayerSession {
    playerName: string;                     // callsign, max 5 chars A–Z
    highestUnlockedCampaignIndex: number;   // highest regular campaign reached (for cross-device import)
    campaignProgress: Record<string, CampaignProgress>;
    rankOverride: number;                   // rank index preserved via save code import
}

interface CampaignProgress {
    completed: boolean;
    missions: MissionProgress[];
}

interface MissionProgress {
    completed: boolean;
    bestTimeMs: number | null;
}
```

Stored under the key `z_session` via Capacitor Preferences. Always written on change — no consent gate.

### Stored data (as declared in the privacy notice)

`▸ Rufzeichen  ▸ Dienstgrad  ▸ Kampagnenfortschritt  ▸ Spracheinstellung  ▸ Steuerungseinstellung`

Spracheinstellung and Steuerungseinstellung are stored under separate keys (`z_lang`, `z_ctrl_mode`).

---

## Ranks

Rank is derived from completed non-tutorial missions.

| Rank         | Insignia | Min. missions (excl. Tutorial) |
| ------------ | -------- | ------------------------------ |
| Leutnant     | ★        | 0                              |
| Oberleutnant | ★ ★      | 10                             |
| Hauptmann    | ★ ★ ★    | 30                             |
| Major        | ◆        | 60                             |

- Tutorial missions do **not** count toward rank progression. Free Flight missions do.
- `rankOverride` ensures the rank is never lower than what was imported via save code.
- A promotion overlay is shown whenever the rank increases mid-session.

---

## Campaign Unlocking

- Tutorial and Free Flight are always available.
- Regular campaigns unlock sequentially: completing campaign N unlocks campaign N+1.
- `highestUnlockedCampaignIndex` stores the furthest unlocked campaign index, allowing a new device to restore the correct unlock state from a save code alone.

---

## Save Code

Player progress can be exported as a compact 9-character code and imported on another device.

### Format

```text
XXXXX-XXXX
```

5 characters – hyphen – 4 characters. Displayed in uppercase, input is case-insensitive.

### Encoding (45 bits → 9 × Base32 characters)

| Bits  | Content                    | Range / Notes                                                |
| ----- | -------------------------- | ------------------------------------------------------------ |
| 0-1   | Rank index                 | 0-3                                                          |
| 2-4   | Highest unlocked campaign  | 0-7 (campaign array index)                                   |
| 5-7   | Active campaign            | 0-7 - derived from `campaignProgress` (highest with progress)|
| 8-11  | Next mission               | 0-15 (completed missions in active campaign)                 |
| 12-36 | Callsign (5x5 bits)        | A-Z = 0-25, null terminator = 26                             |
| 37-44 | Checksum                   | 8-bit XOR-fold of bits 0-36                                  |

**Alphabet:** Standard Base32 (RFC 4648): `ABCDEFGHIJKLMNOPQRSTUVWXYZ234567`

Each character encodes 5 bits. 45 bits ÷ 5 = exactly 9 characters, no padding required.

**Checksum:** Each data bit `i` (0–36) XORs into accumulator position `i % 8`. Codes without a valid checksum are rejected.

### On Import

- Codes with invalid checksum, wrong length, or invalid characters are rejected.
- Valid codes set: `playerName`, `highestUnlockedCampaignIndex`, `rankOverride`, and a reconstructed `campaignProgress` entry for the encoded campaign (N missions marked complete, no best times).
- The imported state is saved immediately.

---

## API (`session.ts`)

```typescript
loadSession(): PlayerSession
// Loads session from storage; returns defaults if nothing is stored.
// Strips legacy fields from old saves automatically.

saveSession(s: PlayerSession): void
// Persists session unconditionally.

getRank(s: PlayerSession, nonTutorialMissions?: number): Rank
// Returns the current rank. Pass non-tutorial mission count for correct calculation.

isCampaignUnlocked(s: PlayerSession, campaigns: ReadonlyArray<{type: string}>, index: number): boolean
// Returns whether the campaign at the given index is accessible.

encodeSession(s: PlayerSession, nonTutorialMissions: number): string
// Generates the 9-character save code (format: XXXXX-XXXX).

decodeSession(input: string): Partial<PlayerSession> | null
// Decodes a save code. Returns null for invalid or old-format codes.
```
