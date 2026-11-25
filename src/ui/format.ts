export const TYPE_COLORS: Record<string, string> = {
  Normal: '#9fa19f', Fire: '#e62829', Water: '#2980ef', Electric: '#f4c01a', Grass: '#3fa129',
  Ice: '#3dcef3', Fighting: '#ff8000', Poison: '#9141cb', Ground: '#915121', Flying: '#81b9ef',
  Psychic: '#ef4179', Bug: '#91a119', Rock: '#afa981', Ghost: '#704170', Dragon: '#5060e1',
  Dark: '#624d4e', Steel: '#60a1b8', Fairy: '#ef70ef', Stellar: '#40b5a5', '???': '#68a090',
};

export const STATUS_LABELS: Record<string, string> = {
  brn: 'BRN', par: 'PAR', slp: 'SLP', frz: 'FRZ', psn: 'PSN', tox: 'TOX',
};

const BOOST_LABELS: Record<string, string> = {
  atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe', accuracy: 'Acc', evasion: 'Eva',
};

export function boostLabel(stat: string, n: number) {
  return `${n > 0 ? '+' : ''}${n} ${BOOST_LABELS[stat] ?? stat}`;
}

export function hpPercent(hp: number, maxhp: number) {
  return maxhp ? Math.max(0, Math.min(100, (hp / maxhp) * 100)) : 0;
}

export function hpColor(pct: number) {
  return pct > 50 ? 'var(--hp-high)' : pct > 20 ? 'var(--hp-mid)' : 'var(--hp-low)';
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map(i => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Background and readable text color for a type's badge (falls back to gray). */
export function typeStyle(type: string) {
  const background = TYPE_COLORS[type] ?? '#71717a';
  const color = textOn(background);
  return {background, color, textShadow: color === '#ffffff' ? undefined : 'none'};
}

/** Near-black or white, whichever reads better on `hex` (WCAG contrast). */
export function textOn(hex: string) {
  const l = luminance(hex);
  const vsWhite = 1.05 / (l + 0.05);
  const vsDark = (l + 0.05) / (luminance('#18181b') + 0.05);
  return vsDark > vsWhite ? '#18181b' : '#ffffff';
}
