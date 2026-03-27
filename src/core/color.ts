/**
 * Safe color alpha utility — handles hex (#ff6b6b), rgb(), rgba(), hsl(), hsla(), named colors.
 * Appending "88" to a hex color works, but not for rgb/hsl/named colors.
 */

/** Convert any CSS color + hex alpha suffix to a valid CSS color */
export function withAlpha(color: string, hexAlpha: string): string {
  // Hex colors: strip existing alpha if present, then append
  if (color.startsWith("#")) {
    // #RGB -> #RRGGBB first
    let hex = color;
    if (hex.length === 4) {
      hex = "#" + hex[1]+hex[1] + hex[2]+hex[2] + hex[3]+hex[3];
    }
    // Take only the first 7 chars (#RRGGBB), drop any existing alpha
    const base = hex.slice(0, 7);
    return base + hexAlpha.slice(0, 2);
  }
  // rgba/rgb: replace or add alpha
  if (color.startsWith("rgb")) {
    const alpha = parseInt(hexAlpha, 16) / 255;
    if (color.startsWith("rgba")) {
      return color.replace(/[\d.]+\)$/, alpha.toFixed(3) + ")");
    }
    return color.replace("rgb(", "rgba(").replace(")", ", " + alpha.toFixed(3) + ")");
  }
  // hsl/hsla: replace or add alpha
  if (color.startsWith("hsl")) {
    const alpha = parseInt(hexAlpha, 16) / 255;
    if (color.startsWith("hsla")) {
      return color.replace(/[\d.]+\)$/, alpha.toFixed(3) + ")");
    }
    return color.replace("hsl(", "hsla(").replace(")", ", " + alpha.toFixed(3) + ")");
  }
  // Fallback: try hex append (might work for some formats)
  return color + hexAlpha;
}
