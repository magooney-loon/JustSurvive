// ─── Worm Monster Boss Handler ─────────────────────────────────────────────────
// Ability 1: Chain Charge — deal damage to ALL players within 20 units
// Ability 2: Burrow — sink at current position, teleport on emerge

import { ts } from '../../../../helpers.js';
import {
	BOSS_DAMAGE,
	WORM_ABILITY1_COOLDOWN_US,
	WORM_ABILITY2_COOLDOWN_US,
	WORM_BURROW_DURATION_US,
	WORM_CHAIN_RANGE_SQ
} from '../../../../constants.js';
import { bossMove, bossAttack } from '../boss_helpers.js';

export function handleWormMonster(
	ctx: any,
	boss: any,
	players: any[],
	now: bigint,
	damageAccum: Map<bigint, bigint>,
	abilitiesLocked: boolean,
	playerScale: bigint = 100n
): any {
	// Auto-emerge after WORM_BURROW_DURATION_US — teleport near a random player on emerge
	if (boss.isBurrowed && boss.ability2CooldownUntil) {
		const firedAt =
			(boss.ability2CooldownUntil.microsSinceUnixEpoch as bigint) - WORM_ABILITY2_COOLDOWN_US;
		if (now >= firedAt + WORM_BURROW_DURATION_US) {
			// Pick a random player based on firedAt seed
			if (players.length > 0) {
				const playerIndex = Number(firedAt % BigInt(players.length));
				const targetPlayer = players[playerIndex];
				// Random offset from player
				const offsetSeed = firedAt % 1000n;
				const angle = (Number(offsetSeed) / 1000) * Math.PI * 2;
				const distance = 5000 + Number((firedAt / 13n) % 10000n); // 5000-15000 units away
				const offsetX = BigInt(Math.round(Math.cos(angle) * distance));
				const offsetZ = BigInt(Math.round(Math.sin(angle) * distance));
				const newX = (targetPlayer.posX as bigint) + offsetX;
				const newZ = (targetPlayer.posZ as bigint) + offsetZ;
				boss = { ...boss, isBurrowed: false, posX: newX, posZ: newZ };
			}
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
		const baseDmg = BOSS_DAMAGE[boss.bossType] ?? 7n;
		const dmg = (baseDmg * playerScale) / 100n;
		for (const p of players) {
			const pdx = (p.posX as bigint) - (boss.posX as bigint);
			const pdz = (p.posZ as bigint) - (boss.posZ as bigint);
			if (pdx * pdx + pdz * pdz <= WORM_CHAIN_RANGE_SQ) {
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
