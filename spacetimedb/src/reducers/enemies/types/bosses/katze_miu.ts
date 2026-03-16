// ─── Katze Miu Boss Handler ─────────────────────────────────────────────────
// Ability 1: Uppercut — stun closest player for 2s
// Ability 2: Fist Spin — slow all nearby players for 3s

import { ts } from '../../../../helpers.js';
import {
	BOSS_DAMAGE,
	KATZE_ABILITY1_COOLDOWN_US,
	KATZE_ABILITY2_COOLDOWN_US,
	KATZE_UPPERCUT_RANGE_SQ,
	KATZE_SPIN_RANGE_SQ,
	BOSS_PLAYER_LONG_STUN_US,
	BOSS_PLAYER_SLOW_US
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
	// Auto-stop channeling after spin duration
	if (boss.isChanneling && boss.ability2CooldownUntil) {
		const firedAt =
			(boss.ability2CooldownUntil.microsSinceUnixEpoch as bigint) - KATZE_ABILITY2_COOLDOWN_US;
		if (now >= firedAt + 800000n) {
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

	// Ability 1: Uppercut — stun closest player for 2s
	const canAbility1 =
		!abilitiesLocked &&
		(!boss.ability1CooldownUntil ||
			now >= (boss.ability1CooldownUntil.microsSinceUnixEpoch as bigint));
	if (canAbility1 && chosenDistSq <= KATZE_UPPERCUT_RANGE_SQ) {
		const baseDmg = BOSS_DAMAGE[boss.bossType] ?? 10n;
		const dmg = (baseDmg * playerScale) / 100n;
		damageAccum.set(chosen.id as bigint, (damageAccum.get(chosen.id as bigint) ?? 0n) + dmg);
		// Apply 2s stun instead of knockback
		ctx.db.playerState.id.update({ ...chosen, stunUntil: ts(now + BOSS_PLAYER_LONG_STUN_US) });
		boss = { ...boss, ability1CooldownUntil: ts(now + KATZE_ABILITY1_COOLDOWN_US) };
		ctx.db.boss.id.update(boss);
		return boss;
	}

	// Ability 2: Fist Spin — slow all nearby players for 3s
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
				// Apply slow instead of knockback
				ctx.db.playerState.id.update({
					...p,
					slowedUntil: ts(now + BOSS_PLAYER_SLOW_US)
				});
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
