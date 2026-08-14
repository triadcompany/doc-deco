// Study content sometimes carries literal inline colors pasted in from elsewhere
// (e.g. copied from a dark-themed source, or from the app's own dark theme) that
// read fine against the background they were authored for but become illegible
// against the other one — light gray on white, or dark gray on near-black. Strips
// inline `color` styles that don't have enough contrast against the given theme's
// background, falling back to the theme's own (always-readable) text color.

function relativeLuminance(color: string): number | null {
  let r: number, g: number, b: number;

  const rgbMatch = color.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  const hslMatch = color.match(/hsla?\(\s*([\d.]+)[,\s]+([\d.]+)%[,\s]+([\d.]+)%/i);
  const hexMatch = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);

  if (rgbMatch) {
    [r, g, b] = [parseFloat(rgbMatch[1]), parseFloat(rgbMatch[2]), parseFloat(rgbMatch[3])];
  } else if (hslMatch) {
    const h = parseFloat(hslMatch[1]) / 360;
    const s = parseFloat(hslMatch[2]) / 100;
    const l = parseFloat(hslMatch[3]) / 100;
    if (s === 0) {
      r = g = b = l * 255;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      const hue2rgb = (t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      r = hue2rgb(h + 1 / 3) * 255;
      g = hue2rgb(h) * 255;
      b = hue2rgb(h - 1 / 3) * 255;
    }
  } else if (hexMatch) {
    const hex = hexMatch[1];
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    r = parseInt(full.slice(0, 2), 16);
    g = parseInt(full.slice(2, 4), 16);
    b = parseInt(full.slice(4, 6), 16);
  } else {
    return null;
  }

  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// Text lighter than this reads poorly on the app's light-theme white/near-white cards.
const MAX_LUMINANCE_ON_LIGHT = 0.75;
// Text darker than this reads poorly on the app's dark-theme near-black cards.
const MIN_LUMINANCE_ON_DARK = 0.25;

export function sanitizeContentColors(html: string, isDark: boolean): string {
  if (!html) return html;

  const container = document.createElement('div');
  container.innerHTML = html;

  container.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
    const styleAttr = el.getAttribute('style');
    if (!styleAttr) return;
    const match = styleAttr.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
    if (!match) return;

    const luminance = relativeLuminance(match[1].trim());
    if (luminance === null) return;

    const unreadable = isDark ? luminance < MIN_LUMINANCE_ON_DARK : luminance > MAX_LUMINANCE_ON_LIGHT;
    if (!unreadable) return;

    const stripped = styleAttr.replace(/(?:^|;)\s*color\s*:\s*[^;]+;?/i, ';').replace(/^;+|;+$/g, '').trim();
    if (stripped) el.setAttribute('style', stripped);
    else el.removeAttribute('style');
  });

  return container.innerHTML;
}
