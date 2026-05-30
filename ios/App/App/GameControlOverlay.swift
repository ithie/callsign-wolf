import UIKit
import WebKit

// MARK: - GameControlOverlay

final class GameControlOverlay: UIView {

    // ── External reference ───────────────────────────────────────────────────────
    weak var webView: WKWebView?

    // ── State ────────────────────────────────────────────────────────────────────
    private struct JoyState  { var dx: CGFloat = 0; var dy: CGFloat = 0; var active = false }
    private struct WheelState { var dy: CGFloat = 0; var startY: CGFloat = 0; var active = false }

    private var leftJoy    = JoyState()
    private var rightJoy   = JoyState()
    private var wheel      = WheelState()
    private var deliverPressed = false
    private var deliverOn  = false   // visual state, set by JS

    // ── Touch tracking ───────────────────────────────────────────────────────────
    private var leftTouch:    UITouch?
    private var rightTouch:   UITouch?
    private var wheelTouch:   UITouch?
    private var deliverTouch: UITouch?

    // ── Tutorial state ────────────────────────────────────────────────────────────
    private var tutorialHighlight: String?     = nil
    private var tutorialDimmed:    Set<String> = []
    private var pulsePhase:        CGFloat     = 0

    // ── Display link — drives both controls→JS (60fps) and tutorial pulse ────────
    private var _link: CADisplayLink?

    // ── Layout (recomputed in layoutSubviews) ─────────────────────────────────────
    private var leftCenter:  CGPoint = .zero
    private var rightCenter: CGPoint = .zero
    private var wheelRect:   CGRect  = .zero
    private var deliverRect: CGRect  = .zero
    private var joyRadius:   CGFloat = 65

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

        joyRadius    = min(65, b.height * 0.28)
        let joyY     = b.height - sb - joyRadius
        leftCenter   = CGPoint(x: sl + joyRadius, y: joyY)
        rightCenter  = CGPoint(x: b.width - sr - joyRadius, y: joyY)

        let wW: CGFloat = 52, wH: CGFloat = 96
        let topY      = joyY - joyRadius - 8 - wH
        wheelRect     = CGRect(x: sl,          y: topY, width: wW, height: wH)
        deliverRect   = CGRect(x: sl + wW + 8, y: topY, width: wW, height: wH)

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
        _withDim(wd) { drawPitchWheel() }
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

        // Safe-zone sectors
        switch safezoneStyle {
        case .fourSector:
            // 2 bright 90° sectors (E and W = strafe zones); dim sectors are the background fill
            drawSectors(center: center, radius: r,
                        starts: [-45, 135], span: 90, alpha: 0.10)
        case .axisCross:
            // 70° arcs centred on N/S (vertical = accel-only) and E/W (horizontal = steer-only)
            drawSectors(center: center, radius: r,
                        starts: [235, 55, -35, 145], span: 70, alpha: 0.13)
        }

        // Outer circle
        cFill.setFill();   UIBezierPath(ovalIn: circ).fill()
        let ring = UIBezierPath(ovalIn: circ); ring.lineWidth = 1; cBorder.setStroke(); ring.stroke()

        // Direction arrows
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

        // Knob
        let clamp  = r * 0.55
        let kdx    = max(-clamp, min(clamp, joy.dx))
        let kdy    = max(-clamp, min(clamp, joy.dy))
        let kR: CGFloat = 26
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

