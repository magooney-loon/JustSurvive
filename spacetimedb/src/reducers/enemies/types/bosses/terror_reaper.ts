// ─── Terror Reaper Boss Handler ────────────────────────────────────────────────
// Ability 1: Soul Drain — deal damage to all players within 14 units, heal boss 40% of damage dealt
// Ability 2: Death Blink — teleport to closest player, deal heavy damage + 2s stun

import { ts } from '../../../../helpers.js';
import {
	BOSS_DAMAGE,
	REAPER_ABILITY1_COOLDOWN_US,
	REAPER_ABILITY2_COOLDOWN_US,
	REAPER_SOUL_DRAIN_RANGE_SQ,
	BOSS_PLAYER_LONG_STUN_US,
	BOSS_MELEE_RANGE
} from '../../../../constants.js';
import { bossMove, bossAttack } from '../boss_helpers.js';

export function handleTerrorReaper(
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

	// Ability 1: Soul Drain — deal damage to all players within 14 units, heal boss 40% of damage dealt
	const canAbility1 =
		!abilitiesLocked &&
		(!boss.ability1CooldownUntil ||
			now >= (boss.ability1CooldownUntil.microsSinceUnixEpoch as bigint));
	if (canAbility1) {
		const baseDmg = BOSS_DAMAGE[boss.bossType] ?? 11n;
		const dmg = (baseDmg * playerScale) / 100n;
		let totalHealing = 0n;
		for (const p of players) {
			const pdx = (p.posX as bigint) - (boss.posX as bigint);
			const pdz = (p.posZ as bigint) - (boss.posZ as bigint);
			if (pdx * pdx + pdz * pdz <= REAPER_SOUL_DRAIN_RANGE_SQ) {
				damageAccum.set(p.id as bigint, (damageAccum.get(p.id as bigint) ?? 0n) + dmg);
				totalHealing += (dmg * 40n) / 100n;
			}
		}
		if (totalHealing > 0n) {
			const newHp =
				(boss.hp as bigint) + totalHealing > (boss.maxHp as bigint)
					? (boss.maxHp as bigint)
					: (boss.hp as bigint) + totalHealing;
			boss = { ...boss, hp: newHp };
		}
		boss = { ...boss, ability1CooldownUntil: ts(now + REAPER_ABILITY1_COOLDOWN_US) };
		ctx.db.boss.id.update(boss);
		return boss;
	}

	// Ability 2: Death Blink — teleport to closest player, deal heavy damage + 2s stun
	const canAbility2 =
		!abilitiesLocked &&
		(!boss.ability2CooldownUntil ||
			now >= (boss.ability2CooldownUntil.microsSinceUnixEpoch as bigint));
	const blinkRangeSq = BOSS_MELEE_RANGE * BOSS_MELEE_RANGE * 49n; // ~14 units (matches Soul Drain range)
	if (canAbility2 && chosenDistSq <= blinkRangeSq) {
		// Teleport directly to chosen player
		boss = {
			...boss,
			posX: chosen.posX,
			posZ: chosen.posZ,
			ability2CooldownUntil: ts(now + REAPER_ABILITY2_COOLDOWN_US)
		};
		ctx.db.boss.id.update(boss);
		// Heavy hit + 2s stun on arrival
		const baseDmg = (BOSS_DAMAGE[boss.bossType] ?? 11n) * 2n;
		const dmg = (baseDmg * playerScale) / 100n;
		damageAccum.set(chosen.id as bigint, (damageAccum.get(chosen.id as bigint) ?? 0n) + dmg);
		ctx.db.playerState.id.update({ ...chosen, stunUntil: ts(now + BOSS_PLAYER_LONG_STUN_US) });
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
