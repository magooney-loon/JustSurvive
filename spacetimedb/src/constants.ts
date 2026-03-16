// ─── Timing Constants ─────────────────────────────────────────────────────────────
export const TICK_MS = 100n;
export const MICROS_PER_SEC = 1_000_000n;

// ─── Game Rules ─────────────────────────────────────────────────────────────────
export const BOSS_SPAWN_INTERVAL_US = 90_000_000n; // 90 seconds
export const ENEMY_CAP = 36; // 4-player cap; scales down per player count
export const ENEMY_CAP_BY_PLAYERS: Record<number, number> = { 1: 9, 2: 18, 3: 27, 4: 36 };
export const MAX_ENEMIES_PER_PLAYER = 3;
export const ENEMY_DEAD_CLEANUP_US = 5_000_000n; // 5s after death before removal + item drop
export const BOSS_DEAD_CLEANUP_US = 5_000_000n; // 5s after boss death before removal

// ─── Enemy Base Stats ──────────────────────────────────────────────────────────
export const ENEMY_BASE_SPEED: Record<string, bigint> = {
	basic: 3200n,
	fast: 5200n,
	brute: 2100n,
	spitter: 2600n,
	caster: 1400n,
	caster_railgun: 1200n,
	caster_chaingun: 1800n,
	caster_bfg: 5000n,
	caster_shotgun: 1500n,
	jumper: 4800n,
	ogre: 2500n,
	ogre_berserker: 4200n,
	ogre_stalker: 1600n
};

export const ENEMY_HP: Record<string, bigint> = {
	basic: 120n,
	fast: 75n,
	brute: 380n,
	spitter: 150n,
	caster: 120n,
	caster_railgun: 150n,
	caster_chaingun: 90n,
	caster_bfg: 180n,
	caster_shotgun: 110n,
	jumper: 65n,
	ogre: 250n,
	ogre_berserker: 150n,
	ogre_stalker: 350n
};

export const ENEMY_HP_CYCLE_BONUS = 8n; // +8 HP per cycle
export const ENEMY_HP_MAX_MULTIPLIER = 300n; // Hard cap at 3x base HP
export const ENEMY_SPEED_PER_SEC = 2n; // +2% speed per second alive (capped at +50%)
export const TARGET_JITTER = 0.08; // +-8% distance jitter

export const ENEMY_WEIGHTS = [
	{ type: 'basic', weight: 18 },
	{ type: 'fast', weight: 12 },
	{ type: 'brute', weight: 8 },
	{ type: 'spitter', weight: 8 },
	{ type: 'jumper', weight: 8 },
	{ type: 'ogre', weight: 8 },
	{ type: 'caster', weight: 7 },
	{ type: 'caster_chaingun', weight: 6 },
	{ type: 'ogre_berserker', weight: 6 },
	{ type: 'ogre_stalker', weight: 6 },
	{ type: 'caster_railgun', weight: 5 },
	{ type: 'caster_shotgun', weight: 5 },
	{ type: 'caster_bfg', weight: 3 }
];

// ─── Boss Base Stats ───────────────────────────────────────────────────────────
export const BOSS_HP: Record<string, bigint> = {
	ghost_dragon: 2500n,
	worm_monster: 3500n,
	rabid_dog: 1500n,
	scp_096: 2000n,
	terror_reaper: 2200n,
	katze_miu: 3000n
};

export const BOSS_SPEED: Record<string, bigint> = {
	ghost_dragon: 4800n,
	worm_monster: 3500n,
	rabid_dog: 7000n,
	scp_096: 5000n,
	terror_reaper: 3800n,
	katze_miu: 5400n
};

export const BOSS_DAMAGE: Record<string, bigint> = {
	ghost_dragon: 12n,
	worm_monster: 9n,
	rabid_dog: 8n,
	scp_096: 6n,
	terror_reaper: 11n,
	katze_miu: 10n
};

export const BOSS_MELEE_COOLDOWN_US = 500_000n; // 0.5s between melee hits

