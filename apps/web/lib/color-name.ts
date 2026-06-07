/**
 * Deterministic hex → human colour name (English + Arabic).
 *
 * Used as a fallback when the AI returns a colour swatch (hex) but no name —
 * common for busy prints where the model won't commit to a single word. Every
 * detected colour then still gets a readable, bilingual label so the admin
 * picker and the storefront swatches are never blank.
 *
 * Pure + client-safe (no server-only imports). Classifies in HSL space — hue
 * first, with lightness/saturation gating white/black/gray — because plain RGB
 * distance mislabels pastels (a pale green sits numerically near light gray).
 */

export type ColorName = { en: string; ar: string }

/** Parse `#rgb` or `#rrggbb` to 0–255 components, or `null` if malformed. */
function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  let h = m[1]!
  if (h.length === 3) h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

/** RGB (0–255) → HSL with h in degrees [0,360), s and l in [0,1]. */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return [0, 0, l]
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  h *= 60
  if (h < 0) h += 360
  return [h, s, l]
}

const C = (en: string, ar: string): ColorName => ({ en, ar })

/**
 * Map a hue (degrees) to a base colour name, choosing a light/dark/desaturated
 * variant from lightness `l` and saturation `s`.
 */
function nameForHue(h: number, s: number, l: number): ColorName {
  // Red
  if (h < 15 || h >= 345) {
    if (l > 0.75) return C("Pink", "وردي")
    if (l < 0.3) return C("Maroon", "عنابي")
    return C("Red", "أحمر")
  }
  // Orange / brown / beige
  if (h < 45) {
    if (l < 0.35) return C("Brown", "بني")
    if (l > 0.8 && s < 0.5) return C("Beige", "بيج")
    if (l > 0.7) return C("Peach", "خوخي")
    return C("Orange", "برتقالي")
  }
  // Yellow / gold / cream
  if (h < 65) {
    if (l > 0.85) return C("Cream", "كريمي")
    if (l < 0.45) return C("Gold", "ذهبي")
    return C("Yellow", "أصفر")
  }
  // Yellow-green → olive / light green
  if (h < 90) {
    if (l < 0.4) return C("Olive", "زيتوني")
    return C("Light Green", "أخضر فاتح")
  }
  // Green
  if (h < 160) {
    if (s < 0.35) return C("Sage", "مريمي")
    if (l > 0.7) return C("Mint", "نعناعي")
    if (l < 0.3) return C("Dark Green", "أخضر داكن")
    return C("Green", "أخضر")
  }
  // Teal / cyan
  if (h < 200) {
    if (l > 0.75) return C("Aqua", "أزرق فاتح")
    return C("Teal", "أزرق مخضر")
  }
  // Blue
  if (h < 250) {
    if (l > 0.75) return C("Sky Blue", "أزرق سماوي")
    if (l < 0.3) return C("Navy", "كحلي")
    return C("Blue", "أزرق")
  }
  // Purple / violet
  if (h < 290) {
    if (l > 0.75) return C("Lavender", "خزامي")
    return C("Purple", "أرجواني")
  }
  // Magenta / pink-purple
  if (l > 0.75) return C("Lilac", "أرجواني فاتح")
  return C("Magenta", "أرجواني وردي")
}

/**
 * Nearest readable name for a hex. Returns `null` when the hex can't be parsed,
 * so callers can decide whether to skip the colour entirely.
 */
export function hexToColorName(hex: string): ColorName | null {
  const rgb = parseHex(hex)
  if (!rgb) return null
  const [h, s, l] = rgbToHsl(rgb.r, rgb.g, rgb.b)

  // Achromatic gates first: very light / dark, or low saturation → neutrals.
  if (l >= 0.93) return C("White", "أبيض")
  if (l <= 0.07) return C("Black", "أسود")
  if (s <= 0.12) {
    if (l > 0.7) return C("Light Gray", "رمادي فاتح")
    if (l < 0.3) return C("Charcoal", "فحمي")
    return C("Gray", "رمادي")
  }
  return nameForHue(h, s, l)
}
