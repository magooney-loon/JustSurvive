// ─── Enemy Tick (scheduled) ───────────────────────────────────────────────────────
// Main AI loop: target selection, pre-checks (brace/shield), dispatch to
// per-type handlers, accumulated damage application, brace heal.

import { ScheduleAt } from 'spacetimedb';
import { ts, bigintSqrt as bs, pseudoRand } from '../../helpers.js';
import {
	TICK_MS,
	MELEE_RANGE,
	REVIVE_SHIELD_KNOCKBACK,
	BOSS_SPAWN_INTERVAL_US,
	TARGET_JITTER,
	MAX_ENEMIES_PER_PLAYER,
	HEALER_REGEN_BASE,
	HEALER_REGEN_MAX,
	HEALER_REGEN_RAMP_US,
	CHARGE_COOLDOWN_US,
	CHARGE_BOOST_US,
	CHARGE_DAMAGE,
	CHARGE_KNOCKBACK,
	CHARGE_HIT_RADIUS,
	ITEM_PICKUP_RADIUS_SQ,
	ITEM_EXPIRE_US,
	ITEM_HP_RESTORE,
	ITEM_BUFF_US,
	ITEM_DROP_HP_MAX,
	ITEM_DROP_STAMINA_MAX,
	ITEM_DROP_DMG_MAX,
	ITEM_DROP_SPD_MAX
} from '../../constants.js';
import { applyAccumulatedDamage } from '../shared.js';
import { handleSpitter } from './types/spitter.js';
import { handleCaster } from './types/caster.js';
import { handleMelee } from './types/melee.js';
import { handleBoss } from './types/boss.js';