// ─── Boss: Ghost Dragon ───────────────────────────────────────────────────────
export const GHOST_ABILITY1_COOLDOWN_US = 20_000_000n; // 20s hide & seek
export const GHOST_HIDE_DURATION_US = 3_000_000n; // 3s invisible window
export const GHOST_ABILITY2_COOLDOWN_US = 10_000_000n; // 10s ice ball

// ─── Boss: Worm Monster ────────────────────────────────────────────────────────
export const WORM_ABILITY1_COOLDOWN_US = 12_000_000n; // 12s chain charge
export const WORM_ABILITY2_COOLDOWN_US = 20_000_000n; // 20s burrow
export const WORM_BURROW_DURATION_US = 2_500_000n; // 2.5s underground
export const WORM_CHAIN_RANGE_SQ = 20000n * 20000n; // 20 world units — chain charge hits all players within

// ─── Boss: Rabid Dog ────────────────────────────────────────────────────────────
export const DOG_ABILITY1_COOLDOWN_US = 7_000_000n; // 7s leap
export const DOG_ABILITY2_COOLDOWN_US = 12_000_000n; // 12s stun attack
export const DOG_LEAP_DISTANCE = 2500n; // distance behind player the dog teleports to on leap

// ─── Boss: SCP-096 ────────────────────────────────────────────────────────────
export const SCP096_ABILITY1_COOLDOWN_US = 14_000_000n; // 14s aoe slam (slow)
export const SCP096_ABILITY2_COOLDOWN_US = 9_000_000n; // 9s charge
export const SCP096_AOE_RANGE_SQ = 15000n * 15000n; // 15 world units — AoE slam radius
export const SCP096_CHARGE_INTERVAL_US = 8_000_000n; // 8s period for cycling charge target

// ─── Boss: Terror Reaper ──────────────────────────────────────────────────────
export const REAPER_ABILITY1_COOLDOWN_US = 10_000_000n; // 10s soul drain
export const REAPER_ABILITY2_COOLDOWN_US = 15_000_000n; // 15s death blink
export const REAPER_SOUL_DRAIN_RANGE_SQ = 196_000_000n; // 14 world units — soul drain radius

// ─── Boss: Katze Miu ───────────────────────────────────────────────────────────
export const KATZE_ABILITY1_COOLDOWN_US = 8_000_000n; // 8s uppercut (stun)
export const KATZE_ABILITY2_COOLDOWN_US = 12_000_000n; // 12s fist spin (slow)
export const KATZE_UPPERCUT_RANGE_SQ = 4_000_000n; // 2 world units — uppercut range
export const KATZE_SPIN_RANGE_SQ = 9_000_000n; // 3 world units — fist spin radius

// ─── Boss: Shared Effects ───────────────────────────────────────────────────────
export const BOSS_PLAYER_STUN_US = 1_000_000n; // 1s stun (ice ball)
export const BOSS_PLAYER_LONG_STUN_US = 2_000_000n; // 2s stun (rabid dog)
export const BOSS_PLAYER_SLOW_US = 3_000_000n; // 3s slow (scp_096)

// ─── Combat: Shared ────────────────────────────────────────────────────────────
export const MELEE_RANGE = 2000n;
export const BOSS_MELEE_RANGE = 2200n; // Boss attacks within 2.2 units
export const BOSS_STOP_DIST = 2000n; // Boss stops walking at 2.0 units (visual deadzone)

// Melee hit damage per enemy type (applied per tick when in melee range)
export const MELEE_DAMAGE: Record<string, bigint> = {
	ogre_stalker: 4n,
	brute: 3n,
	ogre_berserker: 3n,
	ogre: 2n,
	default: 1n
};

// ─── Enemy AI: Ranged ─────────────────────────────────────────────────────────
export const SPITTER_RANGE_SQ = 144_000_000n; // 12 world units squared
export const SPITTER_MIN_DIST_SQ = 36_000_000n; // 6 world units — flee closer than this
export const CASTER_RANGE_SQ = 64_000_000n; // 8 world units squared
export const CASTER_MIN_DIST_SQ = 25_000_000n; // 5 world units — flee closer than this
export const SPIT_COOLDOWN_US = 7_000_000n; // 7s between acid spit shots
export const ACID_POOL_LIFETIME_US = 10_000_000n; // 10s before acid pool despawns
export const ACID_POOL_RADIUS = 2000n; // 2 world units radius

