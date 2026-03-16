// ─── Rabid Dog (SCP-939) Boss Handler ─────────────────────────────────────────
// Ability 1: Leap — teleport behind closest player
// Ability 2: Stun Attack — stun target for 2s, deal big hit

import { ts } from '../../../../helpers.js';
import {
	BOSS_DAMAGE,
	BOSS_MELEE_RANGE,
	DOG_ABILITY1_COOLDOWN_US,
	DOG_ABILITY2_COOLDOWN_US,
	BOSS_PLAYER_LONG_STUN_US,
	DOG_LEAP_DISTANCE
} from '../../../../constants.js';
import { bossMove, bossAttack } from '../boss_helpers.js';

export function handleRabidDog(
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

	// Ability 1: Leap — teleport behind closest player (only when within range)
	const canAbility1 =
		!abilitiesLocked &&
		(!boss.ability1CooldownUntil ||
			now >= (boss.ability1CooldownUntil.microsSinceUnixEpoch as bigint));
	const leapRangeSq = DOG_LEAP_DISTANCE * DOG_LEAP_DISTANCE * 9n; // 3x leap distance
	if (canAbility1 && chosenDistSq <= leapRangeSq) {
		const facingRad = Number(chosen.facingAngle) / 1000;
		const behindX = BigInt(Math.round(Math.cos(facingRad + Math.PI) * Number(DOG_LEAP_DISTANCE)));
		const behindZ = BigInt(Math.round(Math.sin(facingRad + Math.PI) * Number(DOG_LEAP_DISTANCE)));
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
