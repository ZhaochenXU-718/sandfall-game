#!/usr/bin/env swift

import CoreGraphics
import CoreText
import Foundation

struct Options {
    let fontPath: String
    let text: String
    let size: CGFloat
    let weight: Double
    let tracking: CGFloat
}

func parseOptions() -> Options {
    let arguments = CommandLine.arguments
    func value(after flag: String) -> String? {
        guard let index = arguments.firstIndex(of: flag), index + 1 < arguments.count else {
            return nil
        }
        return arguments[index + 1]
    }
    guard
        let fontPath = value(after: "--font"),
        let text = value(after: "--text"),
        let sizeString = value(after: "--size"),
        let size = Double(sizeString)
    else {
        fputs("usage: extract-font-glyphs.swift --font FILE --text TEXT --size N [--weight N] [--tracking N]\n", stderr)
        exit(2)
    }
    return Options(
        fontPath: fontPath,
        text: text,
        size: CGFloat(size),
        weight: Double(value(after: "--weight") ?? "600") ?? 600,
        tracking: CGFloat(Double(value(after: "--tracking") ?? "0") ?? 0)
    )
}

func makeFont(options: Options) -> CTFont {
    let url = URL(fileURLWithPath: options.fontPath) as CFURL
    guard
        let provider = CGDataProvider(url: url),
        let graphicsFont = CGFont(provider)
    else {
        fputs("unable to load font file\n", stderr)
        exit(4)
    }
    let variations = ["Weight": NSNumber(value: options.weight)] as CFDictionary
    let selectedGraphicsFont = graphicsFont.copy(withVariations: variations) ?? graphicsFont
    return CTFontCreateWithGraphicsFont(selectedGraphicsFont, options.size, nil, nil)
}

func number(_ value: CGFloat) -> String {
    let rounded = abs(value) < 0.0005 ? 0 : value
    return String(format: "%.3f", Double(rounded))
}

func svgPathData(_ path: CGPath) -> String {
    var commands: [String] = []
    path.applyWithBlock { elementPointer in
        let element = elementPointer.pointee
        let points = element.points
        switch element.type {
        case .moveToPoint:
            commands.append("M\(number(points[0].x)) \(number(-points[0].y))")
        case .addLineToPoint:
            commands.append("L\(number(points[0].x)) \(number(-points[0].y))")
        case .addQuadCurveToPoint:
            commands.append(
                "Q\(number(points[0].x)) \(number(-points[0].y)) \(number(points[1].x)) \(number(-points[1].y))"
            )
        case .addCurveToPoint:
            commands.append(
                "C\(number(points[0].x)) \(number(-points[0].y)) \(number(points[1].x)) \(number(-points[1].y)) \(number(points[2].x)) \(number(-points[2].y))"
            )
        case .closeSubpath:
            commands.append("Z")
        @unknown default:
            break
        }
    }
    return commands.joined(separator: " ")
}

let options = parseOptions()
let font = makeFont(options: options)
var characters = Array(options.text.utf16)
var glyphs = [CGGlyph](repeating: 0, count: characters.count)
guard CTFontGetGlyphsForCharacters(font, &characters, &glyphs, characters.count) else {
    fputs("font does not contain every requested glyph\n", stderr)
    exit(3)
}
var advances = [CGSize](repeating: .zero, count: glyphs.count)
CTFontGetAdvancesForGlyphs(font, .horizontal, &glyphs, &advances, glyphs.count)

var offset: CGFloat = 0
var paths: [String] = []
for index in glyphs.indices {
    var transform = CGAffineTransform(translationX: offset, y: 0)
    if let path = CTFontCreatePathForGlyph(font, glyphs[index], &transform) {
        paths.append(svgPathData(path))
    }
    offset += advances[index].width
    if index + 1 < glyphs.count {
        offset += options.tracking
    }
}

print("<!-- width=\(number(offset)) ascent=\(number(CTFontGetAscent(font))) descent=\(number(CTFontGetDescent(font))) -->")
for path in paths {
    print("<path d=\"\(path)\"/>")
}
