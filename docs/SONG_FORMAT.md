# Song Format

Songs are stored as `.zsong` files in `src/game/music/`. They are loaded by the game at build time via the Vite `zsong` plugin and can be authored in the ZSynth Tracker.

## File Format

`.zsong` is a compact, line-oriented text format. One song per file.

```zsong
bpm 110

[kick]    vol=80
0 4 8 12 16 20 24 28 32 36 40 44 48 52 56 60

[snare]   vol=20
4 12 20 28 36 44 52 60

[hat]     vol=63
0 2 3 6 8 10 11 14 16 18 19 22 24 26 27 30

[synth1]  vol=82  wave=sawtooth  filter=600  inst=custom
0:A1 2:A1 4:C2 6:A1 8:F2 10:F2 12:G2 14:E2

[synth2]  vol=100  wave=sawtooth  filter=2500  inst=lead_saw
0:A1 2:A1 6:A1 8:F2 10:F2 16:A1

[synth3]  vol=80  wave=square  filter=2000  inst=lead_square
```

**Rules:**

- First line: `bpm <number>`
- Each track starts with `[trackId]  key=val  key=val  …`
- The line immediately after is the step data (omit the line if the track has no active steps)
- Drum step data: space-separated step indices (0–63)
- Synth step data: space-separated `step:note` pairs
- Blank lines and `#`-comment lines are ignored
- Tracks with neither config nor steps can be omitted entirely

**Track IDs:** `kick`, `snare`, `hat`, `clap`, `synth1`, `synth2`, `synth3`, `synth4`

**Note range:** `B4` down to `A1` (chromatic, 40 pitches)

---

## Track Config Fields

### Drum track

| Field | Range | Description      |
| ----- | ----- | ---------------- |
| `vol` | 0–100 | Volume (percent) |

### Synth track

| Field     | Description                                            |
| --------- | ------------------------------------------------------ |
| `vol`     | Volume 0–100                                           |
| `wave`    | `sawtooth` · `square` · `sine` · `triangle`            |
| `filter`  | Lowpass cutoff frequency in Hz                         |
| `inst`    | Instrument preset key, or `custom` for manual settings |
| `attack`  | Envelope attack in seconds (0.001–0.3)                 |
| `release` | Envelope release in seconds (0.05–1.5)                 |
| `detune`  | Detune in cents (0–25), adds a detuned second voice    |

---

## Instrument Presets

| Key           | Label       | Wave     | Filter  |
| ------------- | ----------- | -------- | ------- |
| `lead_square` | LEAD Square | square   | 2500 Hz |
| `lead_saw`    | LEAD Saw    | sawtooth | 3000 Hz |
| `supersaw`    | SUPERSAW    | sawtooth | 4000 Hz |
| `bass_deep`   | BASS Deep   | sine     | 400 Hz  |
| `bass_gritty` | BASS Gritty | sawtooth | 600 Hz  |
| `bass_wobble` | BASS Wobble | sawtooth | 500 Hz  |
| `pluck`       | PLUCK       | square   | 1200 Hz |
| `pad_warm`    | PAD Warm    | triangle | 1800 Hz |
| `pad_cold`    | PAD Cold    | square   | 1500 Hz |
| `arp_bright`  | ARP Bright  | square   | 3500 Hz |
| `organ`       | ORGAN       | sine     | 5000 Hz |

Selecting a preset overwrites `wave`, `filter`, `attack`, `release`, and `detune`. Setting any of those manually afterwards switches the instrument dropdown to `"custom"`.

---

## Registering a Song in the Game

Songs are statically imported in `src/game/main.ts`. After saving a new song via the Tracker, add an import and register it in the `songList`:

```typescript
import MySong from './music/mysong.zsong';

const songList: Record<string, SongData> = {
    maintheme: SoundMaintheme,
    clike: SoundClike,
    final: SoundFinal,
    mysong: MySong, // ← add here
};
```

The key you use here is the theme name passed to `soundHandler.play('mysong')`. By convention the key matches the filename stem.

> **VS Code Campaign Editor** populates its song dropdowns by scanning `src/game/music/` for `.zsong` files. Any new file placed there appears immediately — no restart required. However, the game itself still requires the static import and `songList` entry above to actually play the song at runtime.