    // ── Pitch wheel ───────────────────────────────────────────────────────────────
    private func drawPitchWheel() {
        let r: CGFloat = 10
        let borderColor = wheel.active ? cActive : cBorder

        // Background
        cFill.setFill()
        UIBezierPath(roundedRect: wheelRect, cornerRadius: r).fill()
        let border = UIBezierPath(roundedRect: wheelRect, cornerRadius: r)
        border.lineWidth = 1; borderColor.setStroke(); border.stroke()

        // Drum stripes
        let ctx = UIGraphicsGetCurrentContext()!
        ctx.saveGState()
        UIBezierPath(roundedRect: wheelRect, cornerRadius: r).addClip()
        UIColor(red: 1, green: 0.4, blue: 0, alpha: 0.10).setStroke()
        let offset = wheel.dy.truncatingRemainder(dividingBy: 9)
        var ly = wheelRect.minY + offset
        while ly <= wheelRect.maxY {
            let lp = UIBezierPath(); lp.move(to: CGPoint(x: wheelRect.minX, y: ly))
            lp.addLine(to: CGPoint(x: wheelRect.maxX, y: ly)); lp.lineWidth = 2; lp.stroke()
            ly += 9
        }
        ctx.restoreGState()

        // Indicator bar
        let indH: CGFloat = 18
        let rawIndY = wheelRect.midY + wheel.dy - indH / 2
        let indY    = max(wheelRect.minY + 2, min(wheelRect.maxY - indH - 2, rawIndY))
        let indRect = CGRect(x: wheelRect.minX + 5, y: indY, width: wheelRect.width - 10, height: indH)
        UIColor(red: 1, green: 0.4, blue: 0, alpha: wheel.active ? 0.32 : 0.18).setFill()
        UIBezierPath(roundedRect: indRect, cornerRadius: 5).fill()
        let indPath = UIBezierPath(roundedRect: indRect, cornerRadius: 5)
        indPath.lineWidth = 1
        UIColor(red: 1, green: 0.4, blue: 0, alpha: wheel.active ? 0.9 : 0.45).setStroke()
        indPath.stroke()

        // Labels
        let la: [NSAttributedString.Key: Any] = [
            .font: UIFont.monospacedSystemFont(ofSize: 11, weight: .regular),
            .foregroundColor: cLabel
        ]
        "↑".draw(at: CGPoint(x: wheelRect.midX - 5, y: wheelRect.minY + 4),  withAttributes: la)
        "↓".draw(at: CGPoint(x: wheelRect.midX - 5, y: wheelRect.maxY - 17), withAttributes: la)
    }

    // ── Deliver toggle ────────────────────────────────────────────────────────────
    private func drawDeliverToggle() {
        let r: CGFloat = 10
        let ctx = UIGraphicsGetCurrentContext()!
        ctx.saveGState()

        // Simulate CSS rotateX(-22deg / +22deg): Y-scale around top/bottom pivot
        let yScale = CGFloat(cos(22.0 * .pi / 180.0))   // ≈ 0.927
        let pivotX = deliverRect.midX
        let pivotY = deliverOn ? deliverRect.minY : deliverRect.maxY
        ctx.translateBy(x: pivotX, y: pivotY)
        ctx.scaleBy(x: 1.0, y: yScale)
        ctx.translateBy(x: -pivotX, y: -pivotY)

        // Gradient body
        let colors: [CGFloat]
        if deliverOn {
            colors = [1,0.4,0,0.06, 0,0,0,0.60, 1,0.4,0,0.30, 1,0.4,0,0.55]
        } else {
            colors = [1,0.4,0,0.14, 0,0,0,0.70, 0,0,0,0.70, 1,0.4,0,0.06]
        }
        let cgColors = stride(from: 0, to: colors.count, by: 4).map { i in
            UIColor(red: colors[i], green: colors[i+1], blue: colors[i+2], alpha: colors[i+3]).cgColor
        }
        let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
                                  colors: cgColors as CFArray,
                                  locations: [0, 0.25, 0.75, 1.0])!
        ctx.saveGState()
        UIBezierPath(roundedRect: deliverRect, cornerRadius: r).addClip()
        ctx.drawLinearGradient(gradient,
                               start: CGPoint(x: deliverRect.midX, y: deliverRect.minY),
                               end:   CGPoint(x: deliverRect.midX, y: deliverRect.maxY),
                               options: [])
        ctx.restoreGState()

