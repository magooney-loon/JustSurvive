// ─── Enemy Spawn + Boss Spawn ──────────────────────────────────────────────────
// spawnEnemy: weighted random spawn on the arena wall, rescheduled each call.
// fireBossSpawn: scheduled — kills all regular enemies, spawns the boss.

import { ScheduleAt } from 'spacetimedb';
import { ts } from '../../helpers.js';
import {
	ENEMY_WEIGHTS,
	ENEMY_HP,
	ENEMY_HP_CYCLE_BONUS,
	ENEMY_HP_MAX_MULTIPLIER,
	SPAWN_POINT_COUNT,
	WALL_SPAWN_RADIUS,
	ENEMY_CAP_BY_PLAYERS,
	BOSS_SPAWN_INTERVAL_US,
	BOSS_HP
} from '../../constants.js';

// ─── Debug: Force a specific boss type (set to null for shuffle) ───────────────
const DEBUG_FORCE_BOSS: string | null = 'katze_miu'; // null = use shuffled rotation // 'boss_name' for fixed

// ─── spawn_enemy (scheduled) ──────────────────────────────────────────────────

export function spawnEnemy(ctx: any, { arg }: any) {
	const session = ctx.db.gameSession.id.find(arg.sessionId);
	if (!session || session.status !== 'active') return;

	const players = [...ctx.db.playerState.player_state_session_id.filter(arg.sessionId)].filter(
		(p: any) => p.status === 'alive'
	);
	if (players.length === 0) return;

	const dynamicCap = ENEMY_CAP_BY_PLAYERS[Math.min(players.length, 4)] ?? 12;
	const currentEnemies = [...ctx.db.enemy.enemy_session_id.filter(arg.sessionId)].filter(
		(e: any) => e.isAlive
	);

	const baseInterval = 6_000_000n;
	const minInterval = 1_500_000n;
	const interval = baseInterval - (session.cycleNumber as bigint) * 600_000n;
	const nextInterval = interval < minInterval ? minInterval : interval;

	const nextSpawn = (ctx.timestamp.microsSinceUnixEpoch as bigint) + nextInterval;
	const scheduleNext = () =>
		ctx.db.enemySpawnJob.insert({
			scheduledId: 0n,
			scheduledAt: ScheduleAt.time(nextSpawn),
			sessionId: arg.sessionId
		});

	if (currentEnemies.length >= dynamicCap) {
		scheduleNext();
		return;
	}

	// Pause spawning for 15 seconds after a boss spawns
	const BOSS_SPAWN_PAUSE_US = 15_000_000n;
	const now2 = ctx.timestamp.microsSinceUnixEpoch as bigint;
	for (const b of ctx.db.boss.boss_session_id.filter(arg.sessionId)) {
		if (b.isAlive && b.spawnedAt) {
			const bornAt = b.spawnedAt.microsSinceUnixEpoch as bigint;
			if (now2 - bornAt < BOSS_SPAWN_PAUSE_US) {
				scheduleNext();
				return;
			}
		}
	}

	const seed = Number((ctx.timestamp.microsSinceUnixEpoch as bigint) % 100n);
	let cumWeight = 0;
	let enemyType = 'basic';
	for (const { type, weight } of ENEMY_WEIGHTS) {
		cumWeight += weight;
		if (seed < cumWeight) {
			enemyType = type;
			break;
		}
	}

	const seedBase = (ctx.timestamp.microsSinceUnixEpoch as bigint) + (session.mapSeed as bigint);
	const spawnIdx = Number(seedBase % BigInt(SPAWN_POINT_COUNT));
	const spawnAngle = ((spawnIdx + 0.5) / SPAWN_POINT_COUNT) * Math.PI * 2;
	const spawnX = BigInt(Math.round(Math.cos(spawnAngle) * WALL_SPAWN_RADIUS));
	const spawnZ = BigInt(Math.round(Math.sin(spawnAngle) * WALL_SPAWN_RADIUS));

	const baseMultiplier = 100n + (session.cycleNumber as bigint) * 5n;
	const hpBonus = (session.cycleNumber as bigint) * ENEMY_HP_CYCLE_BONUS;
	const baseHp = ENEMY_HP[enemyType] ?? 50n;
	const maxHp = baseHp + hpBonus;
	const maxCap = (baseHp * ENEMY_HP_MAX_MULTIPLIER) / 100n;
	const cappedHp = maxHp > maxCap ? maxCap : maxHp;

	ctx.db.enemy.insert({
		id: 0n,
		sessionId: arg.sessionId,
		enemyType,
		hp: cappedHp,
		maxHp: cappedHp,
		posX: spawnX,
		posZ: spawnZ,
		speedMultiplier: baseMultiplier,
		isDazed: false,
		dazedUntil: undefined,
		isAlive: true,
		isMarked: false,
		markedUntil: undefined,
		lastSpitAt: undefined,
		diedAt: undefined,
		spawnedAt: ts(ctx.timestamp.microsSinceUnixEpoch as bigint)
	});

	scheduleNext();
}

