// ─── Tank Abilities ───────────────────────────────────────────────────────────
// axe_swing: melee cone — damages, knocks back, and dazes enemies in a 90° arc.
// brace_start / brace_end: defensive stance — reflects melee, heals per tick.

import { ts, bigintSqrt as bs } from '../../helpers.js';
import {
	AXE_SWING_DAMAGE,
	AXE_SWING_RANGE,
	AXE_SWING_COOLDOWN_US,
	AXE_SWING_DAZE_US,
	AXE_SWING_KNOCKBACK,
	ULTIMATE_COOLDOWN_US
} from '../../constants.js';

function findTankState(ctx: any, sessionId: any, identity: any): any {
	for (const t of ctx.db.tankState.tank_state_session_id.filter(sessionId)) {
		if (t.playerIdentity.isEqual(identity)) return t;
	}
	return null;
}

// ─── axe_swing ────────────────────────────────────────────────────────────────

export function axeSwing(ctx: any, { sessionId }: any) {
	let ps: any;
	for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
		if (p.playerIdentity.isEqual(ctx.sender)) { ps = p; break; }
	}
	if (!ps || ps.classChoice !== 'tank') return;
	if (ps.status !== 'alive') return;

	const tankSt = findTankState(ctx, sessionId, ctx.sender);
	if (!tankSt) return;
	const now = ctx.timestamp.microsSinceUnixEpoch as bigint;
	if (
		tankSt.axeSwingCooldownUntil &&
		now < (tankSt.axeSwingCooldownUntil.microsSinceUnixEpoch as bigint)
	) return;

	const HALF_ANGLE = Math.PI / 4;
	const facingRad = Number(ps.facingAngle) / 1000;
	const fwdX = -Math.sin(facingRad);
	const fwdZ = -Math.cos(facingRad);
	const cosHalf = Math.cos(HALF_ANGLE);

	let scoreAdd = 0n;
	for (const e of ctx.db.enemy.enemy_session_id.filter(sessionId)) {
		if (!e.isAlive) continue;
		const ex = Number(e.posX) - Number(ps.posX);
		const ez = Number(e.posZ) - Number(ps.posZ);
		const dist = Math.sqrt(ex * ex + ez * ez);
		if (dist > AXE_SWING_RANGE || dist < 1) continue;
		const dot = (ex * fwdX + ez * fwdZ) / dist;
		if (dot < cosHalf) continue;

		const newHp = (e.hp as bigint) > AXE_SWING_DAMAGE ? (e.hp as bigint) - AXE_SWING_DAMAGE : 0n;
		const dazedUntil = ts(now + AXE_SWING_DAZE_US);
		if (newHp <= 0n) {
			ctx.db.enemy.id.update({ ...e, hp: 0n, isAlive: false, isDazed: true, dazedUntil, diedAt: ts(now) });
			scoreAdd += 2n;
		} else {
			const edx = BigInt(Math.round(ex));
			const edz = BigInt(Math.round(ez));
			const mag = bs(edx * edx + edz * edz);
			const newX = mag > 0n ? (e.posX as bigint) + (edx * AXE_SWING_KNOCKBACK) / mag : (e.posX as bigint) + AXE_SWING_KNOCKBACK;
			const newZ = mag > 0n ? (e.posZ as bigint) + (edz * AXE_SWING_KNOCKBACK) / mag : (e.posZ as bigint) + AXE_SWING_KNOCKBACK;
			ctx.db.enemy.id.update({ ...e, hp: newHp, posX: newX, posZ: newZ, isDazed: true, dazedUntil });
			scoreAdd += 5n;
		}
	}

	ctx.db.playerState.id.update({ ...ps, score: (ps.score as bigint) + scoreAdd });
	ctx.db.tankState.id.update({ ...tankSt, axeSwingCooldownUntil: ts(now + AXE_SWING_COOLDOWN_US), lastAxeSwingAt: ctx.timestamp });
}

// ─── brace_start ──────────────────────────────────────────────────────────────