// ─── Enemy AI: Melee ───────────────────────────────────────────────────────────
export const STRAFE_MIN_DIST_SQ = 36_000_000n; // 6 world units — don't strafe when this close
export const STRAFE_PERIOD_US = 2_500_000n; // 2.5s per strafe cycle phase

// ─── Player: Movement ──────────────────────────────────────────────────────────
export const SPRINT_STAMINA_DRAIN = 3n; // stamina drained per move tick while sprinting
export const STAMINA_RAMP_TIME_US = 5_000_000n; // 5s to ramp from base to max regen rate
export const STAMINA_REGEN_DELAY_US = 1_000_000n; // 1s delay before stamina regen starts

// Class walk/sprint speed limits (server units per second; validated server-side)
export const CLASS_WALK_SPEED: Record<string, bigint> = {
	spotter: 5000n,
	gunner: 4500n,
	tank: 2500n,
	healer: 5000n
};

export const CLASS_SPRINT_SPEED: Record<string, bigint> = {
	spotter: 9000n,
	gunner: 7500n,
	tank: 3500n,
	healer: 8500n
};

// ─── Class: Spotter ──────────────────────────────────────────────────────────
export const STEADY_SHOT_DAMAGE = 45n;
export const STEADY_SHOT_RANGE_SQ = 529_000_000n; // 23 world units squared
export const STEADY_SHOT_COOLDOWN_US = 1_500_000n; // 1.5s
export const STEADY_SHOT_PIERCE_WIDTH_SQ = 2_250_000n; // 1.5 world units perpendicular pierce width (squared)

export const MARK_DURATION_US = 5_000_000n; // 5s mark duration
export const MARK_DAMAGE_BONUS = 10n; // bonus damage to marked targets from all sources

export const FLASH_CONE_RANGE = 9000; // 9 world units (fixed-point × 1000)
export const FLASH_COOLDOWN_US = 3_000_000n; // 3s cooldown
export const FLASH_STUN_US = 3_500_000n; // 3.5s daze
export const FLASH_DAMAGE = 10n; // damage dealt to flashed enemies
export const FLASH_BOSS_COOLDOWN_US = 7_000_000n; // 7s between flash stuns on the same boss

export const BARRAGE_DAMAGE = 20n; // damage per enemy hit by spotter ultimate

// ─── Class: Gunner ────────────────────────────────────────────────────────────
export const WEAPON_DAMAGE: Record<string, bigint> = {
	gunner: 15n
};

export const GUNNER_ATTACK_RANGE_SQ = 100_000_000n; // 10 world units max shot range (squared)
export const GUNNER_SUPPRESS_COOLDOWN_US = 5_000_000n; // 5s between suppress dazes on bosses
export const GUNNER_SUPPRESS_DAZE_US = 1_000_000n; // 1s daze applied by suppression shot
export const GUNNER_ADRENALINE_COOLDOWN_US = 5_000_000n; // 5s cooldown on adrenaline ability
export const GUNNER_FRENZY_RANGE_SQ = 225_000_000n; // 15 world units — frenzy ultimate radius (squared)
export const GUNNER_FRENZY_DAZE_US = 2_000_000n; // 2s daze applied by frenzy ultimate

// ─── Class: Tank ──────────────────────────────────────────────────────────────
export const AXE_SWING_DAMAGE = 25n;
export const AXE_SWING_RANGE = 4000; // 4 world units (fixed-point × 1000)
export const AXE_SWING_COOLDOWN_US = 500_000n; // 0.5s
export const AXE_SWING_DAZE_US = 1_500_000n; // 1.5s daze
export const AXE_SWING_KNOCKBACK = 4000n;
export const AXE_SWING_SELF_HEAL = 5n; // tank heals 5 HP per enemy hit
export const AXE_BOSS_DAZE_COOLDOWN_US = 4_000_000n; // 4s between axe daze procs on bosses

