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
