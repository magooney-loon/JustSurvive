// ─── Healer Abilities ─────────────────────────────────────────────────────────
// heal_player: targeted heal beam on a teammate (also heals self slightly).
// revive_start: begin channeling a revive on a downed player.
// complete_revive: scheduled — finishes the revive channel.

import { SenderError } from 'spacetimedb/server';
import { ScheduleAt } from 'spacetimedb';
import { ts } from '../../helpers.js';
import {
	HEAL_AMOUNT,
	HEAL_RANGE_SQ,
	REVIVE_COOLDOWN_US,
	REVIVE_CHANNEL_US,
	REVIVE_SHIELD_HP,
	ULTIMATE_COOLDOWN_US
} from '../../constants.js';

function findHealerState(ctx: any, sessionId: any, identity: any): any {
	for (const h of ctx.db.healerState.healer_state_session_id.filter(sessionId)) {
		if (h.playerIdentity.isEqual(identity)) return h;
	}
	return null;
}

// ─── heal_player (chain heal) ─────────────────────────────────────────────────
// Auto-targets the lowest HP teammate in range.
// Chains 30% heal to a second teammate in range.

export function healPlayer(ctx: any, { sessionId }: any) {
	let healer: any;
	for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
		if (p.playerIdentity.isEqual(ctx.sender)) { healer = p; break; }
	}
	if (!healer || healer.classChoice !== 'healer') throw new SenderError('Not a Healer');
	if (healer.status !== 'alive') return;

	const hs = findHealerState(ctx, sessionId, ctx.sender);
	if (!hs) return;
	const now = ctx.timestamp.microsSinceUnixEpoch as bigint;
	if (hs.healCooldownUntil && now < (hs.healCooldownUntil.microsSinceUnixEpoch as bigint))
		throw new SenderError('Heal on cooldown');

	// Gather all alive teammates in range (excluding self)
	const inRange: any[] = [];
	for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
		if (p.playerIdentity.isEqual(ctx.sender)) continue;
		if (p.status !== 'alive') continue;
		const dx = (p.posX as bigint) - (healer.posX as bigint);
		const dz = (p.posZ as bigint) - (healer.posZ as bigint);
		if (dx * dx + dz * dz <= HEAL_RANGE_SQ) inRange.push(p);
	}
	if (inRange.length === 0) return;

	// Primary target: lowest HP
	inRange.sort((a, b) => Number((a.hp as bigint) - (b.hp as bigint)));
	const target = inRange[0];
	const newHp = (target.hp as bigint) + HEAL_AMOUNT > (target.maxHp as bigint) ? target.maxHp : (target.hp as bigint) + HEAL_AMOUNT;
	ctx.db.playerState.id.update({ ...target, hp: newHp });

	// Chain target: second player in range (if any), healed for 30%
	let chainTarget: any = null;
	if (inRange.length > 1) {
		chainTarget = inRange[1];
		const CHAIN_HEAL = HEAL_AMOUNT * 3n / 10n;
		const chainHp = (chainTarget.hp as bigint) + CHAIN_HEAL > (chainTarget.maxHp as bigint) ? chainTarget.maxHp : (chainTarget.hp as bigint) + CHAIN_HEAL;
		ctx.db.playerState.id.update({ ...chainTarget, hp: chainHp });
	}

	const healed = newHp > (target.hp as bigint);
	ctx.db.playerState.id.update({ ...healer, score: (healer.score as bigint) + (healed ? 5n : 0n), lastShotAt: ctx.timestamp });
	ctx.db.healerState.id.update({
		...hs,
		healCooldownUntil: ts(now + 3_000_000n),
		lastHealAt: ctx.timestamp,
		healTargetIdentity: target.playerIdentity,
		chainHealTargetIdentity: chainTarget ? chainTarget.playerIdentity : undefined
	});
}

// ─── revive_start ─────────────────────────────────────────────────────────────

