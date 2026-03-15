// ─── Gunner Abilities ─────────────────────────────────────────────────────────
// attack_enemy: ranged shot with optional suppression (brief daze).
// adrenaline: instantly refills stamina (5s cooldown).

import { SenderError } from 'spacetimedb/server';
import { ts, damageMultiplier } from '../../helpers.js';
import { WEAPON_DAMAGE, MARK_DAMAGE_BONUS, ULTIMATE_COOLDOWN_US } from '../../constants.js';

function findGunnerState(ctx: any, sessionId: any, identity: any): any {
	for (const g of ctx.db.gunnerState.gunner_state_session_id.filter(sessionId)) {
		if (g.playerIdentity.isEqual(identity)) return g;
	}
	return null;
}

// ─── attack_enemy ─────────────────────────────────────────────────────────────

export function attackEnemy(ctx: any, { sessionId, enemyId, suppress }: any) {
	let ps: any;
	for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
		if (p.playerIdentity.isEqual(ctx.sender)) {
			ps = p;
			break;
		}
	}
	if (!ps || ps.classChoice !== 'gunner') throw new SenderError('Not a Gunner');
	if (ps.status !== 'alive') return;

	const enemy = ctx.db.enemy.id.find(enemyId);
	const boss = ctx.db.boss.id.find(enemyId);
	if (!enemy && !boss) return;
	const target = enemy ?? boss;
	if (!target.isAlive) return;

	const dx = (target.posX as bigint) - (ps.posX as bigint);
	const dz = (target.posZ as bigint) - (ps.posZ as bigint);
	if (dx * dx + dz * dz > 100_000_000n) return;

	const now = ctx.timestamp.microsSinceUnixEpoch as bigint;
	const baseDmg = WEAPON_DAMAGE[ps.classChoice] ?? 15n;
	const isMarked =
		target.isMarked &&
		target.markedUntil &&
		now < (target.markedUntil.microsSinceUnixEpoch as bigint);
	const dmg = (isMarked ? baseDmg + MARK_DAMAGE_BONUS : baseDmg) * damageMultiplier(ps, now);
	const newHp = (target.hp as bigint) > dmg ? (target.hp as bigint) - dmg : 0n;
	const isBoss = !!boss;

	if (newHp <= 0n) {
		if (isBoss) {
			ctx.db.boss.id.update({ ...boss, hp: 0n, isAlive: false, diedAt: ts(now) });
		} else {
			ctx.db.enemy.id.update({ ...enemy, hp: 0n, isAlive: false, diedAt: ts(now) });
		}
		ctx.db.playerState.id.update({
			...ps,
			score: (ps.score as bigint) + (isBoss ? 50n : 2n),
			lastShotAt: ctx.timestamp
		});
	} else {
		let updatedTarget = { ...target, hp: newHp };
		if (suppress && isBoss) {
			// Check if boss was already dazed recently — 5 second cooldown
			const GUNNER_SUPPRESS_COOLDOWN_US = 5_000_000n;
			const canSuppress =
				!target.isDazed ||
				!target.dazedUntil ||
				now >= (target.dazedUntil.microsSinceUnixEpoch as bigint) + GUNNER_SUPPRESS_COOLDOWN_US;
			if (canSuppress) {
				updatedTarget = { ...updatedTarget, isDazed: true, dazedUntil: ts(now + 1_000_000n) };
			}
		} else if (suppress) {
			updatedTarget = { ...updatedTarget, isDazed: true, dazedUntil: ts(now + 1_000_000n) };
		}
		if (isBoss) {
			ctx.db.boss.id.update(updatedTarget);
		} else {
			ctx.db.enemy.id.update(updatedTarget);
		}
		ctx.db.playerState.id.update({
			...ps,
			score: (ps.score as bigint) + (isBoss ? 10n : 1n),
			lastShotAt: ctx.timestamp
		});
	}
}

// ─── adrenaline ───────────────────────────────────────────────────────────────

