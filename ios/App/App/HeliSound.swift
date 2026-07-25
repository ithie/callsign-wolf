import AVFoundation
import WebKit

// MARK: - HeliSoundPlayer

final class HeliSoundPlayer {
    static let shared = HeliSoundPlayer()

    private var source: AVAudioSourceNode?
    private var sfxVoices: [AVAudioPlayerNode] = []
    private var sfxIdx = 0
    private static let SFX_VOICES = 4

    // Target parameters — written on main thread, read on audio thread.
    // Single-Float writes are word-aligned and atomic on ARM; acceptable for audio smoothing.
    var tFreq:      Float = 10
    var tVol:       Float = 0
    var tWind:      Float = 0
    var clipK:      Float = 25      // 1 + clipAmount * 8
    var isOrtho:    Bool  = false
    var tLFOFreq:   Float = 1.1
    var tLFODepth:  Float = 0.45
    var rotorGain:  Float = 1.5    // output boost — raise if too quiet, lower if too loud
    var needsReset: Bool  = false   // main thread sets; audio thread clears

    private var _blades: Int = 4

    // Biquad coefficients — set once on initHeli, never changed mid-playback
    private var bqB0: Float = 0, bqB2: Float = 0
    private var bqA1: Float = 0, bqA2: Float = 0

    // DSP state — only touched from audio render block
    private var oscPhase:       Float = 0
    private var freqSmooth:     Float = 10  // smoothed blade frequency (80ms TC)
    private var lfoPhase:       Float = 0
    private var lfoFreqSmooth:  Float = 1.1
    private var lfoDepthSmooth: Float = 0.45
    private var bqX1: Float = 0, bqX2: Float = 0
    private var bqY1: Float = 0, bqY2: Float = 0
    private var windLP:          Float = 0
    private var windGainSmooth:  Float = 0
    private var masterGainSmooth: Float = 0
    private var noiseIdx: Int = 0

    private let sr: Float
    private var noiseTable: [Float] = []

    private init() {
        let sessionSR = AVAudioSession.sharedInstance().sampleRate
        sr = sessionSR > 0 ? Float(sessionSR) : 44100
        let tableLen = Int(sr * 2)
        noiseTable = (0..<tableLen).map { _ in Float.random(in: -1.0...1.0) }
        _setup()
    }

    // MARK: - Biquad (bandpass, computed at init)

    private func _computeBiquad(f: Float, q: Float) {
        let f0   = min(f, sr * 0.499)
        let w0   = 2.0 * Float.pi * f0 / sr
        let sinW = sin(w0)
        let cosW = cos(w0)
        let alpha = sinW / (2.0 * max(0.001, q))
        let a0 = 1.0 + alpha
        bqB0 =  alpha / a0
        bqB2 = -alpha / a0
        bqA1 = -2.0 * cosW / a0
        bqA2 = (1.0 - alpha) / a0
    }

    // MARK: - Engine

