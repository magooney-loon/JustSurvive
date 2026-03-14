// ─── Melee AI Handler ──────────────────────────────────────────────────────────
// Shared by: basic, fast, brute, boss. Direct attack + strafing movement.
// Called from enemies/tick.ts after brace/shield pre-checks.

import { ts, bigintSqrt as bs } from '../../../helpers.js';
import { ENEMY_BASE_SPEED, ENEMY_SPEED_PER_SEC, TICK_MS } from '../../../constants.js';
import { enemyMoveAvoid } from '../movement.js';

export function handleMelee(
	ctx: any,
	enemy: any,
	chosen: any,
	dx: bigint,
	dz: bigint,
	chosenDist: bigint,
	now: bigint,
	damageAccum: Map<bigint, bigint>,
	enemyRange: bigint
): void {
	if (chosenDist <= enemyRange * enemyRange && !enemy.isDazed) {
		const damage = enemy.enemyType === 'brute' ? 3n : 1n;
		damageAccum.set(chosen.id, (damageAccum.get(chosen.id) ?? 0n) + damage);
	} else if (!enemy.isDazed) {
		const ageSec = enemy.spawnedAt
			? Number(now - (enemy.spawnedAt.microsSinceUnixEpoch as bigint)) / 1_000_000
			: 0;
		const timeBonus = BigInt(Math.min(50, Math.floor(ageSec * Number(ENEMY_SPEED_PER_SEC))));
		const speed =
			((ENEMY_BASE_SPEED[enemy.enemyType] ?? 3000n) * (enemy.speedMultiplier + timeBonus)) /
			100n;
		const moveAmount = (speed * TICK_MS) / 1000n;
		const magnitude = bs(chosenDist);
		if (magnitude > 0n) {
			const STRAFE_MIN_DIST_SQ = 36_000_000n;
			const perpX = -dz;
			const perpZ = dx;
			let strafeBias = 0;
			if (chosenDist > STRAFE_MIN_DIST_SQ) {
				const STRAFE_PERIOD_US = 2_500_000n;
				const strafePhase = Number((now / STRAFE_PERIOD_US + (enemy.id as bigint) * 7n) % 12n);
				if (enemy.enemyType === 'fast') {
					if (strafePhase < 3) strafeBias = -1;
					else if (strafePhase < 6) strafeBias = 1;
				} else if (enemy.enemyType === 'basic') {
					if (strafePhase < 2) strafeBias = -1;
					else if (strafePhase < 4) strafeBias = 1;
				}
			}
			if (strafeBias !== 0) {
				const fwd = BigInt(Math.round(Number(moveAmount) * 0.55));
				const side = BigInt(Math.round(strafeBias * Number(moveAmount) * 0.55));
				const nx = enemy.posX + (dx * fwd) / magnitude + (perpX * side) / magnitude;
				const nz = enemy.posZ + (dz * fwd) / magnitude + (perpZ * side) / magnitude;
				const [ax, az] = enemyMoveAvoid(enemy.posX, enemy.posZ, nx, nz);
				if (ax !== enemy.posX || az !== enemy.posZ)
					ctx.db.enemy.id.update({ ...enemy, posX: ax, posZ: az });
			} else {
				const nx = enemy.posX + (dx * moveAmount) / magnitude;
				const nz = enemy.posZ + (dz * moveAmount) / magnitude;
				const [ax, az] = enemyMoveAvoid(enemy.posX, enemy.posZ, nx, nz);
				if (ax !== enemy.posX || az !== enemy.posZ)
					ctx.db.enemy.id.update({ ...enemy, posX: ax, posZ: az });
			}
		}
	} else {
		if (enemy.dazedUntil && now >= (enemy.dazedUntil.microsSinceUnixEpoch as bigint)) {
			ctx.db.enemy.id.update({ ...enemy, isDazed: false, dazedUntil: undefined });
		}
	}
}
