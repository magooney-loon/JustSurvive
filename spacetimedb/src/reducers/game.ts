// ─── Core Game Reducer Implementations ────────────────────────────────────────
// move_player: position update, stamina regen, speed validation, acid damage.
// advance_day_phase: cycles dawn → day → dusk → night, increments cycle number.

import { ScheduleAt } from 'spacetimedb';
import { ts, classBaseRegen, classRampRegen } from '../helpers.js';
import {
	DAY_PHASES,
	ARENA_RADIUS_SRV,
	SPRINT_STAMINA_DRAIN,
	STAMINA_RAMP_TIME_US,
	STAMINA_REGEN_DELAY_US,
	MICROS_PER_SEC,
	CLASS_WALK_SPEED,
	CLASS_SPRINT_SPEED,
	DAY_PHASE_DURATION_US,
	PHASE_REVIVE_SPEED_BOOST_US
} from '../constants.js';
import { hitsTorch } from './enemies/movement.js';
import { applyPlayerDamage } from './shared.js';

// ─── move_player ──────────────────────────────────────────────────────────────

export function movePlayer(
	ctx: any,
	{ sessionId, posX, posY, posZ, isSprinting, facingAngle }: any
) {
	let ps: any;
	for (const p of ctx.db.playerState.player_state_session_id.filter(sessionId)) {
		if (p.playerIdentity.isEqual(ctx.sender)) {
			ps = p;
			break;
		}
	}
	if (!ps || ps.status !== 'alive') return;

	// Check if tank is charging — allow much higher speed during charge
	let isTankCharging = false;
	if (ps.classChoice === 'tank') {
		for (const tankSt of ctx.db.tankState.tank_state_session_id.filter(sessionId)) {
			if (tankSt.playerIdentity.isEqual(ctx.sender)) {
				isTankCharging = tankSt.isCharging;
				break;
			}
		}
	}

	const BASE_REGEN_PER_SEC = classBaseRegen(ps.classChoice);
	const RAMP_REGEN_PER_SEC = classRampRegen(ps.classChoice);
	const now = ctx.timestamp.microsSinceUnixEpoch as bigint;
	const lastMoveAt = (ps.lastMoveAt?.microsSinceUnixEpoch ?? now) as bigint;
	const dtMicros = now > lastMoveAt ? now - lastMoveAt : 0n;
	let newStamina = ps.stamina;
	let regenStartAt = ps.staminaRegenStartAt;
	let regenCarry = ps.staminaRegenCarry ?? 0n;
	if (isSprinting && ps.stamina > 0n) {
		newStamina = ps.stamina > SPRINT_STAMINA_DRAIN ? ps.stamina - SPRINT_STAMINA_DRAIN : 0n;
		regenStartAt = undefined;
		regenCarry = 0n;
	} else if (!isSprinting && ps.stamina < ps.maxStamina && dtMicros > 0n) {
		if (!regenStartAt) regenStartAt = ctx.timestamp;
		const sinceStart = now - (regenStartAt.microsSinceUnixEpoch as bigint);
		if (sinceStart >= STAMINA_REGEN_DELAY_US) {
			const rampMicros = sinceStart - STAMINA_REGEN_DELAY_US;
			const ramp =
				rampMicros >= STAMINA_RAMP_TIME_US
					? RAMP_REGEN_PER_SEC
					: (RAMP_REGEN_PER_SEC * rampMicros) / STAMINA_RAMP_TIME_US;
			const regenRate = BASE_REGEN_PER_SEC + ramp;
			const totalMicros = regenRate * dtMicros + regenCarry;
			const regenAdd = totalMicros / MICROS_PER_SEC;
			regenCarry = totalMicros % MICROS_PER_SEC;
			newStamina = ps.stamina + regenAdd > ps.maxStamina ? ps.maxStamina : ps.stamina + regenAdd;
		}
	}

	// ─── Position validation ──────────────────────────────────────────────────
	if (
		(posX as bigint) * (posX as bigint) + (posZ as bigint) * (posZ as bigint) >
		ARENA_RADIUS_SRV * ARENA_RADIUS_SRV
	)
		return;

	if (hitsTorch(posX as bigint, posZ as bigint)) return;

	if (dtMicros > 0n && ps.lastMoveAt) {
		const baseSpeed =
			isSprinting && ps.stamina > 0n
				? (CLASS_SPRINT_SPEED[ps.classChoice] ?? 7500n)
				: (CLASS_WALK_SPEED[ps.classChoice] ?? 4500n);
		const hasSpeedBoost =
			ps.speedBoostUntil && (ps.speedBoostUntil.microsSinceUnixEpoch as bigint) > now;
		// During charge allow 6x base speed; post-charge speed boost is 1.5x
		const maxSpeed = isTankCharging ? baseSpeed * 6n : hasSpeedBoost ? (baseSpeed * 3n) / 2n : baseSpeed;
		const maxDist = (maxSpeed * dtMicros * 3n) / (2n * MICROS_PER_SEC);
		const dx = (posX as bigint) - (ps.posX as bigint);
		const dz = (posZ as bigint) - (ps.posZ as bigint);
		if (dx * dx + dz * dz > maxDist * maxDist) return;
	}

	const distDelta =
		(posZ as bigint) < (ps.posZ as bigint) ? (ps.posZ as bigint) - (posZ as bigint) : 0n;
	const newScore = (ps.score as bigint) + distDelta / 1000n;
	const updatedPs = {
		...ps,
		posX,
		posY,
		posZ,
		stamina: newStamina,
		score: newScore,
		facingAngle,
		lastMoveAt: ctx.timestamp,
		staminaRegenStartAt: regenStartAt,
		staminaRegenCarry: regenCarry
	};

	// Check acid pool overlap
	for (const pool of ctx.db.acidPool.acid_pool_session_id.filter(sessionId)) {
		if ((pool.expiresAt.microsSinceUnixEpoch as bigint) < now) {
			ctx.db.acidPool.id.delete(pool.id);
			continue;
		}
		const dxp = (posX as bigint) - (pool.posX as bigint);
		const dzp = (posZ as bigint) - (pool.posZ as bigint);
		if (dxp * dxp + dzp * dzp < (pool.radius as bigint) * (pool.radius as bigint)) {
			applyPlayerDamage(ctx, sessionId, updatedPs, 1n);
			return;
		}
	}

	ctx.db.playerState.id.update(updatedPs);
}