    private func _setup() {
        let fmt = AVAudioFormat(
            commonFormat: .pcmFormatFloat32,
            sampleRate: Double(sr), channels: 2, interleaved: false)!
        let table = noiseTable
        let half  = table.count / 2

        source = AVAudioSourceNode(format: fmt) { [unowned self] _, _, frameCount, abl -> OSStatus in
            let ablPtr = UnsafeMutableAudioBufferListPointer(abl)
            let L = ablPtr[0].mData!.assumingMemoryBound(to: Float.self)
            let R = ablPtr[1].mData!.assumingMemoryBound(to: Float.self)

            if self.needsReset {
                self.needsReset = false
                self.oscPhase = 0; self.lfoPhase = 0
                self.bqX1 = 0; self.bqX2 = 0; self.bqY1 = 0; self.bqY2 = 0
                self.windLP = 0
            }

            // Snapshot targets — one read per block, not per sample
            let snap_tFreq  = self.tFreq
            let snap_tVol   = self.tVol
            let snap_tWind  = self.tWind
            let snap_clipK  = self.clipK
            let snap_ortho  = self.isOrtho
            let snap_lfoF   = self.tLFOFreq
            let snap_lfoD   = self.tLFODepth

            // Time constants matching JS
            let volAlpha  = Float(1.0 - exp(-1.0 / Double(self.sr) / 0.06))
            let windAlpha = Float(1.0 - exp(-1.0 / Double(self.sr) / 0.40))
            let lfoAlpha  = Float(1.0 - exp(-1.0 / Double(self.sr) / 0.12))
            let freqAlpha = Float(1.0 - exp(-1.0 / Double(self.sr) / 0.08)) // 80ms spin-up TC

            for i in 0..<Int(frameCount) {
                let noise     = table[self.noiseIdx % table.count]
                let windNoise = table[(self.noiseIdx + half) % table.count]
                self.noiseIdx += 1

                var rotor: Float

                if snap_ortho {
                    // Noise → bandpass (700 Hz, Q=1.8) → LFO amplitude envelope
                    let y = self.bqB0 * noise
                               + self.bqB2 * self.bqX2
                               - self.bqA1 * self.bqY1
                               - self.bqA2 * self.bqY2
                    self.bqX2 = self.bqX1; self.bqX1 = noise
                    self.bqY2 = self.bqY1; self.bqY1 = y

                    self.lfoFreqSmooth  += (snap_lfoF - self.lfoFreqSmooth)  * lfoAlpha
                    self.lfoDepthSmooth += (snap_lfoD - self.lfoDepthSmooth) * lfoAlpha
                    self.lfoPhase += self.lfoFreqSmooth / self.sr
                    if self.lfoPhase >= 1.0 { self.lfoPhase -= 1.0 }
                    let env = 0.5 + sin(self.lfoPhase * 2.0 * .pi) * self.lfoDepthSmooth
                    rotor = y * max(0, env)

                } else {
                    // Sawtooth at blade_freq → hard clip → bandpass at bpf Hz
                    // Multiple harmonics of blade_freq beat through the bandpass → "flap flap" character
                    self.freqSmooth += (snap_tFreq - self.freqSmooth) * freqAlpha

                    self.oscPhase += self.freqSmooth / self.sr
                    if self.oscPhase >= 1.0 { self.oscPhase -= 1.0 }

                    let saw = 2.0 * self.oscPhase - 1.0
                    let x   = max(-1.0, min(1.0, saw * snap_clipK))
                    let y   = self.bqB0 * x          + self.bqB2 * self.bqX2
                            - self.bqA1 * self.bqY1  - self.bqA2 * self.bqY2
                    self.bqX2 = self.bqX1; self.bqX1 = x
                    self.bqY2 = self.bqY1; self.bqY1 = y
                    rotor = y
                }

                // Wind: white noise → lowpass 200 Hz
                self.windLP += (windNoise - self.windLP) * (2.0 * .pi * 200.0 / self.sr)
                self.windGainSmooth  += (snap_tWind - self.windGainSmooth)  * windAlpha
                self.masterGainSmooth += (snap_tVol - self.masterGainSmooth) * volAlpha

                let out = min(1.0, max(-1.0, (rotor * self.rotorGain + self.windLP * self.windGainSmooth) * self.masterGainSmooth))
                L[i] = out; R[i] = out
            }
            return noErr
        }

        let engine = ZsynthPlayer.shared.engine
        let sfxMix = ZsynthPlayer.shared.sfxMixer
        engine.attach(source!)
        engine.connect(source!, to: sfxMix, format: fmt)

        let sfxFmt = AVAudioFormat(standardFormatWithSampleRate: Double(sr), channels: 2)!
        for _ in 0..<Self.SFX_VOICES {
            let v = AVAudioPlayerNode()
            engine.attach(v)
            engine.connect(v, to: sfxMix, format: sfxFmt)
            sfxVoices.append(v)
        }

        if !engine.isRunning {
            do { try engine.start() }
            catch { print("[HeliSound] engine start failed: \(error)") }
        }
        sfxVoices.forEach { $0.play() }
    }

    func resumeEngine() {
        sfxVoices.forEach { if !$0.isPlaying { $0.play() } }
    }

    // MARK: - Public API

    func initHeli(heliType: String, blades: Int = 4, clip: Float = 3.0,
                  bpf: Float = 120, bpfQ: Float = 2.5, gain: Float = 1.5) {
        tVol = 0; tWind = 0
        rotorGain = gain
        if heliType == "ornithopter" {
            isOrtho = true
            _computeBiquad(f: 700, q: 1.8)
        } else {
            isOrtho = false
            _blades = blades
            clipK   = 1.0 + clip * 8.0
            _computeBiquad(f: bpf, q: bpfQ)
        }
        needsReset = true
    }

    func updateSound(rpm: Float, engineOn: Bool, windSpeed: Float,
                     heliType: String, flapRate: Float, sfxEnabled: Bool) {
        tWind = min(1.0, windSpeed * 2000.0) * 0.5
        if isOrtho {
            tLFOFreq  = 1.1 * flapRate
            tLFODepth = 0.45 * max(0.1, rpm)
            tVol = sfxEnabled ? (engineOn ? 1.0 * (0.08 + 0.35 * rpm) : 0.04 * rpm) : 0
        } else {
            tFreq = max(1.0, (rpm * 220.0 / 60.0) * Float(_blades))
            tVol  = sfxEnabled ? (engineOn ? 0.8 * (0.2 + 0.8 * rpm) : 0.5 * rpm) : 0
        }
    }

