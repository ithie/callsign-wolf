import AVFoundation
import WebKit

// MARK: - Internal types

private struct ZNote {
    let trackId: String
    let note: String
}

private struct TrackConfig {
    var vol: Float   = 80
    var wave: String = "square"
    var filter: Float = 2000
    var attack: Float = 0.02
    var release: Float = 0.3
    var detune: Float = 0
}

private struct ParsedSong {
    let bpm: Double
    let stepMap: [Int: [ZNote]]
    let configs: [String: TrackConfig]
}

// MARK: - ZsynthPlayer

final class ZsynthPlayer: NSObject {
    static let shared = ZsynthPlayer()

    let engine  = AVAudioEngine()
    private let mixer   = AVAudioMixerNode()
    private var voices: [AVAudioPlayerNode] = []
    private var voiceIdx = 0

    private var songs: [String: ParsedSong] = [:]

    private let q = DispatchQueue(label: "zsynth", qos: .userInteractive)
    private var isPlaying    = false
    private var currentStep  = 0
    private var nextStepTick: UInt64 = 0
    private var currentSong: ParsedSong? = nil
    private var timer: DispatchSourceTimer? = nil
    private var bufCache: [String: AVAudioPCMBuffer] = [:]

    private var _sr: Double = 44100

    // Mach timebase
    private let _tbN: UInt64
    private let _tbD: UInt64

    private static let VOICES   = 16
    private static let AHEAD_S  = 0.10   // 100 ms lookahead
    private static let TICK_MS  = 25

    override private init() {
        var tb = mach_timebase_info_data_t()
        mach_timebase_info(&tb)
        _tbN = UInt64(tb.numer)
        _tbD = UInt64(tb.denom)
        super.init()
        _setup()
        NotificationCenter.default.addObserver(
            self, selector: #selector(_interrupted(_:)),
            name: AVAudioSession.interruptionNotification, object: nil)
    }

    private func _s2t(_ s: Double) -> UInt64 {
        UInt64(s * 1_000_000_000) * _tbD / _tbN
    }

    // MARK: - Engine setup

    private func _setup() {
        _sr = AVAudioSession.sharedInstance().sampleRate
        if _sr <= 0 { _sr = 44100 }

        let fmt = AVAudioFormat(standardFormatWithSampleRate: _sr, channels: 2)!
        engine.attach(mixer)
        engine.connect(mixer, to: engine.mainMixerNode, format: fmt)

        for _ in 0..<ZsynthPlayer.VOICES {
            let v = AVAudioPlayerNode()
            engine.attach(v)
            engine.connect(v, to: mixer, format: fmt)
            voices.append(v)
        }
        do {
            try engine.start()
            voices.forEach { $0.play() }
        } catch {
            print("[ZsynthPlayer] engine start failed: \(error)")
        }
    }

    @objc private func _interrupted(_ n: Notification) {
        guard let ui = n.userInfo,
              let raw = ui[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
        if type == .ended {
            try? engine.start()
            voices.forEach { if !$0.isPlaying { $0.play() } }
        }
    }

    func resumeEngine() {
        if !engine.isRunning {
            try? engine.start()
            voices.forEach { if !$0.isPlaying { $0.play() } }
        }
    }

    // MARK: - Public API

    func preload(songs: [String: String]) {
        for (k, text) in songs {
            if let p = _parse(text) { self.songs[k] = p }
        }
    }

    private static let volumePresets: [String: Float] = [
        "menu": 0.65,
        "game": 0.35,
    ]

    func play(key: String, context: String) {
        let volume = Self.volumePresets[context] ?? 0.65
        guard let song = songs[key] else { return }
        q.async { [weak self] in
            guard let self else { return }
            self._stop()
            Thread.sleep(forTimeInterval: 0.05)
            self._start(song, volume: volume)
        }
    }

    func stop() {
        q.async { [weak self] in self?._stop() }
    }

    // MARK: - Internal playback

    private func _stop() {
        isPlaying = false
        timer?.cancel(); timer = nil
        let v = mixer.outputVolume
        for s in 1...8 {
            let delay = Double(s) * 0.012
            let target = v * (1 - Float(s) / 8)
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                self?.mixer.outputVolume = max(0, target)
            }
        }
    }