// ─── advance_day_phase (scheduled) ────────────────────────────────────────────

export function advanceDayPhase(ctx: any, { arg }: any) {
	const session = ctx.db.gameSession.id.find(arg.sessionId);
	if (!session || session.status !== 'active') return;

	const currentIdx = DAY_PHASES.indexOf(session.dayPhase);
	const nextIdx = (currentIdx + 1) % DAY_PHASES.length;
	const nextPhase = DAY_PHASES[nextIdx];
	const newCycle = nextIdx === 0 ? (session.cycleNumber as bigint) + 1n : session.cycleNumber;

	ctx.db.gameSession.id.update({
		...session,
		dayPhase: nextPhase,
		cycleNumber: newCycle,
		phaseStartedAt: ctx.timestamp
	});

	// Revive all downed players at the end of each phase
	for (const p of ctx.db.playerState.player_state_session_id.filter(arg.sessionId)) {
		if (p.status !== 'downed') continue;
		const speedBoostUntil = ts((ctx.timestamp.microsSinceUnixEpoch as bigint) + PHASE_REVIVE_SPEED_BOOST_US);
		ctx.db.playerState.id.update({ ...p, hp: 50n, status: 'alive', speedBoostUntil });
	}

	const nextAdvance = (ctx.timestamp.microsSinceUnixEpoch as bigint) + DAY_PHASE_DURATION_US;
	ctx.db.dayPhaseJob.insert({
		scheduledId: 0n,
		scheduledAt: ScheduleAt.time(nextAdvance),
		sessionId: arg.sessionId
	});
}
