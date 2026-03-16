// ─── Katze Miu Boss Handler ─────────────────────────────────────────────────
// Ability 1: Uppercut — launch closest player into the air
// Ability 2: Fist Spin — 360° knockback all nearby players

import { ts } from '../../../../helpers.js';
import {
	BOSS_DAMAGE,
	KATZE_ABILITY1_COOLDOWN_US,
	KATZE_ABILITY2_COOLDOWN_US,
	KATZE_UPPERCUT_RANGE_SQ,
	KATZE_SPIN_RANGE_SQ,
	KATZE_SPIN_KNOCKBACK,
	KATZE_SPIN_DURATION_US,
	KATZE_KNOCKBACK_DURATION_US
} from '../../../../constants.js';
import { bossMove, bossAttack } from '../boss_helpers.js';

export function handleKatzeMiu(
	ctx: any,
	boss: any,
	players: any[],
	now: bigint,
	damageAccum: Map<bigint, bigint>,
	abilitiesLocked: boolean,
	playerScale: bigint = 100n
): any {
	// Clear knockedPlayerId after knockback duration (1s) for client animation sync
	if (boss.knockedPlayerId && boss.ability1CooldownUntil) {
		const abilityFiredAt =
			(boss.ability1CooldownUntil.microsSinceUnixEpoch as bigint) - KATZE_ABILITY1_COOLDOWN_US;
		if (now >= abilityFiredAt + KATZE_KNOCKBACK_DURATION_US) {
			boss = { ...boss, knockedPlayerId: undefined };
			ctx.db.boss.id.update(boss);
		}
	}

	// Auto-stop channeling after spin duration
	if (boss.isChanneling && boss.ability2CooldownUntil) {
		const firedAt =
			(boss.ability2CooldownUntil.microsSinceUnixEpoch as bigint) - KATZE_ABILITY2_COOLDOWN_US;
		if (now >= firedAt + KATZE_SPIN_DURATION_US) {
			boss = { ...boss, isChanneling: false };
			ctx.db.boss.id.update(boss);
		}
	}

	// While channeling: skip movement/attack
	if (boss.isChanneling) return boss;

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

	// Ability 1: Uppercut — launch closest player (when in range)
	const canAbility1 =
		!abilitiesLocked &&
		(!boss.ability1CooldownUntil ||
			now >= (boss.ability1CooldownUntil.microsSinceUnixEpoch as bigint));
	if (canAbility1 && chosenDistSq <= KATZE_UPPERCUT_RANGE_SQ) {
		const baseDmg = BOSS_DAMAGE[boss.bossType] ?? 10n;
		const dmg = (baseDmg * playerScale) / 100n;
		damageAccum.set(chosen.id as bigint, (damageAccum.get(chosen.id as bigint) ?? 0n) + dmg);
		// Knockback - push them back significantly
		const magnitude = BigInt(Math.round(Math.sqrt(Number(chosenDistSq))));
		if (magnitude > 0n) {
			const knockX =
				(((boss.posX as bigint) - (chosen.posX as bigint)) * KATZE_SPIN_KNOCKBACK) / magnitude;
			const knockZ =
				(((boss.posZ as bigint) - (chosen.posZ as bigint)) * KATZE_SPIN_KNOCKBACK) / magnitude;
			const newX = (chosen.posX as bigint) + knockX;
			const newZ = (chosen.posZ as bigint) + knockZ;
			ctx.db.playerState.id.update({ ...chosen, posX: newX, posZ: newZ });
		}
		// Track which player is knocked (for client animation sync)
		boss = { ...boss, knockedPlayerId: chosen.id as bigint };
		boss = { ...boss, ability1CooldownUntil: ts(now + KATZE_ABILITY1_COOLDOWN_US) };
		ctx.db.boss.id.update(boss);
		return boss;
	}

	// Ability 2: Fist Spin — 360° knockback all nearby players
	const canAbility2 =
		!abilitiesLocked &&
		(!boss.ability2CooldownUntil ||
			now >= (boss.ability2CooldownUntil.microsSinceUnixEpoch as bigint));
	if (canAbility2) {
		let hitAny = false;
		for (const p of players) {
			const pdx = (p.posX as bigint) - (boss.posX as bigint);
			const pdz = (p.posZ as bigint) - (boss.posZ as bigint);
			const pDist = pdx * pdx + pdz * pdz;
			if (pDist <= KATZE_SPIN_RANGE_SQ) {
				hitAny = true;
				// Knockback away from boss
				const pMag = BigInt(Math.round(Math.sqrt(Number(pDist))));
				if (pMag > 0n) {
					const knockX = (pdx * KATZE_SPIN_KNOCKBACK) / pMag;
					const knockZ = (pdz * KATZE_SPIN_KNOCKBACK) / pMag;
					const newX = (p.posX as bigint) + knockX;
					const newZ = (p.posZ as bigint) + knockZ;
					ctx.db.playerState.id.update({ ...p, posX: newX, posZ: newZ });
				}
			}
		}
		// Only trigger cooldown if we hit at least one player
		if (hitAny) {
			boss = {
				...boss,
				isChanneling: true,
				ability2CooldownUntil: ts(now + KATZE_ABILITY2_COOLDOWN_US)
			};
			ctx.db.boss.id.update(boss);
			return boss;
		}
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
