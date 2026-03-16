// ─── SCP-096 Boss Handler ──────────────────────────────────────────────────────
// Ability 1: AoE Slam — knock back and slow all players within 15 units
// Ability 2: Charge — dash toward random player at 2x speed

import { ts, bigintSqrt as bs } from '../../../../helpers.js';
import {
	SCP096_ABILITY1_COOLDOWN_US,
	SCP096_ABILITY2_COOLDOWN_US,
	SCP096_AOE_RANGE_SQ,
	SCP096_AOE_KNOCKBACK,
	SCP096_CHARGE_INTERVAL_US,
	BOSS_PLAYER_SLOW_US
} from '../../../../constants.js';
import { bossMove, bossAttack } from '../boss.js';

export function handleScp096(
	ctx: any,
	boss: any,
	players: any[],
	now: bigint,
	damageAccum: Map<bigint, bigint>,
	abilitiesLocked: boolean,
	playerScale: bigint = 100n
): any {
	// Pick random player as charge target (changes over time)
	const targetIdx = Number((now / SCP096_CHARGE_INTERVAL_US) % BigInt(players.length));
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
		for (const p of players) {
			const pdx = (p.posX as bigint) - (boss.posX as bigint);
			const pdz = (p.posZ as bigint) - (boss.posZ as bigint);
			const pDist = pdx * pdx + pdz * pdz;
			if (pDist <= SCP096_AOE_RANGE_SQ) {
				const pMag = bs(pDist);
				const newX =
					pMag > 0n
						? (p.posX as bigint) + (pdx * SCP096_AOE_KNOCKBACK) / pMag
						: (p.posX as bigint) + SCP096_AOE_KNOCKBACK;
				const newZ =
					pMag > 0n
						? (p.posZ as bigint) + (pdz * SCP096_AOE_KNOCKBACK) / pMag
						: (p.posZ as bigint) + SCP096_AOE_KNOCKBACK;
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