// ─── Deterministic boss shuffle ───────────────────────────────────────────────
// Fisher-Yates over 6 elements using a 64-bit LCG seeded by mapSeed ^ cycleNum.
// Guarantees all 6 boss types appear before any repeats, in a different order
// each cycle so the sequence is never predictable.

function shuffledBossTypes(seed: bigint): string[] {
	const arr = [
		'ghost_dragon',
		'worm_monster',
		'rabid_dog',
		'scp_096',
		'terror_reaper',
		'katze_miu'
	];
	// Knuth LCG — good avalanche for small sequences
	let s = seed ^ 0xdeadbeefcafe1234n;
	const next = () => {
		s = (s * 6364136223846793005n + 1442695040888963407n) & 0xffffffffffffffffn;
		return s;
	};
	for (let i = 5; i > 0; i--) {
		const j = Number(next() % BigInt(i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

// ─── fire_boss_spawn (scheduled) ──────────────────────────────────────────────

export function fireBossSpawn(ctx: any, { arg }: any) {
	const session = ctx.db.gameSession.id.find(arg.sessionId);
	if (!session || session.status !== 'active') return;

	// Only spawn if no boss is currently alive
	for (const b of ctx.db.boss.boss_session_id.filter(arg.sessionId)) {
		if (b.isAlive) return;
	}

	const now = ctx.timestamp.microsSinceUnixEpoch as bigint;

	// Delete the countdown timer
	for (const bt of ctx.db.bossTimer.boss_timer_session_id.filter(arg.sessionId)) {
		ctx.db.bossTimer.id.delete(bt.id);
	}

	// Cycle through all 6 boss types in a shuffled order before repeating.
	// bossSpawnCount tracks total bosses spawned across the whole session.
	const spawnCount = session.bossSpawnCount as bigint;

	// Scale boss HP by player count — tighter range so solo isn't trivial, 4p isn't absurd
	const totalPlayers = [...ctx.db.playerState.player_state_session_id.filter(arg.sessionId)];
	const PLAYER_SCALE_TABLE: Record<number, bigint> = { 1: 80n, 2: 100n, 3: 120n, 4: 140n };
	const playerScale = PLAYER_SCALE_TABLE[Math.min(totalPlayers.length, 4)] ?? 100n;

	// 5% HP increase per boss spawn (capped at +50%)
	const rawBonus = spawnCount * 5n;
	const spawnBonus = 100n + (rawBonus > 50n ? 50n : rawBonus); // 100%…150% max

	const cycleNum = spawnCount / 6n; // which 6-boss cycle we're in
	const posInCycle = spawnCount % 6n; // slot within that cycle (0–5)
	const shuffleSeed = (session.mapSeed as bigint) ^ cycleNum;
	const bossType = DEBUG_FORCE_BOSS ?? shuffledBossTypes(shuffleSeed)[Number(posInCycle)];

	const baseHp = BOSS_HP[bossType] ?? 1500n;
	const hp = (baseHp * playerScale * spawnBonus) / (100n * 100n);

	ctx.db.boss.insert({
		id: 0n,
		sessionId: arg.sessionId,
		bossType,
		hp,
		maxHp: hp,
		posX: 0n,
		posZ: 0n,
		phase: 0n,
		isAlive: true,
		isDazed: false,
		dazedUntil: undefined,
		isMarked: false,
		markedUntil: undefined,
		spawnedAt: ts(now),
		diedAt: undefined,
		ability1CooldownUntil: undefined,
		ability2CooldownUntil: undefined,
		isHidden: false,
		isBurrowed: false
	});

	ctx.db.gameSession.id.update({ ...session, bossSpawnCount: spawnCount + 1n });
}
