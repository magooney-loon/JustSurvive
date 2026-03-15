// ─── Spotter Abilities ────────────────────────────────────────────────────────
// steady_shot: ranged shot that marks the target.
// spotter_flash: cone flash that stuns and damages enemies in front.

import { SenderError } from 'spacetimedb/server';
import { ts } from '../../helpers.js';
import {
	STEADY_SHOT_DAMAGE,
	STEADY_SHOT_RANGE_SQ,
	STEADY_SHOT_COOLDOWN_US,
	MARK_DURATION_US,
	MARK_DAMAGE_BONUS,
	FLASH_CONE_RANGE,
	FLASH_COOLDOWN_US,
	FLASH_STUN_US,
	FLASH_DAMAGE,
	ULTIMATE_COOLDOWN_US
} from '../../constants.js';

function findSpotterState(ctx: any, sessionId: any, identity: any): any {
	for (const s of ctx.db.spotterState.spotter_state_session_id.filter(sessionId)) {
		if (s.playerIdentity.isEqual(identity)) return s;
	}
	return null;
}

// ─── steady_shot ──────────────────────────────────────────────────────────────

export function steadyShot(ctx: any, { sessionId, enemyId }: any) {
	let ps: any;
	for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
		if (p.playerIdentity.isEqual(ctx.sender)) {
			ps = p;
			break;
		}
	}
	if (!ps || ps.classChoice !== 'spotter') throw new SenderError('Not a Spotter');
	if (ps.status !== 'alive') return;

	const ss = findSpotterState(ctx, sessionId, ctx.sender);
	if (!ss) return;
	if (
		ss.steadyShotCooldownUntil &&
		(ctx.timestamp.microsSinceUnixEpoch as bigint) <
			(ss.steadyShotCooldownUntil.microsSinceUnixEpoch as bigint)
	)
		throw new SenderError('Steady Shot on cooldown');

	const enemy = ctx.db.enemy.id.find(enemyId);
	let boss = ctx.db.boss.id.find(enemyId);
	if (!enemy && !boss) return;
	const target = enemy ?? boss;
	if (!target.isAlive) return;

	const dx = (target.posX as bigint) - (ps.posX as bigint);
	const dz = (target.posZ as bigint) - (ps.posZ as bigint);
	if (dx * dx + dz * dz > STEADY_SHOT_RANGE_SQ) return;

	const now = ctx.timestamp.microsSinceUnixEpoch as bigint;
	const isAlreadyMarked =
		target.isMarked &&
		target.markedUntil &&
		now < (target.markedUntil.microsSinceUnixEpoch as bigint);
	const dmg = isAlreadyMarked ? STEADY_SHOT_DAMAGE + MARK_DAMAGE_BONUS : STEADY_SHOT_DAMAGE;
	const newHp = (target.hp as bigint) > dmg ? (target.hp as bigint) - dmg : 0n;
	const markedUntil = ts(now + MARK_DURATION_US);
	const cooldownUntil = ts(now + STEADY_SHOT_COOLDOWN_US);
	let scoreAdd = 0n;
	const isBoss = !!boss;

	// Primary target: full damage, always marked
	if (newHp <= 0n) {
		if (isBoss) {
			ctx.db.boss.id.update({
				...boss,
				hp: 0n,
				isAlive: false,
				isMarked: true,
				markedUntil,
				diedAt: ts(now)
			});
		} else {
			ctx.db.enemy.id.update({
				...enemy,
				hp: 0n,
				isAlive: false,
				isMarked: true,
				markedUntil,
				diedAt: ts(now)
			});
		}
		scoreAdd += isBoss ? 50n : 1n;
	} else {
		if (isBoss) {
			ctx.db.boss.id.update({ ...boss, hp: newHp, isMarked: true, markedUntil });
		} else {
			ctx.db.enemy.id.update({ ...enemy, hp: newHp, isMarked: true, markedUntil });
		}
		scoreAdd += isBoss ? 25n : isAlreadyMarked ? 0n : 3n;
	}

	// ── Pierce: collect all enemies along the shot line, sorted by distance ──
	// Width: 1.5 world units perpendicular to shot direction.
	// Damage falls off 75% → 50% → 25% per step.
	// Only the last pierced enemy gets marked.
	const PIERCE_WIDTH_SQ = 2_250_000n;
	const distSq = dx * dx + dz * dz;
	const pierceTargets: Array<{ e: any; proj: bigint }> = [];
	for (const e of ctx.db.enemy.enemy_session_id.filter(sessionId)) {
		if (!e.isAlive || (e.id as bigint) === (enemy.id as bigint)) continue;
		const ex = (e.posX as bigint) - (ps.posX as bigint);
		const ez = (e.posZ as bigint) - (ps.posZ as bigint);
		const proj = ex * dx + ez * dz;
		if (proj <= 0n || proj * proj > STEADY_SHOT_RANGE_SQ * distSq) continue;
		const cross = ex * dz - ez * dx;
		if (cross * cross > PIERCE_WIDTH_SQ * distSq) continue;
		pierceTargets.push({ e, proj });
	}
	pierceTargets.sort((a, b) => Number(a.proj - b.proj));

	for (let i = 0; i < pierceTargets.length; i++) {
		const { e } = pierceTargets[i];
		const isLast = i === pierceTargets.length - 1;
		const falloffPct = BigInt(Math.max(25, 75 - i * 25));
		const pierceDmg = (STEADY_SHOT_DAMAGE * falloffPct) / 100n;
		const pierceHp = (e.hp as bigint) > pierceDmg ? (e.hp as bigint) - pierceDmg : 0n;
		if (pierceHp <= 0n) {
			ctx.db.enemy.id.update({
				...e,
				hp: 0n,
				isAlive: false,
				isMarked: isLast,
				markedUntil: isLast ? markedUntil : e.markedUntil,
				diedAt: ts(now)
			});
		} else {
			ctx.db.enemy.id.update({
				...e,
				hp: pierceHp,
				isMarked: isLast,
				markedUntil: isLast ? markedUntil : e.markedUntil
			});
		}
		scoreAdd += 1n;
	}

	ctx.db.playerState.id.update({
		...ps,
		score: (ps.score as bigint) + scoreAdd,
		lastShotAt: ctx.timestamp
	});
	ctx.db.spotterState.id.update({ ...ss, steadyShotCooldownUntil: cooldownUntil });
}

