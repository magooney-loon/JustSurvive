// ─── Boss AI Handler ───────────────────────────────────────────────────────────
// Shared helpers (bossAgeSec, bossMove, bossAttack) used by all per-boss files.
// handleBoss is the main entry point called by tick.ts.
//
// Per-boss logic lives in:
//   bosses/ghost_dragon.ts   — hide & seek + ice ball
//   bosses/worm_monster.ts   — chain charge + burrow
//   bosses/rabid_dog.ts      — leap + stun attack
//   bosses/scp_096.ts        — aoe slam + random charge
//   bosses/terror_reaper.ts  — soul drain + death blink

import { bigintSqrt as bs } from '../../../helpers.js';
import {
	BOSS_MELEE_RANGE,
	BOSS_STOP_DIST,
	BOSS_MELEE_COOLDOWN_US,
	BOSS_DAMAGE,
	BOSS_SPEED,
	ENEMY_SPEED_PER_SEC,
	TICK_MS
} from '../../../constants.js';
import { enemyMoveAvoid } from '../movement.js';
import { handleGhostDragon } from './bosses/ghost_dragon.js';
import { handleWormMonster } from './bosses/worm_monster.js';
import { handleRabidDog } from './bosses/rabid_dog.js';
import { handleScp096 } from './bosses/scp_096.js';
import { handleTerrorReaper } from './bosses/terror_reaper.js';

export function bossAgeSec(boss: any, now: bigint): number {
	return boss.spawnedAt
		? Number(now - (boss.spawnedAt.microsSinceUnixEpoch as bigint)) / 1_000_000
		: 0;
}

export function bossMove(
	ctx: any,
	boss: any,
	dx: bigint,
	dz: bigint,
	distSq: bigint,
	speedMultiplier: bigint,
	now: bigint
) {
	const ageSec = bossAgeSec(boss, now);
	if (ageSec < 2) return boss; // Wait 2s before moving
	if (distSq <= BOSS_STOP_DIST * BOSS_STOP_DIST) return boss; // Deadzone — don't walk into player
	const timeBonus = BigInt(Math.min(30, Math.floor(ageSec * Number(ENEMY_SPEED_PER_SEC))));
	const baseSpeed = BOSS_SPEED[boss.bossType] ?? 4000n;
	const isEnraged = (boss.phase as bigint) === 1n;
	const enrageBonus = isEnraged ? 13n : 10n;
	const speed =
		(baseSpeed * enrageBonus * speedMultiplier * (100n + timeBonus)) / (10n * 100n * 100n);
	const moveAmount = (speed * TICK_MS) / 1000n;
	const magnitude = bs(distSq);
	if (magnitude === 0n) return boss;
	const nx = (boss.posX as bigint) + (dx * moveAmount) / magnitude;
	const nz = (boss.posZ as bigint) + (dz * moveAmount) / magnitude;
	const [ax, az] = enemyMoveAvoid(boss.posX, boss.posZ, nx, nz);
	if (ax !== boss.posX || az !== boss.posZ) {
		const updated = { ...boss, posX: ax, posZ: az };
		ctx.db.boss.id.update(updated);
		return updated;
	}
	return boss;
}

export function bossAttack(
	boss: any,
	chosen: any,
	dx: bigint,
	dz: bigint,
	distSq: bigint,
	damageAccum: Map<bigint, bigint>,
	now: bigint,
	playerScale: bigint = 100n
) {
	// Out of range — keep chasing
	const range = BOSS_MELEE_RANGE;
	if (distSq > range * range) return false;

	// In range: always stop moving (return true).
	// Rate-limit actual damage — fires ~20% of ticks so the boss "swings" at a steady cadence.
	const tickUs = TICK_MS * 1000n;
	if (now % BOSS_MELEE_COOLDOWN_US < tickUs) {
		const isEnraged = (boss.phase as bigint) === 1n;
		const baseDamage = BOSS_DAMAGE[boss.bossType] ?? 4n;
		const damage = ((isEnraged ? (baseDamage * 3n) / 2n : baseDamage) * playerScale) / 100n;
		damageAccum.set(chosen.id as bigint, (damageAccum.get(chosen.id as bigint) ?? 0n) + damage);
	}
	return true;
}

// ─── Main entry point ──────────────────────────────────────────────────────────
export function handleBoss(
	ctx: any,
	boss: any,
	players: any[],
	now: bigint,
	damageAccum: Map<bigint, bigint>,
	sessionId: bigint,
	playerScale: bigint = 100n
): void {
	if (players.length === 0) return;

	// Phase transition: enrage at 20% HP
	const currentPhase = boss.phase as bigint;
	const shouldEnrage = (boss.hp as bigint) <= (boss.maxHp as bigint) / 5n;
	if (currentPhase === 0n && shouldEnrage) {
		boss = { ...boss, phase: 1n };
		ctx.db.boss.id.update(boss);
	}

	// Daze expiry
	if (boss.isDazed && boss.dazedUntil && now >= (boss.dazedUntil.microsSinceUnixEpoch as bigint)) {
		boss = { ...boss, isDazed: false };
		ctx.db.boss.id.update(boss);
	}

	const ageSec = bossAgeSec(boss, now);
	const abilitiesLocked = ageSec < 5;

	switch (boss.bossType as string) {
		case 'ghost_dragon':
			handleGhostDragon(ctx, boss, players, now, damageAccum, abilitiesLocked, playerScale);
			break;
		case 'worm_monster':
			handleWormMonster(ctx, boss, players, now, damageAccum, abilitiesLocked, playerScale);
			break;
		case 'rabid_dog':
			handleRabidDog(ctx, boss, players, now, damageAccum, abilitiesLocked, playerScale);
			break;
		case 'scp_096':
			handleScp096(ctx, boss, players, now, damageAccum, abilitiesLocked, playerScale);
			break;
		case 'terror_reaper':
			handleTerrorReaper(ctx, boss, players, now, damageAccum, abilitiesLocked, playerScale);
			break;
	}
}
