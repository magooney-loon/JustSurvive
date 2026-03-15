// ─── Caster AI Handler ─────────────────────────────────────────────────────────
// Medium-range beam attack + kiting movement. Called from enemies/tick.ts.
// Supports multiple caster subtypes (caster, caster_railgun, caster_chaingun,
// caster_bfg, caster_shotgun) — each with distinct damage, cooldown, and range.

import { ts, bigintSqrt as bs } from '../../../helpers.js';
import { ENEMY_BASE_SPEED, ENEMY_SPEED_PER_SEC, TICK_MS } from '../../../constants.js';
import { enemyMoveAvoid } from '../movement.js';

type CasterConfig = {
	damage: bigint;
	cooldownUs: bigint;
	rangeSq: bigint; // max attack range (server units²)
	minDistSq: bigint; // flee closer than this
};

const CASTER_CONFIGS: Record<string, CasterConfig> = {
	// Default caster — blaster, medium range, medium damage
	caster: {
		damage: 4n,
		cooldownUs: 2_500_000n,
		rangeSq: 64_000_000n, // 8 units
		minDistSq: 25_000_000n // 5 units
	},
	// Railgun — long range sniper, slow fire, high damage
	caster_railgun: {
		damage: 9n,
		cooldownUs: 5_000_000n,
		rangeSq: 196_000_000n, // 14 units
		minDistSq: 36_000_000n // 6 units — kites from further away
	},
	// Chaingun — short range, rapid fire, low per-hit damage
	caster_chaingun: {
		damage: 2n,
		cooldownUs: 500_000n,
		rangeSq: 36_000_000n, // 6 units
		minDistSq: 16_000_000n // 4 units
	},
	// BFG — massive single shot, very slow, devastating damage
	caster_bfg: {
		damage: 12n,
		cooldownUs: 8_000_000n,
		rangeSq: 100_000_000n, // 10 units
		minDistSq: 36_000_000n // 6 units
	},
	// Shotgun — medium range, semi-auto, moderate damage
	caster_shotgun: {
		damage: 5n,
		cooldownUs: 1_800_000n,
		rangeSq: 49_000_000n, // 7 units
		minDistSq: 25_000_000n // 5 units
	}
};

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
	const cfg = CASTER_CONFIGS[enemy.enemyType as string] ?? CASTER_CONFIGS['caster'];

	const canBeam =
		!enemy.lastSpitAt || now >= (enemy.lastSpitAt.microsSinceUnixEpoch as bigint) + cfg.cooldownUs;

	if (chosenDist <= cfg.rangeSq && !enemy.isDazed && canBeam) {
		damageAccum.set(chosen.id, (damageAccum.get(chosen.id) ?? 0n) + cfg.damage);
		ctx.db.enemy.id.update({ ...enemy, lastSpitAt: ts(now) });
	} else if (!enemy.isDazed) {
		const ageSec = enemy.spawnedAt
			? Number(now - (enemy.spawnedAt.microsSinceUnixEpoch as bigint)) / 1_000_000
			: 0;
		const timeBonus = BigInt(Math.min(50, Math.floor(ageSec * Number(ENEMY_SPEED_PER_SEC))));
		const baseSpeed =
			((ENEMY_BASE_SPEED[enemy.enemyType as string] ?? ENEMY_BASE_SPEED['caster']) *
				(enemy.speedMultiplier + timeBonus)) /
			100n;
		const magnitude = bs(chosenDist);
		if (magnitude > 0n) {
			const dir = chosenDist < cfg.minDistSq ? -1n : 1n;
			// Flee gets a 1.3x speed boost; approaching uses normal speed
			const speed = dir === -1n ? (baseSpeed * 13n) / 10n : baseSpeed;
			const moveAmount = (speed * TICK_MS) / 1000n;
			// Strafe perpendicular component — enemy.id picks a consistent side
			const strafeDir = (enemy.id as bigint) % 2n === 0n ? 1n : -1n;
			const perpX = -dz;
			const perpZ = dx;
			// 70% direct movement + 30% perpendicular strafe
			const nx =
				enemy.posX +
				(dir * dx * moveAmount * 7n + strafeDir * perpX * moveAmount * 3n) / (magnitude * 10n);
			const nz =
				enemy.posZ +
				(dir * dz * moveAmount * 7n + strafeDir * perpZ * moveAmount * 3n) / (magnitude * 10n);
			const [ax, az] = enemyMoveAvoid(enemy.posX, enemy.posZ, nx, nz);
			if (ax !== enemy.posX || az !== enemy.posZ)
				ctx.db.enemy.id.update({ ...enemy, posX: ax, posZ: az });
		}
	} else if (enemy.dazedUntil && now >= (enemy.dazedUntil.microsSinceUnixEpoch as bigint)) {
		ctx.db.enemy.id.update({ ...enemy, isDazed: false, dazedUntil: undefined });
	}
}
