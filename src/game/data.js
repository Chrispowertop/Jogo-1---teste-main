// Status base do jogador, tipos de zumbi e lista de upgrades.
export const baseStats = () => ({
    maxHp: 100, speed: 185, dmg: 14, cd: 0.46, range: 86, arc: 72, // arc = meio-ângulo em graus
    crit: 0.06, critMul: 2, knock: 300, magnet: 95, regen: 0, lifesteal: 0,
    armor: 0, xpMul: 1, spin: 0, knives: 0, fire: 0, dashCd: 2.4,
});

// h = altura aproximada do sprite (para acertar o "corpo")
export const ZOMBIES = {
    walker: { hp: 30,  speed: 50,  dmg: 8,  scale: 0.80, xp: 1,  tint: 0xffffff, r: 9,  mass: 1,   h: 66 },
    runner: { hp: 18,  speed: 108, dmg: 6,  scale: 0.70, xp: 1,  tint: 0xa8ffa8, r: 8,  mass: 0.7, h: 58 },
    brute:  { hp: 150, speed: 36,  dmg: 18, scale: 1.20, xp: 6,  tint: 0xff9a8a, r: 14, mass: 3,   h: 100 },
    boss:   { hp: 700, speed: 46,  dmg: 28, scale: 1.90, xp: 50, tint: 0xc9a0ff, r: 22, mass: 12,  h: 150 },
};

export const UPGRADES = [
    { id: 'dmg',   icon: '⚔️', name: 'Lâmina Afiada',     max: 10, desc: '+25% de dano da espada',            apply: s => { s.dmg *= 1.25; } },
    { id: 'spd',   icon: '⚡', name: 'Golpes Rápidos',    max: 8,  desc: '-12% no tempo entre golpes',         apply: s => { s.cd = Math.max(0.14, s.cd * 0.88); } },
    { id: 'rng',   icon: '📏', name: 'Alcance Longo',     max: 6,  desc: '+15% de alcance da espada',          apply: s => { s.range *= 1.15; } },
    { id: 'arc',   icon: '🌙', name: 'Arco Amplo',        max: 4,  desc: '+18° de abertura do golpe',          apply: s => { s.arc += 18; } },
    { id: 'move',  icon: '👢', name: 'Botas Velozes',     max: 6,  desc: '+10% de velocidade de movimento',    apply: s => { s.speed *= 1.10; } },
    { id: 'hp',    icon: '❤️', name: 'Coração Forte',     max: 8,  desc: '+25 de vida máxima e cura 25',       apply: (s, l, g) => { s.maxHp += 25; g.heal(25); } },
    { id: 'regen', icon: '🌿', name: 'Regeneração',       max: 5,  desc: '+0.8 de vida por segundo',           apply: s => { s.regen += 0.8; } },
    { id: 'mag',   icon: '🧲', name: 'Ímã de Almas',      max: 5,  desc: '+40% de raio para coletar gemas',    apply: s => { s.magnet *= 1.4; } },
    { id: 'crit',  icon: '🎯', name: 'Golpe Crítico',     max: 6,  desc: '+8% de chance crítica (dano x2)',    apply: s => { s.crit += 0.08; } },
    { id: 'life',  icon: '🩸', name: 'Sede de Sangue',    max: 5,  desc: 'Recupera 3% do dano causado',        apply: s => { s.lifesteal += 0.03; } },
    { id: 'knock', icon: '💥', name: 'Repulsão',          max: 5,  desc: '+40% de empurrão nos zumbis',        apply: s => { s.knock *= 1.4; } },
    { id: 'armor', icon: '🛡️', name: 'Armadura',          max: 5,  desc: '-8% de dano recebido',               apply: s => { s.armor = Math.min(0.6, s.armor + 0.08); } },
    { id: 'xp',    icon: '📖', name: 'Sabedoria',         max: 5,  desc: '+20% de experiência',                apply: s => { s.xpMul += 0.2; } },
    { id: 'dash',  icon: '💨', name: 'Fôlego de Ferro',   max: 4,  desc: 'Esquiva (Shift) recarrega 20% mais rápido', apply: s => { s.dashCd *= 0.8; } },
    { id: 'spin',  icon: '🌀', name: 'Redemoinho',        max: 5,  desc: 'Giro automático de 360° a cada poucos segundos', apply: s => { s.spin++; } },
    { id: 'knife', icon: '🗡️', name: 'Facas Arremessadas', max: 5, desc: 'Lança facas automáticas no inimigo mais próximo', apply: s => { s.knives++; } },
    { id: 'fire',  icon: '🔥', name: 'Aura de Fogo',      max: 5,  desc: 'Queima zumbis que chegam perto',     apply: s => { s.fire++; } },
];
