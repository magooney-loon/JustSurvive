// ─── Ghost Dragon Boss Handler ─────────────────────────────────────────────────
// Ability 1: Hide & Seek — become invisible and charge furthest player
// Ability 2: Ice Ball — stun up to 2 players for 1s

import { ts } from '../../../../helpers.js';
import {
	BOSS_MELEE_RANGE,
	GHOST_ABILITY1_COOLDOWN_US,
	GHOST_HIDE_DURATION_US,
	GHOST_ABILITY2_COOLDOWN_US,
	BOSS_PLAYER_STUN_US
} from '../../../../constants.js';
import { bossMove, bossAttack } from '../boss_helpers.js';

export function handleGhostDragon(
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

	// Ability 2: Ice Ball — stun up to 2 players for 1s (only when in range)
	const canAbility2 =
		!abilitiesLocked &&
		(!boss.ability2CooldownUntil ||
			now >= (boss.ability2CooldownUntil.microsSinceUnixEpoch as bigint));
	const iceBallRangeSq = BOSS_MELEE_RANGE * BOSS_MELEE_RANGE * 4n; // ~2x melee range
	if (canAbility2 && !boss.isHidden && players.length > 0 && chosenDistSq <= iceBallRangeSq) {
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