    private func _start(_ song: ParsedSong, volume: Float) {
        bufCache.removeAll()
        currentSong  = song
        currentStep  = 0
        isPlaying    = true
        nextStepTick = mach_absolute_time() + _s2t(0.05)

        DispatchQueue.main.async { [weak self] in self?.mixer.outputVolume = 0 }
        for s in 1...7 {
            let delay = Double(s) * 0.015
            let v = volume * Float(s) / 7
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                self?.mixer.outputVolume = v
            }
        }

        let t = DispatchSource.makeTimerSource(queue: q)
        t.schedule(deadline: .now(), repeating: .milliseconds(ZsynthPlayer.TICK_MS))
        t.setEventHandler { [weak self] in self?._tick() }
        t.resume()
        timer = t
    }

    private func _tick() {
        guard isPlaying, let song = currentSong else { return }
        let aheadTick = _s2t(ZsynthPlayer.AHEAD_S)
        let stepTick  = _s2t(60.0 / song.bpm / 4.0)
        let now       = mach_absolute_time()

        while nextStepTick < now + aheadTick {
            let step     = currentStep % 64
            let noteTime = AVAudioTime(hostTime: nextStepTick)
            song.stepMap[step]?.forEach { _schedule($0, cfg: song.configs[$0.trackId], at: noteTime) }
            currentStep  += 1
            nextStepTick += stepTick
        }
    }

    private let _drumIds: Set<String> = ["kick", "snare", "hat", "clap"]

    private func _schedule(_ note: ZNote, cfg: TrackConfig?, at time: AVAudioTime) {
        let key = "\(note.trackId)-\(note.note)"
        let buf: AVAudioPCMBuffer
        if let cached = bufCache[key] {
            buf = cached
        } else {
            let c = cfg ?? TrackConfig()
            guard let b = _drumIds.contains(note.trackId)
                ? _drum(type: note.note, vol: c.vol / 100)
                : _synth(note: note.note, cfg: c)
            else { return }
            bufCache[key] = b
            buf = b
        }
        let v = voices[voiceIdx % ZsynthPlayer.VOICES]
        voiceIdx += 1
        v.scheduleBuffer(buf, at: time, options: [])
    }

    // MARK: - DSP helpers

    private func _buf(_ dur: Double) -> (AVAudioPCMBuffer, UnsafeMutablePointer<Float>, UnsafeMutablePointer<Float>, Int)? {
        let frames = AVAudioFrameCount(_sr * dur)
        let fmt = AVAudioFormat(standardFormatWithSampleRate: _sr, channels: 2)!
        guard let b = AVAudioPCMBuffer(pcmFormat: fmt, frameCapacity: frames),
              let ch = b.floatChannelData else { return nil }
        b.frameLength = frames
        return (b, ch[0], ch[1], Int(frames))
    }

    // MARK: Drums

    private func _drum(type: String, vol: Float) -> AVAudioPCMBuffer? {
        switch type {
        case "KICK":   return _kick(vol: vol)
        case "HI-HAT": return _hihat(vol: vol)
        case "CLAP":   return _clap(vol: vol)
        default:       return _snare(vol: vol)
        }
    }

    private func _kick(vol: Float) -> AVAudioPCMBuffer? {
        guard let (buf, l, r, n) = _buf(0.2) else { return nil }
        var ph = 0.0
        for i in 0..<n {
            let t  = Double(i) / _sr
            let f  = 150.0 * pow(0.01 / 150.0, t / 0.2)
            ph    += 2 * .pi * f / _sr
            let v  = Float(sin(ph) * exp(-t / 0.08)) * vol * 0.5
            l[i] = v; r[i] = v
        }
        return buf
    }

    private func _hihat(vol: Float) -> AVAudioPCMBuffer? {
        guard let (buf, l, r, n) = _buf(0.05) else { return nil }
        var ph = 0.0
        for i in 0..<n {
            let t = Double(i) / _sr
            ph   += 2 * .pi * 300.0 / _sr
            let p = (ph / .pi).truncatingRemainder(dividingBy: 2)
            let v = Float(2 * abs(p - 1) - 1) * Float(exp(-t / 0.015)) * vol * 0.35
            l[i] = v; r[i] = v
        }
        return buf
    }

    private func _snare(vol: Float) -> AVAudioPCMBuffer? {
        guard let (buf, l, r, n) = _buf(0.2) else { return nil }
        var ph = 0.0
        for i in 0..<n {
            let t = Double(i) / _sr
            ph   += 2 * .pi * 120.0 / _sr
            let p = (ph / .pi).truncatingRemainder(dividingBy: 2)
            let v = Float(2 * abs(p - 1) - 1) * Float(exp(-t / 0.05)) * vol * 0.5
            l[i] = v; r[i] = v
        }
        return buf
    }

    private func _clap(vol: Float) -> AVAudioPCMBuffer? {
        guard let (buf, l, r, n) = _buf(0.05) else { return nil }
        var lp = 0.0
        let α  = min(1.0, 2 * .pi * 3500.0 / _sr)
        for i in 0..<n {
            let t = Double(i) / _sr
            lp   += α * (Double.random(in: -1...1) - lp)
            let v = Float(lp * exp(-t / 0.02)) * vol * 0.9
            l[i] = v; r[i] = v
        }
        return buf
    }

    // MARK: Synth

    private let _freqs: [String: Double] = [
        "B4": 493.88, "Bb4": 466.16, "A4": 440.0,  "Ab4": 415.3,
        "G4": 392.0,  "Gb4": 369.99, "F4": 349.23, "E4":  329.63,
        "Eb4": 311.13,"D4":  293.66, "Db4": 277.18, "C4": 261.63,
        "B3": 246.94, "Bb3": 233.08, "A3": 220.0,  "Ab3": 207.65,
        "G3": 196.0,  "Gb3": 185.0,  "F3": 174.61, "E3":  164.81,
        "Eb3": 155.56,"D3":  146.83, "Db3": 138.59, "C3": 130.81,
        "B2": 123.47, "Bb2": 116.54, "A2": 110.0,  "Ab2": 103.83,
        "G2": 98.0,   "Gb2": 92.5,   "F2": 87.31,  "E2":  82.41,
        "Eb2": 77.78, "D2":  73.42,  "Db2": 69.3,   "C2":  65.41,
        "B1": 61.74,  "Bb1": 58.27,  "A1": 55.0,   "Ab1":  51.91,
        "G1": 49.0,   "Gb1": 46.25,  "F1": 43.65,  "E1":   41.2,
        "Eb1": 38.89, "D1":  36.71,  "Db1": 34.65,  "C1":  32.7,
    ]

    private func _synth(note: String, cfg: TrackConfig) -> AVAudioPCMBuffer? {
        let freq    = _freqs[note] ?? 220.0
        let atk     = Double(cfg.attack)
        let rel     = Double(cfg.release)
        let vol     = Double(cfg.vol) / 100.0 * 0.2
        let dur     = atk + rel + 0.05
        let freq2   = cfg.detune != 0 ? freq * pow(2, Double(cfg.detune) / 1200) : 0.0
        let alpha   = min(1.0, 2 * .pi * Double(cfg.filter) / _sr)

        guard let (buf, l, r, n) = _buf(dur) else { return nil }
        var ph1 = 0.0, ph2 = 0.0, lp = 0.0

        for i in 0..<n {
            let t   = Double(i) / _sr
            let env = t < atk ? t / atk : max(0.0001, 1.0 - (t - atk) / rel)
            ph1    += 2 * .pi * freq / _sr
            var s   = _osc(ph1, cfg.wave)
            if freq2 > 0 {
                ph2 += 2 * .pi * freq2 / _sr
                s    = (s + _osc(ph2, cfg.wave)) * 0.5
            }
            lp    += alpha * (s - lp)
            let v  = Float(lp * env * vol)
            l[i] = v; r[i] = v
        }
        return buf
    }

    private func _osc(_ ph: Double, _ wave: String) -> Double {
        let p = (ph / (2 * .pi)).truncatingRemainder(dividingBy: 1)
        switch wave {
        case "sine":     return sin(ph)
        case "sawtooth": return 2 * p - 1
        case "triangle": return 4 * abs(p - 0.5) - 1
        default:         return p < 0.5 ? 1.0 : -1.0   // square
        }
    }

    // MARK: - zsong parser

    private func _parse(_ text: String) -> ParsedSong? {
        let drumIds:  Set<String>   = ["kick", "snare", "hat", "clap"]
        let drumName: [String: String] = ["kick": "KICK", "snare": "SNARE", "hat": "HI-HAT", "clap": "CLAP"]

        let lines = text
            .components(separatedBy: "\n")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty && !$0.hasPrefix("#") }

        guard !lines.isEmpty else { return nil }

        var bpm     = 120.0
        var active: [String: String]    = [:]
        var configs:[String: TrackConfig] = [:]
        var i = 0

        if lines[0].hasPrefix("bpm ") {
            bpm = Double(lines[0].dropFirst(4).trimmingCharacters(in: .whitespaces)) ?? 120
            i = 1
        }

        while i < lines.count {
            let line = lines[i]
            guard line.hasPrefix("["), let close = line.firstIndex(of: "]") else { i += 1; continue }
            let trackId = String(line[line.index(after: line.startIndex)..<close])
            let rest    = String(line[line.index(after: close)...])

            var cfg = TrackConfig()
            for part in rest.components(separatedBy: .whitespaces) {
                let kv = part.components(separatedBy: "=")
                guard kv.count == 2 else { continue }
                switch kv[0] {
                case "vol":     cfg.vol     = Float(kv[1]) ?? 80
                case "wave":    cfg.wave    = kv[1]
                case "filter":  cfg.filter  = Float(kv[1]) ?? 2000
                case "attack":  cfg.attack  = Float(kv[1]) ?? 0.02
                case "release": cfg.release = Float(kv[1]) ?? 0.3
                case "detune":  cfg.detune  = Float(kv[1]) ?? 0
                default: break
                }
            }
            configs[trackId] = cfg
            i += 1

            guard i < lines.count, !lines[i].hasPrefix("[") else { continue }
            let stepLine = lines[i]; i += 1

            if drumIds.contains(trackId) {
                for s in stepLine.components(separatedBy: .whitespaces) where !s.isEmpty {
                    active["\(trackId)-\(s)"] = drumName[trackId] ?? "HIT"
                }
            } else {
                for part in stepLine.components(separatedBy: .whitespaces) where !part.isEmpty {
                    guard let colon = part.firstIndex(of: ":") else { continue }
                    active["\(trackId)-\(String(part[..<colon]))"] = String(part[part.index(after: colon)...])
                }
            }
        }

        var stepMap: [Int: [ZNote]] = [:]
        for (key, note) in active {
            guard let dash  = key.range(of: "-", options: .backwards),
                  let step  = Int(key[dash.upperBound...]) else { continue }
            let tid = String(key[..<dash.lowerBound])
            stepMap[step, default: []].append(ZNote(trackId: tid, note: note))
        }

        return ParsedSong(bpm: bpm, stepMap: stepMap, configs: configs)
    }
}

// MARK: - WKScriptMessageHandler bridge

final class ZsynthHandler: NSObject, WKScriptMessageHandler {
    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body   = message.body as? [String: Any],
              let action = body["action"] as? String else { return }

        DispatchQueue.global(qos: .userInteractive).async {
            switch action {
            case "preload":
                guard let songs = body["songs"] as? [String: String] else { return }
                ZsynthPlayer.shared.preload(songs: songs)
            case "play":
                guard let key = body["key"] as? String else { return }
                let context = body["context"] as? String ?? "menu"
                ZsynthPlayer.shared.play(key: key, context: context)
            case "stop":
                ZsynthPlayer.shared.stop()
            default: break
            }
        }
    }
}
