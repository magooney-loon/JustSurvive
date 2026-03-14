// ─── Spitter AI Handler ────────────────────────────────────────────────────────
// Ranged acid spit + kiting movement. Called from enemies/tick.ts.

import { ts, bigintSqrt as bs } from '../../../helpers.js';
import {
	SPITTER_RANGE_SQ,
	SPITTER_MIN_DIST_SQ,
	ENEMY_BASE_SPEED,
	ENEMY_SPEED_PER_SEC,
	TICK_MS
} from '../../../constants.js';
import { enemyMoveAvoid } from '../movement.js';

export function handleSpitter(
	ctx: any,
	enemy: any,
	chosen: any,
	dx: bigint,
	dz: bigint,
	chosenDist: bigint,
	now: bigint,
	damageAccum: Map<bigint, bigint>,
	sessionId: bigint
): void {
	const SPIT_COOLDOWN_US = 7_000_000n;
	const canSpit =
		!enemy.lastSpitAt ||
		now >= (enemy.lastSpitAt.microsSinceUnixEpoch as bigint) + SPIT_COOLDOWN_US;

	if (chosenDist <= SPITTER_RANGE_SQ && !enemy.isDazed && canSpit) {
		const poolExpiry = now + 10_000_000n;
		ctx.db.acidPool.insert({
			id: 0n,
			sessionId,
			posX: enemy.posX + dx / 2n,
			posZ: enemy.posZ + dz / 2n,
			radius: 2000n,
			expiresAt: ts(poolExpiry)
		});
		ctx.db.enemy.id.update({ ...enemy, lastSpitAt: ts(now) });
	} else if (!enemy.isDazed) {
		const ageSec = enemy.spawnedAt
			? Number(now - (enemy.spawnedAt.microsSinceUnixEpoch as bigint)) / 1_000_000
			: 0;
		const timeBonus = BigInt(Math.min(50, Math.floor(ageSec * Number(ENEMY_SPEED_PER_SEC))));
		const speed = (ENEMY_BASE_SPEED['spitter'] * (enemy.speedMultiplier + timeBonus)) / 100n;
		const moveAmount = (speed * TICK_MS) / 1000n;
		const magnitude = bs(chosenDist);
		if (magnitude > 0n) {
			const dir = chosenDist < SPITTER_MIN_DIST_SQ ? -1n : 1n;
			const nx = enemy.posX + (dir * dx * moveAmount) / magnitude;
			const nz = enemy.posZ + (dir * dz * moveAmount) / magnitude;
			const [ax, az] = enemyMoveAvoid(enemy.posX, enemy.posZ, nx, nz);
			if (ax !== enemy.posX || az !== enemy.posZ)
				ctx.db.enemy.id.update({ ...enemy, posX: ax, posZ: az });
		}
	} else if (enemy.dazedUntil && now >= (enemy.dazedUntil.microsSinceUnixEpoch as bigint)) {
		ctx.db.enemy.id.update({ ...enemy, isDazed: false, dazedUntil: undefined });
	}
}