export function braceStart(ctx: any, { sessionId }: any) {
	let ps: any;
	for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
		if (p.playerIdentity.isEqual(ctx.sender)) { ps = p; break; }
	}
	if (!ps || ps.classChoice !== 'tank') return;
	if (ps.status !== 'alive') return;

	const tankSt = findTankState(ctx, sessionId, ctx.sender);
	if (!tankSt) return;
	const now = ctx.timestamp.microsSinceUnixEpoch as bigint;
	if (tankSt.braceCooldownUntil && now < (tankSt.braceCooldownUntil.microsSinceUnixEpoch as bigint)) return;
	if (tankSt.isBracing) return;

	ctx.db.tankState.id.update({ ...tankSt, isBracing: true, braceStartAt: ctx.timestamp });
}

// ─── brace_end ────────────────────────────────────────────────────────────────

export function braceEnd(ctx: any, { sessionId }: any) {
	let ps: any;
	for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
		if (p.playerIdentity.isEqual(ctx.sender)) { ps = p; break; }
	}
	if (!ps || ps.classChoice !== 'tank') return;
	if (ps.status !== 'alive') return;

	const tankSt = findTankState(ctx, sessionId, ctx.sender);
	if (!tankSt) return;
	const now = ctx.timestamp.microsSinceUnixEpoch as bigint;
	ctx.db.tankState.id.update({
		...tankSt,
		isBracing: false,
		braceStartAt: undefined,
		braceCooldownUntil: ts(now + 2_000_000n)
	});
}

// ─── tank_ultimate: Ground Slam ───────────────────────────────────────────────
// 360° double-damage slam — all enemies in axe range, massive knockback + 2s daze.

export function tankUltimate(ctx: any, { sessionId }: any) {
	let ps: any;
	for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
		if (p.playerIdentity.isEqual(ctx.sender)) { ps = p; break; }
	}
	if (!ps || ps.classChoice !== 'tank') return;
	if (ps.status !== 'alive') return;

	const tankSt = findTankState(ctx, sessionId, ctx.sender);
	if (!tankSt) return;
	const now = ctx.timestamp.microsSinceUnixEpoch as bigint;
	if (tankSt.ultimateCooldownUntil && now < (tankSt.ultimateCooldownUntil.microsSinceUnixEpoch as bigint)) return;

	const SLAM_DAMAGE = AXE_SWING_DAMAGE * 2n;
	const SLAM_KNOCKBACK = AXE_SWING_KNOCKBACK * 2n;
	const SLAM_DAZE_US = 2_000_000n;
	let scoreAdd = 0n;

	for (const e of ctx.db.enemy.enemy_session_id.filter(sessionId)) {
		if (!e.isAlive) continue;
		const ex = Number(e.posX) - Number(ps.posX);
		const ez = Number(e.posZ) - Number(ps.posZ);
		const dist = Math.sqrt(ex * ex + ez * ez);
		if (dist > AXE_SWING_RANGE || dist < 1) continue;
		// 360° — no cone check
		const newHp = (e.hp as bigint) > SLAM_DAMAGE ? (e.hp as bigint) - SLAM_DAMAGE : 0n;
		const dazedUntil = ts(now + SLAM_DAZE_US);
		const edx = BigInt(Math.round(ex));
		const edz = BigInt(Math.round(ez));
		const mag = bs(edx * edx + edz * edz);
		const newX = mag > 0n ? (e.posX as bigint) + (edx * SLAM_KNOCKBACK) / mag : (e.posX as bigint) + SLAM_KNOCKBACK;
		const newZ = mag > 0n ? (e.posZ as bigint) + (edz * SLAM_KNOCKBACK) / mag : (e.posZ as bigint) + SLAM_KNOCKBACK;
		if (newHp <= 0n) {
			ctx.db.enemy.id.update({ ...e, hp: 0n, isAlive: false, isDazed: true, dazedUntil, posX: newX, posZ: newZ, diedAt: ts(now) });
			scoreAdd += 3n;
		} else {
			ctx.db.enemy.id.update({ ...e, hp: newHp, isDazed: true, dazedUntil, posX: newX, posZ: newZ });
			scoreAdd += 2n;
		}
	}

	ctx.db.playerState.id.update({ ...ps, score: (ps.score as bigint) + scoreAdd });
	ctx.db.tankState.id.update({ ...tankSt, ultimateCooldownUntil: ts(now + ULTIMATE_COOLDOWN_US), lastAxeSwingAt: ctx.timestamp, lastUltimateAt: ctx.timestamp });
}