export function enemyTick(ctx: any, { arg }: any) {
	const session = ctx.db.gameSession.id.find(arg.sessionId);
	if (!session || session.status !== 'active') return;

	const players = [...ctx.db.playerState.player_state_session_id.filter(arg.sessionId)].filter(
		(p: any) => p.status === 'alive'
	);
	const enemies = [...ctx.db.enemy.enemy_session_id.filter(arg.sessionId)].filter(
		(e: any) => e.isAlive
	);
	const now = ctx.timestamp.microsSinceUnixEpoch as bigint;

	// Build tankState map: playerId → tankState row
	const tankStateMap = new Map<bigint, any>();
	for (const tankSt of ctx.db.tankState.tank_state_session_id.filter(arg.sessionId)) {
		const player = players.find((p: any) => p.playerIdentity.isEqual(tankSt.playerIdentity));
		if (player) tankStateMap.set(player.id as bigint, tankSt);
	}

	// Clean up expired marks
	for (const m of ctx.db.mark.mark_session_id.filter(arg.sessionId)) {
		if ((m.expiresAt.microsSinceUnixEpoch as bigint) < now) {
			ctx.db.mark.id.delete(m.id);
		}
	}

	// Clean up dead enemies after 5 seconds — roll item drop on cleanup
	const DEAD_CLEANUP_US = 5_000_000n;
	for (const e of ctx.db.enemy.enemy_session_id.filter(arg.sessionId)) {
		if (!e.isAlive && e.diedAt && now - (e.diedAt.microsSinceUnixEpoch as bigint) >= DEAD_CLEANUP_US) {
			const roll = pseudoRand((e.id as bigint) ^ now, 100);
			let itemType: string | null = null;
			if (roll < ITEM_DROP_HP_MAX) itemType = 'hp';
			else if (roll < ITEM_DROP_STAMINA_MAX) itemType = 'stamina';
			else if (roll < ITEM_DROP_DMG_MAX) itemType = 'double_damage';
			else if (roll < ITEM_DROP_SPD_MAX) itemType = 'double_speed';
			if (itemType) {
				ctx.db.droppedItem.insert({
					id: 0n,
					sessionId: arg.sessionId,
					itemType,
					posX: e.posX,
					posZ: e.posZ,
					spawnedAt: ctx.timestamp
				});
			}
			ctx.db.enemy.id.delete(e.id);
		}
	}

	// ── Tank charge tick ─────────────────────────────────────────────────────
	// Client drives movement during charge (high speed cap in movePlayer).
	// Per tick: check expiry → end charge + speed boost; hit nearby enemies.
	const CHARGE_HIT_RADIUS_SQ = CHARGE_HIT_RADIUS * CHARGE_HIT_RADIUS;
	for (const [playerId, tankSt] of tankStateMap) {
		if (!tankSt.isCharging) continue;
		const p = players.find((pl: any) => pl.id === playerId);
		if (!p) continue;

		if (tankSt.chargeUntil && now >= (tankSt.chargeUntil.microsSinceUnixEpoch as bigint)) {
			// End charge — apply speed boost
			ctx.db.playerState.id.update({ ...p, speedBoostUntil: ts(now + CHARGE_BOOST_US) });
			const updated = {
				...tankSt,
				isCharging: false,
				chargeUntil: undefined,
				chargeDirX: 0n,
				chargeDirZ: 0n,
				chargeCooldownUntil: ts(now + CHARGE_COOLDOWN_US)
			};
			ctx.db.tankState.id.update(updated);
			tankStateMap.set(playerId, updated);
			continue;
		}

		// Hit enemies near the charging tank (use current server position from movePlayer calls)
		for (const e of ctx.db.enemy.enemy_session_id.filter(arg.sessionId)) {
			if (!e.isAlive) continue;
			const ex = (e.posX as bigint) - (p.posX as bigint);
			const ez = (e.posZ as bigint) - (p.posZ as bigint);
			if (ex * ex + ez * ez > CHARGE_HIT_RADIUS_SQ) continue;

			const cross = tankSt.chargeDirX * ez - tankSt.chargeDirZ * ex;
			const perpX = cross >= 0n ? tankSt.chargeDirZ : -tankSt.chargeDirZ;
			const perpZ = cross >= 0n ? -tankSt.chargeDirX : tankSt.chargeDirX;
			const knockX = (perpX * CHARGE_KNOCKBACK) / 1000n;
			const knockZ = (perpZ * CHARGE_KNOCKBACK) / 1000n;
			const newHp = (e.hp as bigint) > CHARGE_DAMAGE ? (e.hp as bigint) - CHARGE_DAMAGE : 0n;
			if (newHp <= 0n) {
				ctx.db.enemy.id.update({ ...e, hp: 0n, isAlive: false, posX: (e.posX as bigint) + knockX, posZ: (e.posZ as bigint) + knockZ, diedAt: ts(now) });
			} else {
				ctx.db.enemy.id.update({ ...e, hp: newHp, posX: (e.posX as bigint) + knockX, posZ: (e.posZ as bigint) + knockZ });
			}
		}
	}

	const aliveBossesEarlyCheck = [...ctx.db.boss.boss_session_id.filter(arg.sessionId)].filter(
		(b: any) => b.isAlive
	);
	if (players.length === 0 || (enemies.length === 0 && aliveBossesEarlyCheck.length === 0)) {
		ctx.db.enemyTickJob.insert({
			scheduledId: 0n,
			scheduledAt: ScheduleAt.time(now + TICK_MS * 1000n),
			sessionId: arg.sessionId
		});
		return;
	}

	// Build set of healer IDs currently channeling a revive (for shield knockback)
	const revisingHealerPlayerIds = new Set<bigint>();
	for (const c of ctx.db.reviveChannel.revive_channel_session_id.filter(arg.sessionId)) {
		const healer = players.find((p: any) => p.playerIdentity.isEqual(c.healerIdentity));
		if (healer) revisingHealerPlayerIds.add(healer.id as bigint);
	}

	const damageAccum = new Map<bigint, bigint>();
	const targetCounts = new Map<bigint, number>();

	for (const enemy of enemies) {
		// ── Target selection ──────────────────────────────────────────────────
		let chosen = players[0];
		let chosenDist = BigInt(Number.MAX_SAFE_INTEGER);
		let bestAny = players[0];
		let bestAnyDist = BigInt(Number.MAX_SAFE_INTEGER);
		let bestAnyScore = Number.POSITIVE_INFINITY;
		let bestCap = players[0];
		let bestCapDist = BigInt(Number.MAX_SAFE_INTEGER);
		let bestCapScore = Number.POSITIVE_INFINITY;

		for (const p of players) {
			const dx = (p.posX as bigint) - (enemy.posX as bigint);
			const dz = (p.posZ as bigint) - (enemy.posZ as bigint);
			const dist = dx * dx + dz * dz;
			const baseScore = Number(dist);
			const jitterSeed = (now + (enemy.id as bigint) + (p.id as bigint)) % 1000n;
			const jitter = (Number(jitterSeed) / 1000 - 0.5) * TARGET_JITTER;
			const score = baseScore * (1 + jitter);
			if (score < bestAnyScore) {
				bestAnyScore = score;
				bestAny = p;
				bestAnyDist = dist;
			}
			const count = targetCounts.get(p.id as bigint) ?? 0;
			if (count < MAX_ENEMIES_PER_PLAYER && score < bestCapScore) {
				bestCapScore = score;
				bestCap = p;
				bestCapDist = dist;
			}
		}

		if (bestCapScore < Number.POSITIVE_INFINITY) {
			chosen = bestCap;
			chosenDist = bestCapDist;
		} else {
			chosen = bestAny;
			chosenDist = bestAnyDist;
		}
		targetCounts.set(chosen.id as bigint, (targetCounts.get(chosen.id as bigint) ?? 0) + 1);

		const dx = (chosen.posX as bigint) - (enemy.posX as bigint);
		const dz = (chosen.posZ as bigint) - (enemy.posZ as bigint);

		// ── Per-type dispatch ─────────────────────────────────────────────────
		if (enemy.enemyType === 'spitter') {
			handleSpitter(ctx, enemy, chosen, dx, dz, chosenDist, now, damageAccum, arg.sessionId);
			continue;
		}
		if (enemy.enemyType === 'caster') {
			handleCaster(ctx, enemy, chosen, dx, dz, chosenDist, now, damageAccum, arg.sessionId);
			continue;
		}

		// ── Melee pre-checks (brace knockback, revive shield) ─────────────────
		const enemyRange = MELEE_RANGE;
		const chosenTankState = tankStateMap.get(chosen.id as bigint);

		// Tank charging: enemies in charge radius are handled in charge tick above — skip melee here
		if (chosenDist <= MELEE_RANGE * MELEE_RANGE && chosenTankState?.isCharging) {
			continue;
		}

		// Healer revive shield: knock enemy back without dazing
		if (
			chosenDist <= enemyRange * enemyRange &&
			!enemy.isDazed &&
			revisingHealerPlayerIds.has(chosen.id as bigint)
		) {
			const magnitude = bs(chosenDist);
			const newX = magnitude > 0n ? (enemy.posX as bigint) - (dx * REVIVE_SHIELD_KNOCKBACK) / magnitude : (enemy.posX as bigint) - REVIVE_SHIELD_KNOCKBACK;
			const newZ = magnitude > 0n ? (enemy.posZ as bigint) - (dz * REVIVE_SHIELD_KNOCKBACK) / magnitude : (enemy.posZ as bigint) - REVIVE_SHIELD_KNOCKBACK;
			ctx.db.enemy.id.update({ ...enemy, posX: newX, posZ: newZ });
			continue;
		}

		// ── Melee attack / movement ───────────────────────────────────────────
		handleMelee(ctx, enemy, chosen, dx, dz, chosenDist, now, damageAccum, enemyRange);
	}

	// Apply all accumulated damage — one write per player
	applyAccumulatedDamage(ctx, arg.sessionId, players, damageAccum);

	// Healer passive self-regen: 2 HP/s base, ramps to 10 HP/s after 5s without damage
	// Uses milliHP carry in HealerState to handle fractional per-tick rates
	const healerStateMap = new Map<bigint, any>();
	for (const hs of ctx.db.healerState.healer_state_session_id.filter(arg.sessionId)) {
		const p = players.find((pl: any) => pl.playerIdentity.isEqual(hs.playerIdentity));
		if (p) healerStateMap.set(p.id as bigint, hs);
	}

	for (const p of players) {
		if (p.classChoice !== 'healer') continue;
		if ((p.hp as bigint) >= (p.maxHp as bigint)) continue;
		const hs = healerStateMap.get(p.id as bigint);
		if (!hs) continue;

		const timeSinceDmg = p.lastDamagedAt
			? now - (p.lastDamagedAt.microsSinceUnixEpoch as bigint)
			: HEALER_REGEN_RAMP_US;
		const rate = timeSinceDmg >= HEALER_REGEN_RAMP_US ? HEALER_REGEN_MAX : HEALER_REGEN_BASE;

		const newCarry = (hs.regenCarry as bigint) + rate;
		const hpToHeal = newCarry / 1000n;
		const remainCarry = newCarry % 1000n;

		ctx.db.healerState.id.update({ ...hs, regenCarry: remainCarry });

		if (hpToHeal > 0n) {
			const newHp = (p.hp as bigint) + hpToHeal > (p.maxHp as bigint)
				? p.maxHp
				: (p.hp as bigint) + hpToHeal;
			ctx.db.playerState.id.update({ ...p, hp: newHp });
		}
	}

	// ── Boss dead cleanup + boss AI ──────────────────────────────────────────
	const BOSS_DEAD_CLEANUP_US = 5_000_000n;
	for (const b of ctx.db.boss.boss_session_id.filter(arg.sessionId)) {
		if (!b.isAlive && b.diedAt && now - (b.diedAt.microsSinceUnixEpoch as bigint) >= BOSS_DEAD_CLEANUP_US) {
			// Boss always drops 3 items in a triangle around death position
			const bossDrops: Array<[string, bigint, bigint]> = [
				['hp',           (b.posX as bigint) + 2000n, (b.posZ as bigint)],
				['double_damage',(b.posX as bigint) - 1000n, (b.posZ as bigint) + 1800n],
				['double_speed', (b.posX as bigint) - 1000n, (b.posZ as bigint) - 1800n]
			];
			for (const [itemType, px, pz] of bossDrops) {
				ctx.db.droppedItem.insert({
					id: 0n, sessionId: arg.sessionId, itemType, posX: px, posZ: pz, spawnedAt: ctx.timestamp
				});
			}
			ctx.db.boss.id.delete(b.id);
			const nextBossAt = now + BOSS_SPAWN_INTERVAL_US;
			ctx.db.bossSpawnJob.insert({
				scheduledId: 0n,
				scheduledAt: ScheduleAt.time(nextBossAt),
				sessionId: arg.sessionId
			});
			ctx.db.bossTimer.insert({
				id: 0n,
				sessionId: arg.sessionId,
				spawnAt: ts(nextBossAt)
			});
		}
	}

	if (players.length > 0) {
		const aliveBosses = [...ctx.db.boss.boss_session_id.filter(arg.sessionId)].filter(
			(b: any) => b.isAlive
		);
		if (aliveBosses.length > 0) {
			const bossDamageAccum = new Map<bigint, bigint>();
			for (const boss of aliveBosses) {
				handleBoss(ctx, boss, players, now, bossDamageAccum, arg.sessionId);
			}
			applyAccumulatedDamage(ctx, arg.sessionId, players, bossDamageAccum);
		}
	}

	// ── Item drop pickup + expiry ─────────────────────────────────────────────
	// Reuse the already-fetched `players` array — no extra DB queries per item
	const allPlayers = [...ctx.db.playerState.player_state_session_id.filter(arg.sessionId)];
	const pickedUp = new Set<bigint>();
	for (const item of ctx.db.droppedItem.dropped_item_session_id.filter(arg.sessionId)) {
		// Expire stale items
		if (now - (item.spawnedAt.microsSinceUnixEpoch as bigint) >= ITEM_EXPIRE_US) {
			ctx.db.droppedItem.id.delete(item.id);
			continue;
		}
		for (const p of allPlayers) {
			if (p.status !== 'alive') continue;
			if (pickedUp.has(p.id as bigint)) continue;
			const dx = (p.posX as bigint) - (item.posX as bigint);
			const dz = (p.posZ as bigint) - (item.posZ as bigint);
			if (dx * dx + dz * dz > ITEM_PICKUP_RADIUS_SQ) continue;

			let updated = { ...p };
			if (item.itemType === 'hp') {
				const newHp = (p.hp as bigint) + ITEM_HP_RESTORE > (p.maxHp as bigint)
					? p.maxHp : (p.hp as bigint) + ITEM_HP_RESTORE;
				updated = { ...updated, hp: newHp };
			} else if (item.itemType === 'stamina') {
				updated = { ...updated, stamina: p.maxStamina };
			} else if (item.itemType === 'double_damage') {
				updated = { ...updated, doubleDamageUntil: ts(now + ITEM_BUFF_US) };
			} else if (item.itemType === 'double_speed') {
				updated = { ...updated, speedBoostUntil: ts(now + ITEM_BUFF_US) };
			}
			ctx.db.playerState.id.update(updated);
			ctx.db.droppedItem.id.delete(item.id);
			pickedUp.add(p.id as bigint);
			break;
		}
	}

	ctx.db.enemyTickJob.insert({
		scheduledId: 0n,
		scheduledAt: ScheduleAt.time(now + TICK_MS * 1000n),
		sessionId: arg.sessionId
	});
}
