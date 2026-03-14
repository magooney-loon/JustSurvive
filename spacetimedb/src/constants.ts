// ─── Enemy Constants ──────────────────────────────────────────────────────────

export const ENEMY_BASE_SPEED: Record<string, bigint> = {
	basic: 3200n,
	fast: 5200n,
	brute: 2100n,
	spitter: 1700n,
	caster: 1400n
};

export const ENEMY_CAP = 36; // 4-player cap; scales down per player count
export const ENEMY_CAP_BY_PLAYERS: Record<number, number> = { 1: 12, 2: 18, 3: 27, 4: 36 };
export const MELEE_RANGE = 2000n;
export const BOSS_MELEE_RANGE = 4000n; // Boss stops 4 units away
export const SPITTER_RANGE_SQ = 144_000_000n; // 12 world units squared
export const SPITTER_MIN_DIST_SQ = 36_000_000n; // 6 world units — flee closer than this
export const CASTER_RANGE_SQ = 64_000_000n; // 8 world units squared
export const CASTER_MIN_DIST_SQ = 25_000_000n; // 5 world units — flee closer than this
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
	basic: 120n,
	fast: 75n,
	brute: 380n,
	spitter: 150n,
	caster: 120n
};

export const BOSS_SPAWN_INTERVAL_US = 90_000_000n; // 90 seconds

export const BOSS_HP: Record<string, bigint> = {
	ghost_dragon: 1800n,
	root_colossus: 2800n,
	shadow_stalker: 1200n,
	plague_shaman: 1500n
};

export const BOSS_SPEED: Record<string, bigint> = {
	ghost_dragon: 180n,
	root_colossus: 80n,
	shadow_stalker: 250n,
	plague_shaman: 120n
};

export const BOSS_DAMAGE: Record<string, bigint> = {
	ghost_dragon: 7n,
	root_colossus: 14n,
	shadow_stalker: 5n,
	plague_shaman: 4n
};

export const ENEMY_HP_CYCLE_BONUS = 8n; // +8 HP per cycle
export const ENEMY_HP_MAX_MULTIPLIER = 300n; // Hard cap at 3x base HP

// ─── World Constants ──────────────────────────────────────────────────────────

export const DAY_PHASES = ['sunset', 'dusk', 'twilight', 'night', 'deep_night'];

// ─── Combat Constants ─────────────────────────────────────────────────────────

export const WEAPON_DAMAGE: Record<string, bigint> = {
	gunner: 15n
};

export const HEAL_AMOUNT = 30n;
export const HEAL_RANGE_SQ = 100_000_000n; // 10 units

export const REVIVE_COOLDOWN_US = 15_000_000n;
export const REVIVE_CHANNEL_US = 2_000_000n;

// ─── Spotter: Steady Shot ─────────────────────────────────────────────────────
export const STEADY_SHOT_DAMAGE = 45n;
export const STEADY_SHOT_RANGE_SQ = 529_000_000n; // 23 units sq
export const STEADY_SHOT_COOLDOWN_US = 1_500_000n; // 1.5s (halved from 3s)
export const MARK_DURATION_US = 5_000_000n; // 5s mark duration
export const MARK_DAMAGE_BONUS = 10n; // bonus damage to marked targets from all sources

// ─── Spotter: Flash Cone ─────────────────────────────────────────────────────
export const FLASH_CONE_RANGE = 9000; // 9 world units (fixed-point × 1000)
export const FLASH_COOLDOWN_US = 3_000_000n; // 3s cooldown
export const FLASH_STUN_US = 3_500_000n; // 3.5s daze
export const FLASH_DAMAGE = 10n; // damage dealt to flashed enemies

// ─── Tank: Axe Swing ─────────────────────────────────────────────────────────
export const AXE_SWING_DAMAGE = 25n;
export const AXE_SWING_RANGE = 4000; // 4 world units (fixed-point × 1000)
export const AXE_SWING_COOLDOWN_US = 500_000n; // 0.5s
export const AXE_SWING_DAZE_US = 1_500_000n; // 1.5s daze
export const AXE_SWING_KNOCKBACK = 4000n;
export const AXE_SWING_SELF_HEAL = 5n; // tank heals 5 HP per enemy hit

// ─── Tank: Brace ─────────────────────────────────────────────────────────────
export const BRACE_HEAL_PER_TICK = 3n; // 3 HP per 100ms tick while bracing (~30 HP/s)
export const ULTIMATE_COOLDOWN_US = 35_000_000n; // 35 seconds

// ─── Healer: Revive Shield ────────────────────────────────────────────────────
export const REVIVE_SHIELD_HP = 80n; // shield absorbs 80 damage before revive is interrupted
export const REVIVE_SHIELD_KNOCKBACK = 5000n; // knockback applied to enemies that hit revive shield

// ─── Torch Collision ──────────────────────────────────────────────────────────
// Must match frontend TORCH_RINGS in GameGround.svelte (radius × 1000 = srv units)
export const TORCH_RINGS_SRV = [
	{ count: 12, r: 48_500 },
	{ count: 7, r: 33_000 },
	{ count: 4, r: 18_000 }
] as const;
export const TORCH_COLLISION_SQ = 640_000n; // 0.8 world units radius

// Fixed torch positions (server units = world × 1000) — hardcoded to avoid float drift
export const TORCH_POSITIONS_SRV: ReadonlyArray<{ x: bigint; z: bigint }> = [
	// Wall ring — 12 torches at r=48500
	{ x: 48500n, z: 0n },
	{ x: 42002n, z: 24250n },
	{ x: 24250n, z: 42002n },
	{ x: 0n, z: 48500n },
	{ x: -24250n, z: 42002n },
	{ x: -42002n, z: 24250n },
	{ x: -48500n, z: 0n },
	{ x: -42002n, z: -24250n },
	{ x: -24250n, z: -42002n },
	{ x: 0n, z: -48500n },
	{ x: 24250n, z: -42002n },
	{ x: 42002n, z: -24250n },
	// Mid ring — 7 torches at r=33000
	{ x: 33000n, z: 0n },
	{ x: 20575n, z: 25800n },
	{ x: -7343n, z: 32173n },
	{ x: -29732n, z: 14318n },
	{ x: -29732n, z: -14318n },
	{ x: -7343n, z: -32173n },
	{ x: 20575n, z: -25800n },
	// Inner ring — 4 torches at r=18000
	{ x: 18000n, z: 0n },
	{ x: 0n, z: 18000n },
	{ x: -18000n, z: 0n },
	{ x: 0n, z: -18000n }
];

// ─── Spawn Points ─────────────────────────────────────────────────────────────
export const SPAWN_POINT_COUNT = 8;
export const WALL_SPAWN_RADIUS = 48_500; // world units × 1000, just inside arena wall
export const ARENA_RADIUS_SRV = 50_000n; // server units — hard wall boundary
