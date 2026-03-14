// ─── Boss AI Handler ───────────────────────────────────────────────────────────
// Handles all 4 boss types: ghost_dragon, root_colossus, shadow_stalker, plague_shaman.
// Called from enemies/tick.ts after the regular enemy loop.
// Phase 0 = normal, Phase 1 = enraged (hp <= 50%).

import { ts, bigintSqrt as bs } from '../../../helpers.js';
import {
	BOSS_MELEE_RANGE,
	BOSS_HP,
	BOSS_SPEED,
	BOSS_DAMAGE,
	ENEMY_SPEED_PER_SEC,
	TICK_MS
} from '../../../constants.js';
import { enemyMoveAvoid } from '../movement.js';

export function handleBoss(
	ctx: any,
	boss: any,
	players: any[],
	now: bigint,
	damageAccum: Map<bigint, bigint>,
	sessionId: bigint
): void {
	// ── Phase transition ─────────────────────────────────────────────────────
	const currentPhase = boss.phase as bigint;
	const shouldEnrage = (boss.hp as bigint) <= (boss.maxHp as bigint) / 2n;
	if (currentPhase === 0n && shouldEnrage) {
		ctx.db.boss.id.update({ ...boss, phase: 1n });
		boss = { ...boss, phase: 1n };
	}

	// ── Daze expiry ──────────────────────────────────────────────────────────
	if (boss.isDazed && boss.dazedUntil && now >= (boss.dazedUntil.microsSinceUnixEpoch as bigint)) {
		ctx.db.boss.id.update({ ...boss, isDazed: false, dazedUntil: undefined });
		boss = { ...boss, isDazed: false, dazedUntil: undefined };
	}

	// ── Target selection (closest player) ───────────────────────────────────
	let chosen = players[0];
	let chosenDist = BigInt(Number.MAX_SAFE_INTEGER);
	for (const p of players) {
		const dx = (p.posX as bigint) - (boss.posX as bigint);
		const dz = (p.posZ as bigint) - (boss.posZ as bigint);
		const dist = dx * dx + dz * dz;
		if (dist < chosenDist) {
			chosenDist = dist;
			chosen = p;
		}
	}

	const dx = (chosen.posX as bigint) - (boss.posX as bigint);
	const dz = (chosen.posZ as bigint) - (boss.posZ as bigint);

	// ── Stats (enraged = faster + harder) ───────────────────────────────────
	const isEnraged = (boss.phase as bigint) === 1n;
	const baseSpeed = BOSS_SPEED[boss.bossType] ?? 150n;
	const speed = isEnraged ? (baseSpeed * 13n) / 10n : baseSpeed;
	const baseDamage = BOSS_DAMAGE[boss.bossType] ?? 6n;
	const damage = isEnraged ? (baseDamage * 3n) / 2n : baseDamage;

	// ── Attack or move ───────────────────────────────────────────────────────
	const range = BOSS_MELEE_RANGE;
	if (chosenDist <= range * range && !boss.isDazed) {
		damageAccum.set(chosen.id as bigint, (damageAccum.get(chosen.id as bigint) ?? 0n) + damage);
	} else if (!boss.isDazed) {
		const ageSec = boss.spawnedAt
			? Number(now - (boss.spawnedAt.microsSinceUnixEpoch as bigint)) / 1_000_000
			: 0;
		const timeBonus = BigInt(Math.min(30, Math.floor(ageSec * Number(ENEMY_SPEED_PER_SEC))));
		const actualSpeed = (speed * (100n + timeBonus)) / 100n;
		const moveAmount = (actualSpeed * TICK_MS) / 1000n;
		const magnitude = bs(chosenDist);
		if (magnitude > 0n) {
			const nx = boss.posX + (dx * moveAmount) / magnitude;
			const nz = boss.posZ + (dz * moveAmount) / magnitude;
			const [ax, az] = enemyMoveAvoid(boss.posX, boss.posZ, nx, nz);
			if (ax !== boss.posX || az !== boss.posZ) {
				ctx.db.boss.id.update({ ...boss, posX: ax, posZ: az });
			}
		}
	}
}
