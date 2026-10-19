import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Parse the four theme blocks from theme.css. The default block also holds shared tokens.
const css = readFileSync(new URL('../../web/src/lib/theme.css', import.meta.url), 'utf8');
const themes = new Map<string, Record<string, string>>();
for (const m of css.matchAll(/:root(?:\[data-theme="(\w+)"\])?\s*\{([^}]*)\}/g)) {
  const tokens = Object.fromEntries([...m[2].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map(x => [x[1], x[2]]));
  if (tokens.bg) themes.set(m[1] ?? 'terminal', tokens);
}

const lum = (hex: string) => {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(x => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const TEXT = ['text', 'muted', 'dim', 'ok', 'rest', 'miss', 'l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8', 'l9', 'l10'];

describe('theme contrast (WCAG AA)', () => {
  it('finds all four themes', () => {
    expect([...themes.keys()].sort()).toEqual(['bathory', 'gruvbox', 'paper', 'terminal']);
  });
  for (const [name, t] of themes) {
    it(`${name}: text tokens reach 4.5:1 on bg and surface`, () => {
      const bad = TEXT.flatMap(k => ['bg', 'surface'].map(bg => [k, bg, ratio(t[k], t[bg])] as const)).filter(([, , r]) => r < 4.5);
      expect(bad.map(([k, bg, r]) => `${k}/${bg} ${r.toFixed(2)}`)).toEqual([]);
    });
    it(`${name}: button text reaches 4.5:1 on ok`, () => {
      expect(ratio(t['on-ok'], t.ok)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