export function reviveStart(ctx: any, { sessionId, targetIdentity }: any) {
	let healer: any;
	for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
		if (p.playerIdentity.isEqual(ctx.sender)) { healer = p; break; }
	}
	if (!healer || healer.classChoice !== 'healer') throw new SenderError('Not a Healer');
	if (healer.status !== 'alive') return;

	const hs = findHealerState(ctx, sessionId, ctx.sender);
	if (!hs) return;
	const now = ctx.timestamp.microsSinceUnixEpoch as bigint;
	if (hs.reviveCooldownUntil && now < (hs.reviveCooldownUntil.microsSinceUnixEpoch as bigint))
		throw new SenderError('Revive on cooldown');

	let target: any;
	for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
		if (p.playerIdentity.isEqual(targetIdentity)) { target = p; break; }
	}
	if (!target || target.status !== 'downed') throw new SenderError('Target is not downed');

	const dx = (healer.posX as bigint) - (target.posX as bigint);
	const dz = (healer.posZ as bigint) - (target.posZ as bigint);
	if (dx * dx + dz * dz > 9_000_000n) throw new SenderError('Too far from downed player');

	ctx.db.reviveChannel.insert({
		id: 0n,
		sessionId,
		healerIdentity: ctx.sender,
		targetIdentity,
		channelStartedAt: ctx.timestamp,
		shieldHp: REVIVE_SHIELD_HP
	});

	const completeAt = now + REVIVE_CHANNEL_US;
	ctx.db.reviveCompleteJob.insert({
		scheduledId: 0n,
		scheduledAt: ScheduleAt.time(completeAt),
		sessionId,
		healerIdentity: ctx.sender,
		targetIdentity
	});
}

// ─── complete_revive (scheduled) ──────────────────────────────────────────────

export function completeRevive(ctx: any, { arg }: any) {
	let channel: any;
	for (const c of ctx.db.reviveChannel.revive_channel_session_id.filter(arg.sessionId)) {
		if (c.healerIdentity.isEqual(arg.healerIdentity) && c.targetIdentity.isEqual(arg.targetIdentity)) {
			channel = c; break;
		}
	}
	if (!channel) return;

	let healer: any, target: any;
	for (const p of ctx.db.playerState.player_state_session_id.filter(arg.sessionId)) {
		if (p.playerIdentity.isEqual(arg.healerIdentity)) healer = p;
		if (p.playerIdentity.isEqual(arg.targetIdentity)) target = p;
	}

	if (!healer || !target || target.status !== 'downed') {
		ctx.db.reviveChannel.id.delete(channel.id);
		return;
	}

	const now = ctx.timestamp.microsSinceUnixEpoch as bigint;
	const speedBoostUntil = ts(now + 5_000_000n);
	ctx.db.playerState.id.update({ ...target, hp: 50n, status: 'alive', speedBoostUntil });
	ctx.db.playerState.id.update({ ...healer, hp: healer.maxHp, score: (healer.score as bigint) + 20n });

	const hs = findHealerState(ctx, arg.sessionId, arg.healerIdentity);
	if (hs) {
		ctx.db.healerState.id.update({ ...hs, reviveCooldownUntil: ts(now + REVIVE_COOLDOWN_US) });
	}

	ctx.db.reviveChannel.id.delete(channel.id);
}

// ─── healer_ultimate: Revitalize ─────────────────────────────────────────────
// Heals all alive teammates in range for full HEAL_AMOUNT + gives them a 3s speed boost.

export function healerUltimate(ctx: any, { sessionId }: any) {
	let healer: any;
	for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
		if (p.playerIdentity.isEqual(ctx.sender)) { healer = p; break; }
	}
	if (!healer || healer.classChoice !== 'healer') return;
	if (healer.status !== 'alive') return;

	const hs = findHealerState(ctx, sessionId, ctx.sender);
	if (!hs) return;
	const now = ctx.timestamp.microsSinceUnixEpoch as bigint;
	if (hs.ultimateCooldownUntil && now < (hs.ultimateCooldownUntil.microsSinceUnixEpoch as bigint)) return;

	const speedBoostUntil = ts(now + 3_000_000n);
	let scoreAdd = 0n;

	for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
		if (p.playerIdentity.isEqual(ctx.sender)) continue;
		if (p.status !== 'alive') continue;
		const dx = (p.posX as bigint) - (healer.posX as bigint);
		const dz = (p.posZ as bigint) - (healer.posZ as bigint);
		if (dx * dx + dz * dz > HEAL_RANGE_SQ) continue;
		const newHp = (p.hp as bigint) + HEAL_AMOUNT > (p.maxHp as bigint) ? p.maxHp : (p.hp as bigint) + HEAL_AMOUNT;
		const healed = newHp > (p.hp as bigint);
		ctx.db.playerState.id.update({ ...p, hp: newHp, speedBoostUntil });
		if (healed) scoreAdd += 3n;
	}

	ctx.db.playerState.id.update({ ...healer, score: (healer.score as bigint) + scoreAdd, lastShotAt: ctx.timestamp });
	ctx.db.healerState.id.update({ ...hs, ultimateCooldownUntil: ts(now + ULTIMATE_COOLDOWN_US), lastUltimateAt: ctx.timestamp });
}
