import UIKit
import WebKit

// MARK: - GameControlOverlay

final class GameControlOverlay: UIView {

    // ── External reference ───────────────────────────────────────────────────────
    weak var webView: WKWebView?

    // ── State ────────────────────────────────────────────────────────────────────
    private struct JoyState    { var dx: CGFloat = 0; var dy: CGFloat = 0; var active = false }
    private struct RockerState { var active = false; var isUp = false }

    private var leftJoy      = JoyState()
    private var rightJoy     = JoyState()
    private var winch        = RockerState()
    private var deliverPressed = false
    private var deliverOn    = false   // visual state, set by JS

    // ── Touch tracking ───────────────────────────────────────────────────────────
    private var leftTouch:    UITouch?
    private var rightTouch:   UITouch?
    private var winchTouch:   UITouch?
    private var deliverTouch: UITouch?

    // ── Tutorial state ────────────────────────────────────────────────────────────
    private var tutorialHighlight: String?     = nil
    private var tutorialDimmed:    Set<String> = []
    private var pulsePhase:        CGFloat     = 0

    // ── Display link — drives both controls→JS (60fps) and tutorial pulse ────────
    private var _link: CADisplayLink?

    // ── Layout (recomputed in layoutSubviews) ─────────────────────────────────────
    private var leftCenter:      CGPoint = .zero
    private var rightCenter:     CGPoint = .zero
    private var winchRockerRect: CGRect  = .zero
    private var deliverRect:     CGRect  = .zero
    private var joyRadius:       CGFloat = 75

    // ── Colours ───────────────────────────────────────────────────────────────────
    private let cBorder   = UIColor(red: 1, green: 0.4, blue: 0, alpha: 0.28)
    private let cFill     = UIColor(red: 1, green: 0.4, blue: 0, alpha: 0.04)
    private let cKnob     = UIColor(red: 1, green: 0.4, blue: 0, alpha: 0.14)
    private let cKnobRing = UIColor(red: 1, green: 0.4, blue: 0, alpha: 0.55)
    private let cLabel    = UIColor(red: 1, green: 0.4, blue: 0, alpha: 0.28)
    private let cActive   = UIColor(red: 1, green: 0.4, blue: 0, alpha: 0.80)

