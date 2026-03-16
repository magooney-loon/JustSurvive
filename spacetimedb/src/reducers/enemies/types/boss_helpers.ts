// ─── Boss Shared Helpers ───────────────────────────────────────────────────────
// Extracted into a separate file to avoid circular imports:
//   boss.ts  →  bosses/*.ts  →  boss_helpers.ts  (no cycle)

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
