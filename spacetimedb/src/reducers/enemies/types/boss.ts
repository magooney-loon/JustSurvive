// ─── Boss AI Handler ───────────────────────────────────────────────────────────
// 4 boss types, each with 2 unique abilities.
// ghost_dragon: hide & seek + ice ball
// worm_monster: chain charge + burrow
// rabid_dog: leap + stun attack
// scp_096: aoe slam + random charge

import { ts, bigintSqrt as bs } from '../../../helpers.js';
import {
	BOSS_MELEE_RANGE,
	BOSS_STOP_DIST,
	BOSS_MELEE_COOLDOWN_US,
	BOSS_HP,
	BOSS_SPEED,
	BOSS_DAMAGE,
	ENEMY_SPEED_PER_SEC,
	TICK_MS,
	GHOST_ABILITY1_COOLDOWN_US,
	GHOST_HIDE_DURATION_US,
	GHOST_ABILITY2_COOLDOWN_US,
	WORM_ABILITY1_COOLDOWN_US,
	WORM_ABILITY2_COOLDOWN_US,
	WORM_BURROW_DURATION_US,
	DOG_ABILITY1_COOLDOWN_US,
	DOG_ABILITY2_COOLDOWN_US,
	SCP096_ABILITY1_COOLDOWN_US,
	SCP096_ABILITY2_COOLDOWN_US,
	BOSS_PLAYER_STUN_US,
	BOSS_PLAYER_LONG_STUN_US,
	BOSS_PLAYER_SLOW_US,
	ARENA_RADIUS_SRV
} from '../../../constants.js';
import { enemyMoveAvoid } from '../movement.js';

function bossAgeSec(boss: any, now: bigint): number {
	return boss.spawnedAt
		? Number(now - (boss.spawnedAt.microsSinceUnixEpoch as bigint)) / 1_000_000
		: 0;
}

