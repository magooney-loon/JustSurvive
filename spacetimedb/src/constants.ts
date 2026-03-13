// ─── Enemy Constants ──────────────────────────────────────────────────────────

export const ENEMY_BASE_SPEED: Record<string, bigint> = {
	basic: 3200n,
	fast: 5200n,
	brute: 2100n,
	spitter: 1700n,
	caster: 1400n
};

export const ENEMY_CAP = 26;
export const MELEE_RANGE = 2000n;
export const SPITTER_RANGE_SQ = 144_000_000n; // 12 world units squared
export const CASTER_RANGE_SQ = 64_000_000n; // 8 world units squared
export const TICK_MS = 100n;
export const MAX_ENEMIES_PER_PLAYER = 3;
export const TARGET_JITTER = 0.08; // +-8% distance jitter
export const ENEMY_SPEED_PER_SEC = 2n; // +2% speed per second alive (capped at +50%)

export const ENEMY_WEIGHTS = [
	{ type: 'basic', weight: 57 },
	{ type: 'fast', weight: 24 },
	{ type: 'brute', weight: 10 },
	{ type: 'spitter', weight: 5 },
	{ type: 'caster', weight: 4 }
];

export const ENEMY_HP: Record<string, bigint> = {
	basic: 80n,
	fast: 50n,
	brute: 250n,
	spitter: 100n,
	caster: 80n
};

export const ENEMY_HP_CYCLE_BONUS = 5n; // +5 HP per cycle
export const ENEMY_HP_MAX_MULTIPLIER = 300n; // Hard cap at 3x base HP

// ─── World Constants ──────────────────────────────────────────────────────────

export const DAY_PHASES = ['sunset', 'dusk', 'twilight', 'night', 'deep_night'];

// ─── Combat Constants ─────────────────────────────────────────────────────────

export const WEAPON_DAMAGE: Record<string, bigint> = {
	gunner: 15n,
	healer: 35n
};

export const HEAL_AMOUNT = 30n;
export const HEAL_RANGE_SQ = 100_000_000n; // 10 units

export const REVIVE_COOLDOWN_US = 15_000_000n;
export const REVIVE_CHANNEL_US = 2_000_000n;