    // ── Init ──────────────────────────────────────────────────────────────────────
    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        isOpaque = false
        isMultipleTouchEnabled = true
        isUserInteractionEnabled = false  // enabled only via setVisible(true)
    }
    required init?(coder: NSCoder) { fatalError() }

    // ── External state setters ────────────────────────────────────────────────────
    func setDeliverOn(_ on: Bool)  { deliverOn = on }

    func setVisible(_ visible: Bool) {
        isHidden = !visible
        isUserInteractionEnabled = visible
        if visible {
            if _link == nil {
                _link = CADisplayLink(target: self, selector: #selector(_tick(_:)))
                _link?.preferredFramesPerSecond = 30
                _link?.add(to: .main, forMode: .common)
            }
        } else {
            _link?.invalidate()
            _link = nil
            pulsePhase = 0
        }
    }

    func setTutorialHighlight(_ control: String?) {
        tutorialHighlight = control
        if control == nil { pulsePhase = 0 }
    }

    func setTutorialDim(_ controls: Set<String>) { tutorialDimmed = controls }

    @objc private func _tick(_ link: CADisplayLink) {
        if tutorialHighlight != nil {
            pulsePhase = CGFloat(link.timestamp.truncatingRemainder(dividingBy: 1.4) / 1.4)
        }
        _sendControlsToJS()
        setNeedsDisplay()
    }

    // ── Layout ────────────────────────────────────────────────────────────────────
    override func layoutSubviews() {
        super.layoutSubviews()
        let b  = bounds
        let sl = safeAreaInsets.left  + 16
        let sr = safeAreaInsets.right + 16
        let sb = safeAreaInsets.bottom + 12

        joyRadius   = min(75, b.height * 0.32)
        let joyY    = b.height - sb - joyRadius
        leftCenter  = CGPoint(x: sl + joyRadius, y: joyY)
        rightCenter = CGPoint(x: b.width - sr - joyRadius, y: joyY)

        let btnH: CGFloat = 52
        let btnY = joyY - joyRadius - 8 - btnH

        winchRockerRect = CGRect(x: rightCenter.x - joyRadius, y: btnY,
                                 width: joyRadius * 2,          height: btnH)
        deliverRect     = CGRect(x: leftCenter.x  - joyRadius, y: btnY,
                                 width: joyRadius * 2,          height: btnH)

        setNeedsDisplay()
    }

    // MARK: - Drawing

    override func draw(_ rect: CGRect) {
        let ld = tutorialDimmed.contains("joystick-left")   ? 0.15 as CGFloat : 1.0
        let rd = tutorialDimmed.contains("joystick-right")  ? 0.15 as CGFloat : 1.0
        let wd = tutorialDimmed.contains("pitch-wheel")     ? 0.15 as CGFloat : 1.0
        let dd = tutorialDimmed.contains("deliver-toggle")  ? 0.15 as CGFloat : 1.0

        _withDim(ld) { drawJoystick(center: leftCenter,  joy: leftJoy,  safezoneStyle: .fourSector) }
        _withDim(rd) { drawJoystick(center: rightCenter, joy: rightJoy, safezoneStyle: .axisCross) }
        _withDim(wd) { drawWinchRocker() }
        _withDim(dd) { drawDeliverToggle() }

        if let hl = tutorialHighlight { _drawTutorialHighlight(hl) }
    }

    private func _withDim(_ factor: CGFloat, _ block: () -> Void) {
        guard factor < 1.0 else { block(); return }
        let ctx = UIGraphicsGetCurrentContext()!
        ctx.saveGState()
        ctx.setAlpha(factor)
        ctx.beginTransparencyLayer(auxiliaryInfo: nil)
        block()
        ctx.endTransparencyLayer()
        ctx.restoreGState()
    }

    private enum SafezoneStyle { case fourSector, axisCross }

    // ── Joystick ──────────────────────────────────────────────────────────────────
    private func drawJoystick(center: CGPoint, joy: JoyState, safezoneStyle: SafezoneStyle) {
        let r    = joyRadius
        let circ = CGRect(x: center.x - r, y: center.y - r, width: r * 2, height: r * 2)

        switch safezoneStyle {
        case .fourSector:
            drawSectors(center: center, radius: r,
                        starts: [-45, 135], span: 90, alpha: 0.10)
        case .axisCross:
            drawSectors(center: center, radius: r,
                        starts: [235, 55, -35, 145], span: 70, alpha: 0.13)
        }

        cFill.setFill();   UIBezierPath(ovalIn: circ).fill()
        let ring = UIBezierPath(ovalIn: circ); ring.lineWidth = 1; cBorder.setStroke(); ring.stroke()

        let attrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.monospacedSystemFont(ofSize: 11, weight: .bold),
            .foregroundColor: cLabel
        ]
        func label(_ s: String, at pt: CGPoint) {
            let sz = s.size(withAttributes: attrs)
            s.draw(at: CGPoint(x: pt.x - sz.width / 2, y: pt.y - sz.height / 2), withAttributes: attrs)
        }
        label("▲", at: CGPoint(x: center.x, y: center.y - r + 10))
        label("▼", at: CGPoint(x: center.x, y: center.y + r - 14))
        label("◀", at: CGPoint(x: center.x - r + 8,  y: center.y - 6))
        label("▶", at: CGPoint(x: center.x + r - 12, y: center.y - 6))

        let clamp  = r * 0.55
        let kdx    = max(-clamp, min(clamp, joy.dx))
        let kdy    = max(-clamp, min(clamp, joy.dy))
        let kR: CGFloat = 28
        let knob   = CGRect(x: center.x + kdx - kR, y: center.y + kdy - kR, width: kR * 2, height: kR * 2)
        cKnob.setFill();    UIBezierPath(ovalIn: knob).fill()
        let kp = UIBezierPath(ovalIn: knob); kp.lineWidth = 1; cKnobRing.setStroke(); kp.stroke()
    }

    private func drawSectors(center: CGPoint, radius: CGFloat,
                              starts: [CGFloat], span: CGFloat, alpha: CGFloat) {
        UIColor(red: 1, green: 0.4, blue: 0, alpha: alpha).setFill()
        for deg in starts {
            let path = UIBezierPath()
            path.move(to: center)
            path.addArc(withCenter: center, radius: radius,
                        startAngle: deg * .pi / 180,
                        endAngle:  (deg + span) * .pi / 180,
                        clockwise: true)
            path.close(); path.fill()
        }
    }

    // ── Shared: glowing pip ───────────────────────────────────────────────────────
    private func _drawPip(at center: CGPoint, alpha: CGFloat) {
        let r: CGFloat = 4
        let rect = CGRect(x: center.x - r, y: center.y - r, width: r * 2, height: r * 2)
        let ctx = UIGraphicsGetCurrentContext()!
        if alpha > 0.5 {
            ctx.saveGState()
            ctx.setShadow(offset: .zero, blur: 10,
                          color: UIColor(red: 1, green: 0.4, blue: 0, alpha: 0.85).cgColor)
            UIColor(red: 1, green: 0.4, blue: 0, alpha: alpha).setFill()
            UIBezierPath(ovalIn: rect).fill()
            ctx.restoreGState()
        } else {
            UIColor(red: 1, green: 0.4, blue: 0, alpha: alpha).setFill()
            UIBezierPath(ovalIn: rect).fill()
        }
    }

    private func _drawHorizontalLever(in rect: CGRect,
                                       leftActive:  Bool = false,
                                       rightActive: Bool = false,
                                       leftLabel:   String? = nil,
                                       rightLabel:  String? = nil,
                                       centerLabel: String? = nil) {
        let active = leftActive || rightActive
        let ctx    = UIGraphicsGetCurrentContext()!
        let cx = rect.midX, cy = rect.midY

        let barW: CGFloat = rect.width
        let barH: CGFloat = rect.height * 0.65
        let capR: CGFloat = barH * 0.22
        let lr = CGRect(x: cx - barW/2, y: cy - barH/2, width: barW, height: barH)

        UIColor.black.setFill()
        UIBezierPath(roundedRect: lr, cornerRadius: capR).fill()

        // Glanzpunkt — left-side strip
        ctx.saveGState()
        UIBezierPath(roundedRect: lr, cornerRadius: capR).addClip()
        UIColor(white: 1, alpha: 0.16).setFill()
        UIBezierPath(roundedRect: CGRect(x: lr.minX + 2, y: lr.minY + 2,
                                         width: barH * 0.28, height: barH - 4),
                     cornerRadius: 3).fill()
        ctx.restoreGState()


        // Labels
        func leverLabel(_ s: String, x: CGFloat, isActive: Bool) {
            let a: [NSAttributedString.Key: Any] = [
                .font: UIFont.monospacedSystemFont(ofSize: 13, weight: .bold),
                .foregroundColor: isActive ? cActive : cLabel
            ]
            let sz = s.size(withAttributes: a)
            s.draw(at: CGPoint(x: x - sz.width/2, y: cy - sz.height/2), withAttributes: a)
        }
        if let l  = leftLabel   { leverLabel(l,  x: cx - barW * 0.26, isActive: leftActive) }
        if let rr = rightLabel  { leverLabel(rr, x: cx + barW * 0.26, isActive: rightActive) }
        if let c  = centerLabel { leverLabel(c,  x: cx,                isActive: active) }
    }

    // ── Winch rocker ──────────────────────────────────────────────────────────────
    private func drawWinchRocker() {
        let upActive   = winch.active &&  winch.isUp
        let downActive = winch.active && !winch.isUp

        _drawHorizontalLever(in: winchRockerRect,
                             leftActive: upActive, rightActive: downActive,
                             leftLabel: "↑", rightLabel: "↓")

        let pipInset = winchRockerRect.height * 0.65 * 0.22 + 8
        _drawPip(at: CGPoint(x: winchRockerRect.minX + pipInset, y: winchRockerRect.midY), alpha: upActive   ? 1.0 : 0.15)
        _drawPip(at: CGPoint(x: winchRockerRect.maxX - pipInset, y: winchRockerRect.midY), alpha: downActive ? 1.0 : 0.15)
    }

    // ── Deliver toggle ────────────────────────────────────────────────────────────
    private func drawDeliverToggle() {
        _drawHorizontalLever(in: deliverRect,
                             leftActive: deliverOn, centerLabel: "R")

        let pipInset = deliverRect.height * 0.65 * 0.22 + 8
        _drawPip(at: CGPoint(x: deliverRect.minX + pipInset, y: deliverRect.midY),
                 alpha: deliverOn ? 1.0 : 0.15)
    }

    // MARK: - Hit testing

    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        guard !isHidden, isUserInteractionEnabled, alpha > 0.01 else { return nil }
        return zone(for: point) != nil ? self : nil
    }

    private enum Zone { case leftJoy, rightJoy, winchRocker, deliverBtn }

    private func zone(for pt: CGPoint) -> Zone? {
        if !tutorialDimmed.contains("joystick-left") {
            let ldx = pt.x - leftCenter.x, ldy = pt.y - leftCenter.y
            if ldx*ldx + ldy*ldy <= joyRadius*joyRadius { return .leftJoy }
        }
        if !tutorialDimmed.contains("joystick-right") {
            let rdx = pt.x - rightCenter.x, rdy = pt.y - rightCenter.y
            if rdx*rdx + rdy*rdy <= joyRadius*joyRadius { return .rightJoy }
        }
        if !tutorialDimmed.contains("pitch-wheel")    && winchRockerRect.contains(pt) { return .winchRocker }
        if !tutorialDimmed.contains("deliver-toggle") && deliverRect.contains(pt)     { return .deliverBtn }
        return nil
    }

    // MARK: - Touch handling

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        for t in touches {
            let pt = t.location(in: self)
            switch zone(for: pt) {
            case .leftJoy   where leftTouch   == nil: leftTouch   = t; leftJoy.active  = true
            case .rightJoy  where rightTouch  == nil: rightTouch  = t; rightJoy.active = true
            case .winchRocker where winchTouch == nil:
                winchTouch = t; winch.active = true
                winch.isUp = pt.x < winchRockerRect.midX
            case .deliverBtn where deliverTouch == nil:
                deliverTouch = t; deliverPressed = true
            default: break
            }
        }
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        for t in touches {
            let pt = t.location(in: self)
            if t === leftTouch {
                leftJoy.dx = pt.x - leftCenter.x
                leftJoy.dy = pt.y - leftCenter.y
            } else if t === rightTouch {
                rightJoy.dx = pt.x - rightCenter.x
                rightJoy.dy = pt.y - rightCenter.y
            } else if t === winchTouch {
                winch.isUp = pt.x < winchRockerRect.midX
            }
        }
    }

    override func touchesEnded(_ touches: Set<UITouch>,   with event: UIEvent?) { release(touches) }
    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) { release(touches) }

    private func release(_ touches: Set<UITouch>) {
        for t in touches {
            if      t === leftTouch    { leftTouch    = nil; leftJoy  = JoyState() }
            else if t === rightTouch   { rightTouch   = nil; rightJoy = JoyState() }
            else if t === winchTouch   { winchTouch   = nil; winch    = RockerState() }
            else if t === deliverTouch { deliverTouch = nil; deliverPressed = false }
        }
    }

    // MARK: - Tutorial highlight

    private func _drawTutorialHighlight(_ control: String) {
        let t          = sin(pulsePhase * .pi)
        let ringW:  CGFloat = 2 + t * 2
        let ringA:  CGFloat = 0.75 + t * 0.25
        let blurR:  CGFloat = 10 + t * 10
        let glowA:  CGFloat = 0.35 + t * 0.20
        let ctx = UIGraphicsGetCurrentContext()!

        switch control {
        case "joystick-left", "joystick-right":
            let center = control == "joystick-left" ? leftCenter : rightCenter
            let r = joyRadius + 3
            let rect = CGRect(x: center.x - r, y: center.y - r, width: r * 2, height: r * 2)
            ctx.saveGState()
            ctx.setShadow(offset: .zero, blur: blurR,
                          color: UIColor(white: 1, alpha: glowA).cgColor)
            let path = UIBezierPath(ovalIn: rect)
            path.lineWidth = ringW
            UIColor(white: 1, alpha: ringA).setStroke()
            path.stroke()
            ctx.restoreGState()

        case "pitch-wheel":
            _drawRectPulse(winchRockerRect, ringW: ringW, ringA: ringA, blurR: blurR, glowA: glowA)
        case "deliver-toggle":
            _drawRectPulse(deliverRect,     ringW: ringW, ringA: ringA, blurR: blurR, glowA: glowA)
        default: break
        }
    }

    private func _drawRectPulse(_ rect: CGRect, ringW: CGFloat, ringA: CGFloat,
                                 blurR: CGFloat, glowA: CGFloat) {
        let ctx = UIGraphicsGetCurrentContext()!
        let outer = rect.insetBy(dx: -(ringW / 2 + 2), dy: -(ringW / 2 + 2))
        ctx.saveGState()
        ctx.setShadow(offset: .zero, blur: blurR,
                      color: UIColor(white: 1, alpha: glowA).cgColor)
        let path = UIBezierPath(roundedRect: outer, cornerRadius: 12)
        path.lineWidth = ringW
        UIColor(white: 1, alpha: ringA).setStroke()
        path.stroke()
        ctx.restoreGState()
    }

    // MARK: - JS notification (called from display link, max 60fps)

    private func _sendControlsToJS() {
        let jr   = joyRadius
        let wDy: CGFloat = winch.active ? (winch.isUp ? -30 : 30) : 0
        let js = """
        window.__nativeControls && window.__nativeControls({
          leftJoy:    {dx:\(leftJoy.dx),dy:\(leftJoy.dy),jr:\(jr),active:\(leftJoy.active)},
          rightJoy:   {dx:\(rightJoy.dx),dy:\(rightJoy.dy),jr:\(jr),active:\(rightJoy.active)},
          pitchWheel: {dy:\(wDy),active:\(winch.active)},
          deliverBtn: \(deliverPressed)
        })
        """
        webView?.evaluateJavaScript(js, completionHandler: nil)
    }
}