function bossMove(
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

function bossAttack(
	boss: any,
	chosen: any,
	dx: bigint,
	dz: bigint,
	distSq: bigint,
	damageAccum: Map<bigint, bigint>,
	now: bigint,
	playerScale: bigint = 100n
) {
	// Rate-limit melee hits — fires once per BOSS_MELEE_COOLDOWN_US window
	const tickUs = TICK_MS * 1000n;
	if (now % BOSS_MELEE_COOLDOWN_US >= tickUs) return false;

	const isEnraged = (boss.phase as bigint) === 1n;
	const baseDamage = BOSS_DAMAGE[boss.bossType] ?? 4n;
	const damage = ((isEnraged ? (baseDamage * 3n) / 2n : baseDamage) * playerScale) / 100n;
	const range = BOSS_MELEE_RANGE;
	if (distSq <= range * range) {
		damageAccum.set(chosen.id as bigint, (damageAccum.get(chosen.id as bigint) ?? 0n) + damage);
		return true;
	}
	return false;
}

// ─── Ghost Dragon ──────────────────────────────────────────────────────────────
function handleGhostDragon(
	ctx: any,
	boss: any,
	players: any[],
	now: bigint,
	damageAccum: Map<bigint, bigint>,
	abilitiesLocked: boolean,
	playerScale: bigint = 100n
): any {
	// Auto-unhide after GHOST_HIDE_DURATION_US
	if (boss.isHidden && boss.ability1CooldownUntil) {
		const firedAt =
			(boss.ability1CooldownUntil.microsSinceUnixEpoch as bigint) - GHOST_ABILITY1_COOLDOWN_US;
		if (now >= firedAt + GHOST_HIDE_DURATION_US) {
			boss = { ...boss, isHidden: false };
			ctx.db.boss.id.update(boss);
		}
	}

	// Pick target: furthest when hidden, closest otherwise
	let chosen = players[0];
	let chosenDistSq = 0n;
	if (boss.isHidden) {
		// furthest player
		for (const p of players) {
			const dx = (p.posX as bigint) - (boss.posX as bigint);
			const dz = (p.posZ as bigint) - (boss.posZ as bigint);
			const d = dx * dx + dz * dz;
			if (d > chosenDistSq) {
				chosenDistSq = d;
				chosen = p;
			}
		}
	} else {
		chosenDistSq = BigInt(Number.MAX_SAFE_INTEGER);
		for (const p of players) {
			const dx = (p.posX as bigint) - (boss.posX as bigint);
			const dz = (p.posZ as bigint) - (boss.posZ as bigint);
			const d = dx * dx + dz * dz;
			if (d < chosenDistSq) {
				chosenDistSq = d;
				chosen = p;
			}
		}
	}
	const dx = (chosen.posX as bigint) - (boss.posX as bigint);
	const dz = (chosen.posZ as bigint) - (boss.posZ as bigint);

	// Ability 1: Hide & Seek — become invisible and charge furthest player
	const canAbility1 =
		!abilitiesLocked &&
		(!boss.ability1CooldownUntil ||
			now >= (boss.ability1CooldownUntil.microsSinceUnixEpoch as bigint));
	if (canAbility1 && !boss.isHidden) {
		boss = { ...boss, isHidden: true, ability1CooldownUntil: ts(now + GHOST_ABILITY1_COOLDOWN_US) };
		ctx.db.boss.id.update(boss);
		return boss;
	}

	// Ability 2: Ice Ball — stun up to 2 players for 1s
	const canAbility2 =
		!abilitiesLocked &&
		(!boss.ability2CooldownUntil ||
			now >= (boss.ability2CooldownUntil.microsSinceUnixEpoch as bigint));
	if (canAbility2 && !boss.isHidden && players.length > 0) {
		const stunUntil = ts(now + BOSS_PLAYER_STUN_US);
		const targets = players.slice(0, 2);
		for (const t of targets) {
			ctx.db.playerState.id.update({ ...t, stunUntil });
		}
		boss = { ...boss, ability2CooldownUntil: ts(now + GHOST_ABILITY2_COOLDOWN_US) };
		ctx.db.boss.id.update(boss);
		return boss;
	}

	if (boss.isDazed) {
		if (boss.dazedUntil && now >= (boss.dazedUntil.microsSinceUnixEpoch as bigint)) {
			boss = { ...boss, isDazed: false };
			ctx.db.boss.id.update(boss);
		}
		return boss;
	}

	const speedBoost = boss.isHidden ? 200n : 100n; // 2x speed while hidden
	const attacked = bossAttack(boss, chosen, dx, dz, chosenDistSq, damageAccum, now, playerScale);
	if (!attacked) {
		boss = bossMove(ctx, boss, dx, dz, chosenDistSq, speedBoost, now);
	}
	return boss;
}

// ─── Worm Monster ──────────────────────────────────────────────────────────────
function handleWormMonster(
	ctx: any,
	boss: any,
	players: any[],
	now: bigint,
	damageAccum: Map<bigint, bigint>,
	abilitiesLocked: boolean,
	playerScale: bigint = 100n
): any {
	// Auto-emerge after WORM_BURROW_DURATION_US — teleport to destination on emerge (not on burrow-in)
	if (boss.isBurrowed && boss.ability2CooldownUntil) {
		const firedAt =
			(boss.ability2CooldownUntil.microsSinceUnixEpoch as bigint) - WORM_ABILITY2_COOLDOWN_US;
		if (now >= firedAt + WORM_BURROW_DURATION_US) {
			// Recompute target position from fire timestamp (same seed as when ability fired)
			const seed = firedAt % 1000n;
			const angle = (Number(seed) / 1000) * Math.PI * 2;
			const radius = 20000 + Number((firedAt / 7n) % 20000n);
			const newX = BigInt(Math.round(Math.cos(angle) * radius));
			const newZ = BigInt(Math.round(Math.sin(angle) * radius));
			boss = { ...boss, isBurrowed: false, posX: newX, posZ: newZ };
			ctx.db.boss.id.update(boss);
		}
	}

	// While burrowed: skip movement/attack
	if (boss.isBurrowed) return boss;

	// Closest player
	let chosen = players[0];
	let chosenDistSq = BigInt(Number.MAX_SAFE_INTEGER);
	for (const p of players) {
		const ddx = (p.posX as bigint) - (boss.posX as bigint);
		const ddz = (p.posZ as bigint) - (boss.posZ as bigint);
		const d = ddx * ddx + ddz * ddz;
		if (d < chosenDistSq) {
			chosenDistSq = d;
			chosen = p;
		}
	}
	const dx = (chosen.posX as bigint) - (boss.posX as bigint);
	const dz = (chosen.posZ as bigint) - (boss.posZ as bigint);

	// Ability 1: Chain Charge — deal damage to ALL players within 20 units
	const canAbility1 =
		!abilitiesLocked &&
		(!boss.ability1CooldownUntil ||
			now >= (boss.ability1CooldownUntil.microsSinceUnixEpoch as bigint));
	if (canAbility1) {
		const CHAIN_RANGE_SQ_SRV = 20000n * 20000n;
		const baseDmg = BOSS_DAMAGE[boss.bossType] ?? 7n;
		const dmg = (baseDmg * playerScale) / 100n;
		for (const p of players) {
			const pdx = (p.posX as bigint) - (boss.posX as bigint);
			const pdz = (p.posZ as bigint) - (boss.posZ as bigint);
			if (pdx * pdx + pdz * pdz <= CHAIN_RANGE_SQ_SRV) {
				damageAccum.set(p.id as bigint, (damageAccum.get(p.id as bigint) ?? 0n) + dmg);
			}
		}
		boss = { ...boss, ability1CooldownUntil: ts(now + WORM_ABILITY1_COOLDOWN_US) };
		ctx.db.boss.id.update(boss);
		return boss;
	}

	// Ability 2: Burrow — sink at current position, teleport on emerge
	const canAbility2 =
		!abilitiesLocked &&
		(!boss.ability2CooldownUntil ||
			now >= (boss.ability2CooldownUntil.microsSinceUnixEpoch as bigint));
	if (canAbility2) {
		// Stay at current position — teleport happens on emerge using firedAt as seed
		boss = {
			...boss,
			isBurrowed: true,
			ability2CooldownUntil: ts(now + WORM_ABILITY2_COOLDOWN_US)
		};
		ctx.db.boss.id.update(boss);
		return boss;
	}

	if (boss.isDazed) {
		if (boss.dazedUntil && now >= (boss.dazedUntil.microsSinceUnixEpoch as bigint)) {
			boss = { ...boss, isDazed: false };
			ctx.db.boss.id.update(boss);
		}
		return boss;
	}

	const attacked = bossAttack(boss, chosen, dx, dz, chosenDistSq, damageAccum, now, playerScale);
	if (!attacked) boss = bossMove(ctx, boss, dx, dz, chosenDistSq, 100n, now);
	return boss;
}

// ─── Rabid Dog (SCP-939) ───────────────────────────────────────────────────────
function handleRabidDog(
	ctx: any,
	boss: any,
	players: any[],
	now: bigint,
	damageAccum: Map<bigint, bigint>,
	abilitiesLocked: boolean,
	playerScale: bigint = 100n
): any {
	// Closest player
	let chosen = players[0];
	let chosenDistSq = BigInt(Number.MAX_SAFE_INTEGER);
	for (const p of players) {
		const ddx = (p.posX as bigint) - (boss.posX as bigint);
		const ddz = (p.posZ as bigint) - (boss.posZ as bigint);
		const d = ddx * ddx + ddz * ddz;
		if (d < chosenDistSq) {
			chosenDistSq = d;
			chosen = p;
		}
	}
	const dx = (chosen.posX as bigint) - (boss.posX as bigint);
	const dz = (chosen.posZ as bigint) - (boss.posZ as bigint);

	// Ability 1: Leap — teleport behind closest player
	const canAbility1 =
		!abilitiesLocked &&
		(!boss.ability1CooldownUntil ||
			now >= (boss.ability1CooldownUntil.microsSinceUnixEpoch as bigint));
	if (canAbility1) {
		const facingRad = Number(chosen.facingAngle) / 1000;
		const behindX = BigInt(Math.round(Math.cos(facingRad + Math.PI) * 2500));
		const behindZ = BigInt(Math.round(Math.sin(facingRad + Math.PI) * 2500));
		const newX = (chosen.posX as bigint) + behindX;
		const newZ = (chosen.posZ as bigint) + behindZ;
		boss = {
			...boss,
			posX: newX,
			posZ: newZ,
			ability1CooldownUntil: ts(now + DOG_ABILITY1_COOLDOWN_US)
		};
		ctx.db.boss.id.update(boss);
		return boss;
	}

	// Ability 2: Stun Attack — stun target for 2s, deal big hit
	const canAbility2 =
		!abilitiesLocked &&
		(!boss.ability2CooldownUntil ||
			now >= (boss.ability2CooldownUntil.microsSinceUnixEpoch as bigint));
	if (canAbility2 && chosenDistSq <= BOSS_MELEE_RANGE * BOSS_MELEE_RANGE * 4n) {
		ctx.db.playerState.id.update({ ...chosen, stunUntil: ts(now + BOSS_PLAYER_LONG_STUN_US) });
		const baseDmg = (BOSS_DAMAGE[boss.bossType] ?? 3n) * 2n;
		const dmg = (baseDmg * playerScale) / 100n;
		damageAccum.set(chosen.id as bigint, (damageAccum.get(chosen.id as bigint) ?? 0n) + dmg);
		boss = { ...boss, ability2CooldownUntil: ts(now + DOG_ABILITY2_COOLDOWN_US) };
		ctx.db.boss.id.update(boss);
		return boss;
	}

	if (boss.isDazed) {
		if (boss.dazedUntil && now >= (boss.dazedUntil.microsSinceUnixEpoch as bigint)) {
			boss = { ...boss, isDazed: false };
			ctx.db.boss.id.update(boss);
		}
		return boss;
	}

	const attacked = bossAttack(boss, chosen, dx, dz, chosenDistSq, damageAccum, now, playerScale);
	if (!attacked) boss = bossMove(ctx, boss, dx, dz, chosenDistSq, 100n, now);
	return boss;
}

// ─── SCP-096 ──────────────────────────────────────────────────────────────────
function handleScp096(
	ctx: any,
	boss: any,
	players: any[],
	now: bigint,
	damageAccum: Map<bigint, bigint>,
	abilitiesLocked: boolean,
	playerScale: bigint = 100n
): any {
	// Pick random player as charge target (changes over time)
	const targetIdx = Number((now / 8_000_000n) % BigInt(players.length));
	const chargeTarget = players[targetIdx] ?? players[0];

	// Closest player for melee fallback
	let chosen = players[0];
	let chosenDistSq = BigInt(Number.MAX_SAFE_INTEGER);
	for (const p of players) {
		const ddx = (p.posX as bigint) - (boss.posX as bigint);
		const ddz = (p.posZ as bigint) - (boss.posZ as bigint);
		const d = ddx * ddx + ddz * ddz;
		if (d < chosenDistSq) {
			chosenDistSq = d;
			chosen = p;
		}
	}
	const dx = (chosen.posX as bigint) - (boss.posX as bigint);
	const dz = (chosen.posZ as bigint) - (boss.posZ as bigint);

	// Ability 1: AoE Slam — knock back and slow all players within 15 units
	const canAbility1 =
		!abilitiesLocked &&
		(!boss.ability1CooldownUntil ||
			now >= (boss.ability1CooldownUntil.microsSinceUnixEpoch as bigint));
	if (canAbility1) {
		const AoE_RANGE_SQ = 15000n * 15000n;
		const KNOCKBACK = 8000n;
		for (const p of players) {
			const pdx = (p.posX as bigint) - (boss.posX as bigint);
			const pdz = (p.posZ as bigint) - (boss.posZ as bigint);
			const pDist = pdx * pdx + pdz * pdz;
			if (pDist <= AoE_RANGE_SQ) {
				const pMag = bs(pDist);
				const newX =
					pMag > 0n
						? (p.posX as bigint) + (pdx * KNOCKBACK) / pMag
						: (p.posX as bigint) + KNOCKBACK;
				const newZ =
					pMag > 0n
						? (p.posZ as bigint) + (pdz * KNOCKBACK) / pMag
						: (p.posZ as bigint) + KNOCKBACK;
				ctx.db.playerState.id.update({
					...p,
					posX: newX,
					posZ: newZ,
					slowedUntil: ts(now + BOSS_PLAYER_SLOW_US)
				});
			}
		}
		boss = { ...boss, ability1CooldownUntil: ts(now + SCP096_ABILITY1_COOLDOWN_US) };
		ctx.db.boss.id.update(boss);
		return boss;
	}

	// Ability 2: Charge — dash toward random player at 2x speed
	const canAbility2 =
		!abilitiesLocked &&
		(!boss.ability2CooldownUntil ||
			now >= (boss.ability2CooldownUntil.microsSinceUnixEpoch as bigint));
	if (canAbility2) {
		const cdx = (chargeTarget.posX as bigint) - (boss.posX as bigint);
		const cdz = (chargeTarget.posZ as bigint) - (boss.posZ as bigint);
		const cdist = cdx * cdx + cdz * cdz;
		boss = bossMove(ctx, boss, cdx, cdz, cdist, 200n, now);
		boss = { ...boss, ability2CooldownUntil: ts(now + SCP096_ABILITY2_COOLDOWN_US) };
		ctx.db.boss.id.update(boss);
		return boss;
	}

	if (boss.isDazed) {
		if (boss.dazedUntil && now >= (boss.dazedUntil.microsSinceUnixEpoch as bigint)) {
			boss = { ...boss, isDazed: false };
			ctx.db.boss.id.update(boss);
		}
		return boss;
	}

	// Default: charge toward random target at normal speed
	const cdx = (chargeTarget.posX as bigint) - (boss.posX as bigint);
	const cdz = (chargeTarget.posZ as bigint) - (boss.posZ as bigint);
	const cdist = cdx * cdx + cdz * cdz;
	const attacked = bossAttack(boss, chosen, dx, dz, chosenDistSq, damageAccum, now, playerScale);
	if (!attacked) boss = bossMove(ctx, boss, cdx, cdz, cdist, 100n, now);
	return boss;
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
	}
}