export function adrenaline(ctx: any, { sessionId }: any) {
	let ps: any;
	for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
		if (p.playerIdentity.isEqual(ctx.sender)) {
			ps = p;
			break;
		}
	}
	if (!ps || ps.classChoice !== 'gunner') throw new SenderError('Not a Gunner');
	if (ps.status !== 'alive') return;

	const gs = findGunnerState(ctx, sessionId, ctx.sender);
	if (!gs) return;
	const now = ctx.timestamp.microsSinceUnixEpoch as bigint;
	if (
		gs.adrenalineCooldownUntil &&
		(gs.adrenalineCooldownUntil.microsSinceUnixEpoch as bigint) > now
	)
		return;

	ctx.db.playerState.id.update({ ...ps, stamina: ps.maxStamina, lastMoveAt: ctx.timestamp });
	ctx.db.gunnerState.id.update({ ...gs, adrenalineCooldownUntil: ts(now + 5_000_000n) });
}

// ─── gunner_ultimate: Frenzy ──────────────────────────────────────────────────
// Damages and dazes all enemies within 15 world units.

export function gunnerUltimate(ctx: any, { sessionId }: any) {
	let ps: any;
	for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
		if (p.playerIdentity.isEqual(ctx.sender)) {
			ps = p;
			break;
		}
	}
	if (!ps || ps.classChoice !== 'gunner') return;
	if (ps.status !== 'alive') return;

	const gs = findGunnerState(ctx, sessionId, ctx.sender);
	if (!gs) return;
	const now = ctx.timestamp.microsSinceUnixEpoch as bigint;
	if (gs.ultimateCooldownUntil && now < (gs.ultimateCooldownUntil.microsSinceUnixEpoch as bigint))
		return;

	const FRENZY_RANGE_SQ = 225_000_000n; // 15 world units
	const FRENZY_DAMAGE = (WEAPON_DAMAGE['gunner'] ?? 15n) * damageMultiplier(ps, now);
	const FRENZY_DAZE_US = 2_000_000n;
	let scoreAdd = 0n;

	for (const e of ctx.db.enemy.enemy_session_id.filter(sessionId)) {
		if (!e.isAlive) continue;
		const ex = (e.posX as bigint) - (ps.posX as bigint);
		const ez = (e.posZ as bigint) - (ps.posZ as bigint);
		if (ex * ex + ez * ez > FRENZY_RANGE_SQ) continue;
		const dazedUntil = ts(now + FRENZY_DAZE_US);
		const newHp = (e.hp as bigint) > FRENZY_DAMAGE ? (e.hp as bigint) - FRENZY_DAMAGE : 0n;
		if (newHp <= 0n) {
			ctx.db.enemy.id.update({
				...e,
				hp: 0n,
				isAlive: false,
				isDazed: true,
				dazedUntil,
				diedAt: ts(now)
			});
			scoreAdd += 2n;
		} else {
			ctx.db.enemy.id.update({ ...e, hp: newHp, isDazed: true, dazedUntil });
			scoreAdd += 1n;
		}
	}

	for (const b of ctx.db.boss.boss_session_id.filter(sessionId)) {
		if (!b.isAlive) continue;
		const bx = (b.posX as bigint) - (ps.posX as bigint);
		const bz = (b.posZ as bigint) - (ps.posZ as bigint);
		if (bx * bx + bz * bz > FRENZY_RANGE_SQ) continue;
		const dazedUntil = ts(now + FRENZY_DAZE_US);
		const newHp = (b.hp as bigint) > FRENZY_DAMAGE ? (b.hp as bigint) - FRENZY_DAMAGE : 0n;
		if (newHp <= 0n) {
			ctx.db.boss.id.update({
				...b,
				hp: 0n,
				isAlive: false,
				isDazed: true,
				dazedUntil,
				diedAt: ts(now)
			});
			scoreAdd += 50n;
		} else {
			ctx.db.boss.id.update({ ...b, hp: newHp, isDazed: true, dazedUntil });
			scoreAdd += 25n;
		}
	}

	ctx.db.playerState.id.update({
		...ps,
		score: (ps.score as bigint) + scoreAdd,
		lastShotAt: ctx.timestamp
	});
	ctx.db.gunnerState.id.update({
		...gs,
		ultimateCooldownUntil: ts(now + ULTIMATE_COOLDOWN_US),
		lastUltimateAt: ctx.timestamp
	});
}
