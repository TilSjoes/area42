/**
 * Safe color alpha utility — handles hex (#ff6b6b), rgb(), rgba(), hsl(), hsla(), named colors.
 * Appending "88" to a hex color works, but not for rgb/hsl/named colors.
 */

/** Convert any CSS color + hex alpha suffix to a valid CSS color */
export function withAlpha(color: string, hexAlpha: string): string {
  // Hex colors: just append
  if (color.startsWith("#")) {
    return color + hexAlpha;
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