// ─── spotter_flash ────────────────────────────────────────────────────────────

export function spotterFlash(ctx: any, { sessionId }: any) {
	let ps: any;
	for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
		if (p.playerIdentity.isEqual(ctx.sender)) {
			ps = p;
			break;
		}
	}
	if (!ps || ps.classChoice !== 'spotter') throw new SenderError('Not a Spotter');
	if (ps.status !== 'alive') return;

	const ss = findSpotterState(ctx, sessionId, ctx.sender);
	if (!ss) return;
	const now = ctx.timestamp.microsSinceUnixEpoch as bigint;
	if (ss.flashCooldownUntil && now < (ss.flashCooldownUntil.microsSinceUnixEpoch as bigint))
		throw new SenderError('Flash on cooldown');

	const HALF_ANGLE = Math.PI / 4;
	const facingRad = Number(ps.facingAngle) / 1000;
	const fwdX = -Math.sin(facingRad);
	const fwdZ = -Math.cos(facingRad);
	const cosHalf = Math.cos(HALF_ANGLE);

	let stunned = 0n;
	for (const e of ctx.db.enemy.enemy_session_id.filter(sessionId)) {
		if (!e.isAlive) continue;
		const ex = Number(e.posX) - Number(ps.posX);
		const ez = Number(e.posZ) - Number(ps.posZ);
		const dist = Math.sqrt(ex * ex + ez * ez);
		if (dist > FLASH_CONE_RANGE || dist < 1) continue;
		const dot = (ex * fwdX + ez * fwdZ) / dist;
		if (dot < cosHalf) continue;
		const dazedUntil = ts(now + FLASH_STUN_US);
		const newHp = (e.hp as bigint) > FLASH_DAMAGE ? (e.hp as bigint) - FLASH_DAMAGE : 0n;
		if (newHp <= 0n) {
			ctx.db.enemy.id.update({
				...e,
				hp: 0n,
				isAlive: false,
				isDazed: true,
				dazedUntil,
				diedAt: ts(now)
			});
		} else {
			ctx.db.enemy.id.update({ ...e, hp: newHp, isDazed: true, dazedUntil });
		}
		stunned += 1n;
	}

	for (const b of ctx.db.boss.boss_session_id.filter(sessionId)) {
		if (!b.isAlive) continue;
		const bx = Number(b.posX) - Number(ps.posX);
		const bz = Number(b.posZ) - Number(ps.posZ);
		const dist = Math.sqrt(bx * bx + bz * bz);
		if (dist > FLASH_CONE_RANGE || dist < 1) continue;
		const dot = (bx * fwdX + bz * fwdZ) / dist;
		if (dot < cosHalf) continue;
		const dazedUntil = ts(now + FLASH_STUN_US);
		const newHp = (b.hp as bigint) > FLASH_DAMAGE ? (b.hp as bigint) - FLASH_DAMAGE : 0n;
		if (newHp <= 0n) {
			ctx.db.boss.id.update({
				...b,
				hp: 0n,
				isAlive: false,
				isDazed: true,
				dazedUntil,
				diedAt: ts(now)
			});
		} else {
			ctx.db.boss.id.update({ ...b, hp: newHp, isDazed: true, dazedUntil });
		}
		stunned += 10n;
	}

	ctx.db.playerState.id.update({ ...ps, score: (ps.score as bigint) + stunned * 10n });
	ctx.db.spotterState.id.update({
		...ss,
		flashCooldownUntil: ts(now + FLASH_COOLDOWN_US),
		lastFlashAt: ctx.timestamp
	});
}

