// ─── Caster AI Handler ─────────────────────────────────────────────────────────
// Medium-range beam attack + kiting movement. Called from enemies/tick.ts.

import { ts, bigintSqrt as bs } from '../../../helpers.js';
import {
	CASTER_RANGE_SQ,
	CASTER_MIN_DIST_SQ,
	ENEMY_BASE_SPEED,
	ENEMY_SPEED_PER_SEC,
	TICK_MS
} from '../../../constants.js';
import { enemyMoveAvoid } from '../movement.js';

export function handleCaster(
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
	const BEAM_COOLDOWN_US = 4_000_000n;
	const canBeam =
		!enemy.lastSpitAt ||
		now >= (enemy.lastSpitAt.microsSinceUnixEpoch as bigint) + BEAM_COOLDOWN_US;

	if (chosenDist <= CASTER_RANGE_SQ && !enemy.isDazed && canBeam) {
		damageAccum.set(chosen.id, (damageAccum.get(chosen.id) ?? 0n) + 5n);
		ctx.db.enemy.id.update({ ...enemy, lastSpitAt: ts(now) });
	} else if (!enemy.isDazed) {
		const ageSec = enemy.spawnedAt
			? Number(now - (enemy.spawnedAt.microsSinceUnixEpoch as bigint)) / 1_000_000
			: 0;
		const timeBonus = BigInt(Math.min(50, Math.floor(ageSec * Number(ENEMY_SPEED_PER_SEC))));
		const baseSpeed = (ENEMY_BASE_SPEED['caster'] * (enemy.speedMultiplier + timeBonus)) / 100n;
		const magnitude = bs(chosenDist);
		if (magnitude > 0n) {
			const dir = chosenDist < CASTER_MIN_DIST_SQ ? -1n : 1n;
			// Flee gets a 1.3x speed boost; approaching uses normal speed
			const speed = dir === -1n ? (baseSpeed * 13n) / 10n : baseSpeed;
			const moveAmount = (speed * TICK_MS) / 1000n;
			// Strafe perpendicular component — enemy.id picks a consistent side
			const strafeDir = (enemy.id as bigint) % 2n === 0n ? 1n : -1n;
			const perpX = -dz;
			const perpZ = dx;
			// 70% direct movement + 30% perpendicular strafe
			const nx = enemy.posX + (dir * dx * moveAmount * 7n + strafeDir * perpX * moveAmount * 3n) / (magnitude * 10n);
			const nz = enemy.posZ + (dir * dz * moveAmount * 7n + strafeDir * perpZ * moveAmount * 3n) / (magnitude * 10n);
			const [ax, az] = enemyMoveAvoid(enemy.posX, enemy.posZ, nx, nz);
			if (ax !== enemy.posX || az !== enemy.posZ)
				ctx.db.enemy.id.update({ ...enemy, posX: ax, posZ: az });
		}
	} else if (enemy.dazedUntil && now >= (enemy.dazedUntil.microsSinceUnixEpoch as bigint)) {
		ctx.db.enemy.id.update({ ...enemy, isDazed: false, dazedUntil: undefined });
	}
}