export const CHARGE_DURATION_US = 700_000n; // 0.7s charge
export const CHARGE_SPEED = 15000n; // 15 units/s (server units/s)
export const CHARGE_COOLDOWN_US = 8_000_000n; // 8s cooldown
export const CHARGE_DAMAGE = 35n; // damage to enemies hit
export const CHARGE_KNOCKBACK = 6000n; // lateral knockback (server units)
export const CHARGE_BOOST_US = 3_000_000n; // 3s speed boost after charge
export const CHARGE_HIT_RADIUS = 2500n; // hit enemies within 2.5 units radius
export const SLAM_DAZE_US = 2_000_000n; // 2s daze applied by ground slam ultimate

export const ULTIMATE_COOLDOWN_US = 35_000_000n; // 35 seconds

// ─── Class: Healer ────────────────────────────────────────────────────────────
export const HEAL_AMOUNT = 30n;
export const HEAL_RANGE_SQ = 100_000_000n; // 10 world units
export const HEAL_COOLDOWN_US = 3_000_000n; // 3s cooldown between heal beam uses

// milliHP per tick (1000 milliHP = 1 HP). Tick = 100ms.
// 2 HP/s base → 200 milliHP/tick; 10 HP/s max → 1000 milliHP/tick
export const HEALER_REGEN_BASE = 200n; // 2 HP/s
export const HEALER_REGEN_MAX = 1000n; // 10 HP/s
export const HEALER_REGEN_RAMP_US = 5_000_000n; // ramp time: 5 seconds without damage

export const REVIVE_COOLDOWN_US = 15_000_000n;
export const REVIVE_CHANNEL_US = 2_000_000n;
export const REVIVE_RANGE_SQ = 9_000_000n; // 3 world units max revive channel range (squared)
export const REVIVE_SHIELD_HP = 80n; // shield absorbs 80 damage before revive is interrupted
export const REVIVE_SHIELD_KNOCKBACK = 5000n; // knockback applied to enemies that hit revive shield
export const REVIVE_SPEED_BOOST_US = 5_000_000n; // 5s speed boost granted after revive
export const HEALER_ULTIMATE_SPEED_BOOST_US = 3_000_000n; // 3s speed boost from healer ultimate

// ─── World: Arena ─────────────────────────────────────────────────────────────
export const ARENA_RADIUS_SRV = 50_000n; // server units — hard wall boundary
export const WALL_SPAWN_RADIUS = 48_500; // world units × 1000, just inside arena wall
export const SPAWN_POINT_COUNT = 8;

// ─── World: Torches ───────────────────────────────────────────────────────────
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

// ─── Items ───────────────────────────────────────────────────────────────────
export const ITEM_PICKUP_RADIUS_SQ = 2_000_000n; // 2 world units radius
export const ITEM_EXPIRE_US = 20_000_000n; // 20 seconds before despawn
export const ITEM_HP_RESTORE = 40n; // HP restored by hp orb
export const ITEM_BUFF_US = 8_000_000n; // 8s double_damage / double_speed buff
// Drop rates (pseudo-random 0–99): hp=8%, stamina=5%, dmg=2%, spd=2%, none=83%
export const ITEM_DROP_HP_MAX = 8;
export const ITEM_DROP_STAMINA_MAX = 13;
export const ITEM_DROP_DMG_MAX = 15;
export const ITEM_DROP_SPD_MAX = 17;

// ─── Day/Night Cycle ──────────────────────────────────────────────────────────
export const DAY_PHASES = ['sunset', 'dusk', 'twilight', 'night', 'deep_night'];
export const DAY_PHASE_DURATION_US = 60_000_000n; // 60s per day/night phase
export const PHASE_REVIVE_SPEED_BOOST_US = 3_000_000n; // 3s speed boost on phase-end auto-revive