    func playSfx(freq: Float, duration: Float, gain: Float, type sfxType: String) {
        guard !sfxVoices.isEmpty,
              let buf = _sfxBuf(freq: freq, duration: duration, gain: gain, type: sfxType) else { return }
        let v = sfxVoices[sfxIdx % Self.SFX_VOICES]
        sfxIdx += 1
        v.scheduleBuffer(buf)
    }

    private func _sfxBuf(freq: Float, duration: Float, gain: Float, type: String) -> AVAudioPCMBuffer? {
        let frames = AVAudioFrameCount(Double(sr) * Double(max(0.01, duration)))
        let fmt = AVAudioFormat(standardFormatWithSampleRate: Double(sr), channels: 2)!
        guard let buf = AVAudioPCMBuffer(pcmFormat: fmt, frameCapacity: frames),
              let ch  = buf.floatChannelData else { return nil }
        buf.frameLength = frames
        let n   = Int(frames)
        let dur = Double(duration)
        var ph  = 0.0
        for i in 0..<n {
            let t   = Double(i) / Double(sr)
            let atk = min(1.0, t / 0.005)
            let rel = min(1.0, (dur - t) / 0.015)
            let env = Float(min(atk, rel))
            ph     += 2 * .pi * Double(freq) / Double(sr)
            let p   = ph.truncatingRemainder(dividingBy: 2 * .pi)
            let s: Float
            switch type {
            case "square":   s = p < .pi ? 1 : -1
            case "sawtooth": s = Float(p / .pi - 1)
            case "triangle": s = Float(abs(p / .pi - 1) * 2 - 1)
            default:         s = Float(sin(ph))
            }
            let v = s * env * gain
            ch[0][i] = v; ch[1][i] = v
        }
        return buf
    }

    func stopSound() {
        tVol = 0; tWind = 0
    }

    func setSfxEnabled(_ enabled: Bool) {
        if !enabled { tVol = 0; tWind = 0 }
    }
}

// MARK: - WKScriptMessageHandler bridge

final class HeliSoundHandler: NSObject, WKScriptMessageHandler {
    private var sfxEnabled = true

    // Called on main thread by WKWebView
    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body   = message.body as? [String: Any],
              let action = body["action"] as? String else { return }

        switch action {
        case "init":
            let heliType = body["heliType"] as? String ?? "dolphin"
            let blades   = (body["blades"]  as? Int)                    ?? 4
            let clip     = (body["clip"]    as? Double).map(Float.init) ?? 3.0
            let bpf      = (body["bpf"]     as? Double).map(Float.init) ?? 120.0
            let bpfQ     = (body["bpfQ"]    as? Double).map(Float.init) ?? 2.5
            let gain     = (body["gain"]    as? Double).map(Float.init) ?? 1.5
            HeliSoundPlayer.shared.initHeli(heliType: heliType, blades: blades, clip: clip, bpf: bpf, bpfQ: bpfQ, gain: gain)

        case "update":
            let rpm      = (body["rpm"]       as? Double).map(Float.init) ?? 0
            let engineOn = (body["engineOn"]   as? Bool)                  ?? false
            let wind     = (body["windSpeed"]  as? Double).map(Float.init) ?? 0
            let heliType =  body["heliType"]   as? String                 ?? "dolphin"
            let flapRate = (body["flapRate"]   as? Double).map(Float.init) ?? 1
            HeliSoundPlayer.shared.updateSound(
                rpm: rpm, engineOn: engineOn, windSpeed: wind,
                heliType: heliType, flapRate: flapRate, sfxEnabled: sfxEnabled)

        case "sfx":
            guard sfxEnabled else { return }
            let freq     = (body["freq"]     as? Double).map(Float.init) ?? 440
            let duration = (body["duration"] as? Double).map(Float.init) ?? 0.1
            let gain     = (body["gain"]     as? Double).map(Float.init) ?? 0.15
            let sfxType  =  body["type"]     as? String                  ?? "sine"
            HeliSoundPlayer.shared.playSfx(freq: freq, duration: duration, gain: gain, type: sfxType)

        case "stop":
            HeliSoundPlayer.shared.stopSound()

        case "setSfx":
            sfxEnabled = (body["enabled"] as? Bool) ?? true
            HeliSoundPlayer.shared.setSfxEnabled(sfxEnabled)

        default: break
        }
    }
}