        // Pips
        let pipR: CGFloat = 4
        let topPipAlpha: CGFloat = deliverOn ? 0.15 : 0.5
        let botPipAlpha: CGFloat = deliverOn ? 1.0  : 0.15
        UIColor(red: 1, green: 0.4, blue: 0, alpha: topPipAlpha).setFill()
        UIBezierPath(ovalIn: CGRect(x: deliverRect.midX - pipR, y: deliverRect.minY + 6,
                                   width: pipR * 2, height: pipR * 2)).fill()
        UIColor(red: 1, green: 0.4, blue: 0, alpha: botPipAlpha).setFill()
        UIBezierPath(ovalIn: CGRect(x: deliverRect.midX - pipR,
                                   y: deliverRect.maxY - 6 - pipR * 2,
                                   width: pipR * 2, height: pipR * 2)).fill()

        if deliverOn {
            ctx.setShadow(offset: .zero, blur: 20,
                          color: UIColor(red: 1, green: 0.4, blue: 0, alpha: 0.4).cgColor)
            let glow = UIBezierPath(roundedRect: deliverRect.insetBy(dx: 4, dy: 4), cornerRadius: r - 2)
            UIColor(red: 1, green: 0.4, blue: 0, alpha: 0.1).setFill(); glow.fill()
        }

        ctx.restoreGState()
    }

    // MARK: - Hit testing

    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        guard !isHidden, isUserInteractionEnabled, alpha > 0.01 else { return nil }
        return zone(for: point) != nil ? self : nil
    }

    private enum Zone { case leftJoy, rightJoy, pitchWheel, deliverBtn }

    private func zone(for pt: CGPoint) -> Zone? {
        if !tutorialDimmed.contains("joystick-left") {
            let ldx = pt.x - leftCenter.x, ldy = pt.y - leftCenter.y
            if ldx*ldx + ldy*ldy <= joyRadius*joyRadius { return .leftJoy }
        }
        if !tutorialDimmed.contains("joystick-right") {
            let rdx = pt.x - rightCenter.x, rdy = pt.y - rightCenter.y
            if rdx*rdx + rdy*rdy <= joyRadius*joyRadius { return .rightJoy }
        }
        if !tutorialDimmed.contains("pitch-wheel")    && wheelRect.contains(pt)   { return .pitchWheel }
        if !tutorialDimmed.contains("deliver-toggle") && deliverRect.contains(pt) { return .deliverBtn }
        return nil
    }

    // MARK: - Touch handling

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        for t in touches {
            let pt = t.location(in: self)
            switch zone(for: pt) {
            case .leftJoy   where leftTouch   == nil: leftTouch   = t; leftJoy.active  = true
            case .rightJoy  where rightTouch  == nil: rightTouch  = t; rightJoy.active = true
            case .pitchWheel where wheelTouch == nil:
                wheelTouch = t; wheel.active = true; wheel.startY = pt.y; wheel.dy = 0
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
            } else if t === wheelTouch {
                wheel.dy = max(-48, min(48, pt.y - wheel.startY))
            }
        }
    }

    override func touchesEnded(_ touches: Set<UITouch>,   with event: UIEvent?) { release(touches) }
    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) { release(touches) }

    private func release(_ touches: Set<UITouch>) {
        for t in touches {
            if t === leftTouch    { leftTouch   = nil; leftJoy  = JoyState() }
            else if t === rightTouch  { rightTouch  = nil; rightJoy = JoyState() }
            else if t === wheelTouch  { wheelTouch  = nil; wheel    = WheelState() }
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
            _drawRectPulse(wheelRect,   ringW: ringW, ringA: ringA, blurR: blurR, glowA: glowA)
        case "deliver-toggle":
            _drawRectPulse(deliverRect, ringW: ringW, ringA: ringA, blurR: blurR, glowA: glowA)
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
        let jr = joyRadius
        let js = """
        window.__nativeControls && window.__nativeControls({
          leftJoy:    {dx:\(leftJoy.dx),dy:\(leftJoy.dy),jr:\(jr),active:\(leftJoy.active)},
          rightJoy:   {dx:\(rightJoy.dx),dy:\(rightJoy.dy),jr:\(jr),active:\(rightJoy.active)},
          pitchWheel: {dy:\(wheel.dy),active:\(wheel.active)},
          deliverBtn: \(deliverPressed)
        })
        """
        webView?.evaluateJavaScript(js, completionHandler: nil)
    }
}