// ─── spotter_ultimate: Barrage ────────────────────────────────────────────────
// Marks and damages ALL enemies within steady shot range simultaneously.

export function spotterUltimate(ctx: any, { sessionId }: any) {
	let ps: any;
	for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
		if (p.playerIdentity.isEqual(ctx.sender)) {
			ps = p;
			break;
		}
	}
	if (!ps || ps.classChoice !== 'spotter') return;
	if (ps.status !== 'alive') return;

	const ss = findSpotterState(ctx, sessionId, ctx.sender);
	if (!ss) return;
	const now = ctx.timestamp.microsSinceUnixEpoch as bigint;
	if (ss.ultimateCooldownUntil && now < (ss.ultimateCooldownUntil.microsSinceUnixEpoch as bigint))
		return;

	const BARRAGE_DAMAGE = 20n;
	const markedUntil = ts(now + MARK_DURATION_US);
	let scoreAdd = 0n;

	for (const e of ctx.db.enemy.enemy_session_id.filter(sessionId)) {
		if (!e.isAlive) continue;
		const ex = (e.posX as bigint) - (ps.posX as bigint);
		const ez = (e.posZ as bigint) - (ps.posZ as bigint);
		if (ex * ex + ez * ez > STEADY_SHOT_RANGE_SQ) continue;
		const newHp = (e.hp as bigint) > BARRAGE_DAMAGE ? (e.hp as bigint) - BARRAGE_DAMAGE : 0n;
		if (newHp <= 0n) {
			ctx.db.enemy.id.update({
				...e,
				hp: 0n,
				isAlive: false,
				isMarked: true,
				markedUntil,
				diedAt: ts(now)
			});
			scoreAdd += 2n;
		} else {
			ctx.db.enemy.id.update({ ...e, hp: newHp, isMarked: true, markedUntil });
			scoreAdd += 1n;
		}
	}

	for (const b of ctx.db.boss.boss_session_id.filter(sessionId)) {
		if (!b.isAlive) continue;
		const bx = (b.posX as bigint) - (ps.posX as bigint);
		const bz = (b.posZ as bigint) - (ps.posZ as bigint);
		if (bx * bx + bz * bz > STEADY_SHOT_RANGE_SQ) continue;
		const newHp = (b.hp as bigint) > BARRAGE_DAMAGE ? (b.hp as bigint) - BARRAGE_DAMAGE : 0n;
		if (newHp <= 0n) {
			ctx.db.boss.id.update({
				...b,
				hp: 0n,
				isAlive: false,
				isMarked: true,
				markedUntil,
				diedAt: ts(now)
			});
			scoreAdd += 50n;
		} else {
			ctx.db.boss.id.update({ ...b, hp: newHp, isMarked: true, markedUntil });
			scoreAdd += 25n;
		}
	}

	ctx.db.playerState.id.update({
		...ps,
		score: (ps.score as bigint) + scoreAdd,
		lastShotAt: ctx.timestamp
	});
	ctx.db.spotterState.id.update({
		...ss,
		ultimateCooldownUntil: ts(now + ULTIMATE_COOLDOWN_US),
		lastUltimateAt: ctx.timestamp
	});
}
