<script lang="ts">
	import { useTable, useSpacetimeDB } from 'spacetimedb/svelte';
	import { tables } from '../../module_bindings/index.js';
	import { lobbyState } from '../stores/lobby.svelte.js';
	import { combatActions } from '../stores/combat.svelte.js';
	import { localPos, localAim, fpsCamera } from '../stores/movement.svelte.js';
	import {
		abilityState,
		healBeam,
		HEAL_BEAM_MS,
		shotFlash,
		SHOT_FLASH_MS,
		spotterFlash,
		SPOTTER_FLASH_MS
	} from '../stores/abilities.svelte.js';
	import { soundActions } from '../../Sound.svelte';

	const conn = useSpacetimeDB();
	const [players] = useTable(tables.playerState);
	const [enemies] = useTable(tables.enemy);

	let braceTimer: ReturnType<typeof setTimeout> | null = null;
	const BRACE_MAX_MS = 5000;

	function endBrace() {
		if (braceTimer !== null) {
			clearTimeout(braceTimer);
			braceTimer = null;
		}
		const sid = lobbyState.currentSessionId;
		if (sid) combatActions.braceEnd(sid);
		abilityState.braceCooldownUntil = Date.now() + 1000;
	}
	function startBraceTimer() {
		if (braceTimer !== null) {
			clearTimeout(braceTimer);
		}
		braceTimer = setTimeout(endBrace, BRACE_MAX_MS);
	}

	const myState = $derived(
		$players.find(
			(p) =>
				p.playerIdentity.toHexString() === $conn.identity?.toHexString() &&
				p.sessionId === lobbyState.currentSessionId
		)
	);

	function nearestEnemyToAim(rangeFP: number) {
		const AIM_RAY_RADIUS_FP = 1200; // 1.2 world units
		const ox = localPos.x * 1000;
		const oz = localPos.z * 1000;
		const ax = localAim.x * 1000;
		const az = localAim.z * 1000;
		const dirX = ax - ox;
		const dirZ = az - oz;
		const dirLenSq = dirX * dirX + dirZ * dirZ;
		if (dirLenSq <= 0.0001) return null;
		const dirLen = Math.sqrt(dirLenSq);
		const maxDist = rangeFP;
		const maxPerpSq = AIM_RAY_RADIUS_FP * AIM_RAY_RADIUS_FP;
		let best: any = null;
		let bestPerp = Number.POSITIVE_INFINITY;
		for (const e of $enemies) {
			if (!e.isAlive || e.sessionId !== lobbyState.currentSessionId) continue;
			const ex = Number(e.posX);
			const ez = Number(e.posZ);
			const vx = ex - ox;
			const vz = ez - oz;
			const along = (vx * dirX + vz * dirZ) / dirLen;
			if (along < 0 || along > maxDist) continue;
			const perpSq = Math.max(0, vx * vx + vz * vz - along * along);
			if (perpSq > maxPerpSq) continue;
			if (perpSq < bestPerp) {
				best = e;
				bestPerp = perpSq;
			}
		}
		return best;
	}

	function nearestAliveTeammate(rangeFP: number) {
		const ox = BigInt(Math.round(localPos.x * 1000));
		const oz = BigInt(Math.round(localPos.z * 1000));
		const rangeSq = BigInt(rangeFP) * BigInt(rangeFP);
		let best: any = null;
		let bestDist = BigInt(Number.MAX_SAFE_INTEGER);
		for (const p of $players) {
			if (p.status !== 'alive' || p.hp === 0n || p.sessionId !== lobbyState.currentSessionId)
				continue;
			if (p.playerIdentity.toHexString() === $conn.identity?.toHexString()) continue;
			const dx = p.posX - ox;
			const dz = p.posZ - oz;
			const d = dx * dx + dz * dz;
			if (d < rangeSq && d < bestDist) {
				best = p;
				bestDist = d;
			}
		}
		return best;
	}

	function nearestDowned(rangeFP: number) {
		const ox = BigInt(Math.round(localPos.x * 1000));
		const oz = BigInt(Math.round(localPos.z * 1000));
		const rangeSq = BigInt(rangeFP) * BigInt(rangeFP);
		let best: any = null;
		let bestDist = BigInt(Number.MAX_SAFE_INTEGER);
		for (const p of $players) {
			if (p.status !== 'downed' || p.sessionId !== lobbyState.currentSessionId) continue;
			if (p.playerIdentity.toHexString() === $conn.identity?.toHexString()) continue;
			const dx = p.posX - ox;
			const dz = p.posZ - oz;
			const d = dx * dx + dz * dz;
			if (d < rangeSq && d < bestDist) {
				best = p;
				bestDist = d;
			}
		}
		return best;
	}

	function nearestEnemyToPlayer(rangeFP: number) {
		const ox = BigInt(Math.round(localPos.x * 1000));
		const oz = BigInt(Math.round(localPos.z * 1000));
		const rangeSq = BigInt(rangeFP) * BigInt(rangeFP);
		let best: any = null;
		let bestDist = BigInt(Number.MAX_SAFE_INTEGER);
		for (const e of $enemies) {
			if (!e.isAlive || e.sessionId !== lobbyState.currentSessionId) continue;
			const dx = e.posX - ox;
			const dz = e.posZ - oz;
			const d = dx * dx + dz * dz;
			if (d < rangeSq && d < bestDist) {
				best = e;
				bestDist = d;
			}
		}
		return best;
	}

	function onMouseDown(e: MouseEvent) {
		if (!myState || myState.status !== 'alive') return;
		const sid = lobbyState.currentSessionId;
		if (!sid) return;

		// ── SPOTTER ─────────────────────────────────────────────────────────
		if (myState.classChoice === 'spotter') {
			if (e.button === 0) {
				// LMB: mark nearest enemy at aim
				const enemy = nearestEnemyToAim(15_000);
				if (enemy) {
					combatActions.markEnemy(sid, enemy.id);
					soundActions.playSpotterMark();
					abilityState.markCooldownUntil = Date.now() + 5000;
				}
			} else if (e.button === 2) {
				// RMB: flash stun — cone in front of player (1.5s cooldown)
				if (abilityState.flashCooldownUntil > Date.now()) return;
				combatActions.spotterFlash(sid);
				soundActions.playSpotterPing();
				abilityState.flashCooldownUntil = Date.now() + 1500;
				spotterFlash.active = true;
				spotterFlash.yaw = fpsCamera.yaw;
				spotterFlash.until = Date.now() + SPOTTER_FLASH_MS;
			}
			return;
		}

		// ── GUNNER ──────────────────────────────────────────────────────────
		if (myState.classChoice === 'gunner') {
			if (e.button !== 0) return;
			const enemy = nearestEnemyToAim(10_000);
			if (!enemy) return;
			if (enemy.id === abilityState.lastSuppressedEnemyId) {
				abilityState.suppressHits++;
			} else {
				abilityState.lastSuppressedEnemyId = enemy.id;
				abilityState.suppressHits = 1;
			}
			const suppress = abilityState.suppressHits % 3 === 0;
			combatActions.attackEnemy(sid, enemy.id, suppress);
			soundActions.playGunnerShot();
			// Optimistic local state - show muzzle flash immediately without waiting for server
			shotFlash.until = Date.now() + SHOT_FLASH_MS;
			return;
		}

		// ── TANK ────────────────────────────────────────────────────────────
		if (myState.classChoice === 'tank') {
			if (e.button === 0) {
				// LMB: shield bash (1.5s cooldown)
				if (abilityState.bashCooldownUntil > Date.now()) return;
				const enemy = nearestEnemyToPlayer(5_000);
				combatActions.shieldBash(sid, enemy?.id);
				soundActions.playTankBash();
				abilityState.bashCooldownUntil = Date.now() + 1500;
			} else if (e.button === 2) {
				// RMB hold: start brace (1s cooldown between activations)
				if (abilityState.braceCooldownUntil > Date.now()) return;
				combatActions.braceStart(sid);
				soundActions.playTankBrace();
				startBraceTimer();
			}
			return;
		}

		// ── HEALER ──────────────────────────────────────────────────────────
		if (myState.classChoice === 'healer') {
			if (e.button === 0) {
				// LMB: heal shot — heals nearest alive teammate
				if (abilityState.healCooldownUntil > Date.now()) return;
				const target = nearestAliveTeammate(10_000);
				if (target) {
					combatActions.healPlayer(sid, target.playerIdentity);
					soundActions.playHealerHeal();
					abilityState.healCooldownUntil = Date.now() + 2000;
					// Trigger 3D heal beam
					healBeam.active = true;
					healBeam.toX = Number(target.posX) / 1000;
					healBeam.toZ = Number(target.posZ) / 1000;
					healBeam.until = Date.now() + HEAL_BEAM_MS;
				}
			} else if (e.button === 2) {
				// RMB: revive nearest downed teammate
				const target = nearestDowned(3_000);
				if (target) {
					combatActions.reviveStart(sid, target.playerIdentity);
					soundActions.playHealerRevive();
				}
			}
			return;
		}
	}

	function onMouseUp(e: MouseEvent) {
		if (!myState) return;
		const sid = lobbyState.currentSessionId;
		if (!sid) return;
		// RMB release: end tank brace, start cooldown
		if (e.button === 2 && myState.classChoice === 'tank') {
			endBrace();
		}
	}
</script>

<svelte:window onmousedown={onMouseDown} onmouseup={onMouseUp} />
