<script lang="ts">
	import { input } from '$lib/stores/movement.svelte.js';
	import { useTable, useSpacetimeDB } from 'spacetimedb/svelte';
	import { tables } from '$bindings/index.js';
	import { lobbyState } from '$lib/stores/lobby.svelte.js';
	import { combatActions } from '$lib/stores/combat.svelte.js';
	import { localPos, localAim, tpsCamera } from '$lib/stores/movement.svelte.js';
	import {
		abilityState,
		healBeam,
		HEAL_BEAM_MS,
		shotFlash,
		SHOT_FLASH_MS,
		spotterFlash,
		SPOTTER_FLASH_MS,
		steadyShotFlash,
		STEADY_SHOT_FLASH_MS,
		axeSwingFlash,
		AXE_SWING_FLASH_MS
	} from '$lib/stores/abilities.svelte.js';
	import { soundActions } from '$root/Sound.svelte';
	import { logAbility } from '$root/settings.svelte.js';

	const ULTIMATE_CD_MS = 35_000;

	const keyMap: Record<string, keyof typeof input> = {
		KeyW: 'forward',
		ArrowUp: 'forward',
		KeyS: 'back',
		ArrowDown: 'back',
		KeyA: 'left',
		ArrowLeft: 'left',
		KeyD: 'right',
		ArrowRight: 'right',
		ShiftLeft: 'sprint',
		ShiftRight: 'sprint'
	};

	function onKeyDown(e: KeyboardEvent) {
		const key = keyMap[e.code];
		if (key) input[key] = true;

		// Ultimate — Space
		if (e.code === 'Space' && !e.repeat) {
			e.preventDefault();
			fireUltimate();
		}
	}

	function onKeyUp(e: KeyboardEvent) {
		const key = keyMap[e.code];
		if (key) input[key] = false;
	}

	const conn = useSpacetimeDB();
	const [players] = useTable(tables.playerState);
	const [enemies] = useTable(tables.enemy);
	const [bosses] = useTable(tables.boss);

	const CHARGE_COOLDOWN_MS = 8000;

	const myState = $derived(
		$players.find(
			(p) =>
				p.playerIdentity.toHexString() === $conn.identity?.toHexString() &&
				p.sessionId === lobbyState.currentSessionId
		)
	);

	function nearestEnemyToAim(rangeFP: number) {
		const AIM_RAY_RADIUS_FP = 1200;
		const BOSS_AIM_RAY_RADIUS_FP = 3500;
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
		const bossPerpSq = BOSS_AIM_RAY_RADIUS_FP * BOSS_AIM_RAY_RADIUS_FP;
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

		for (const b of $bosses) {
			if (!b.isAlive || b.sessionId !== lobbyState.currentSessionId) continue;
			const bx = Number(b.posX);
			const bz = Number(b.posZ);
			const vx = bx - ox;
			const vz = bz - oz;
			const along = (vx * dirX + vz * dirZ) / dirLen;
			if (along < 0 || along > maxDist) continue;
			const perpSq = Math.max(0, vx * vx + vz * vz - along * along);
			if (perpSq > bossPerpSq) continue;
			if (perpSq < bestPerp) {
				best = b;
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

	function fireUltimate() {
		if (!myState || myState.status !== 'alive') return;
		const sid = lobbyState.currentSessionId;
		if (!sid) return;
		if (abilityState.ultimateCooldownUntil > Date.now()) return;
		abilityState.ultimateCooldownUntil = Date.now() + ULTIMATE_CD_MS;

		const cls = myState.classChoice;
		if (cls === 'spotter') {
			combatActions.spotterUltimate(sid);
			logAbility.info('SPOTTER: barrage ultimate');
		} else if (cls === 'gunner') {
			combatActions.gunnerUltimate(sid);
			logAbility.info('GUNNER: frenzy ultimate');
		} else if (cls === 'tank') {
			combatActions.tankUltimate(sid);
			axeSwingFlash.active = true;
			axeSwingFlash.yaw = tpsCamera.yaw;
			axeSwingFlash.until = Date.now() + AXE_SWING_FLASH_MS;
			logAbility.info('TANK: ground slam ultimate');
		} else if (cls === 'healer') {
			combatActions.healerUltimate(sid);
			logAbility.info('HEALER: revitalize ultimate');
		}
	}

	function onMouseDown(e: MouseEvent) {
		logAbility.info('MOUSE DOWN: myState=', myState?.classChoice, 'status=', myState?.status);
		if (!myState || myState.status !== 'alive') return;
		const sid = lobbyState.currentSessionId;
		if (!sid) return;

		if (myState.classChoice === 'spotter') {
			if (e.button === 0) {
				if (abilityState.markCooldownUntil > Date.now()) return;
				const enemy = nearestEnemyToAim(15_000);
				if (enemy) {
					combatActions.steadyShot(sid, enemy.id);
					soundActions.playSpotterMark();
					soundActions.playHitmarker();
					abilityState.markCooldownUntil = Date.now() + 1500;
					steadyShotFlash.until = Date.now() + STEADY_SHOT_FLASH_MS;
					steadyShotFlash.yaw = tpsCamera.yaw;
					logAbility.info('SPOTTER: steady shot enemy', enemy.id);
				}
			} else if (e.button === 2) {
				if (abilityState.pingCooldownUntil > Date.now()) return;
				combatActions.spotterFlash(sid);
				soundActions.playSpotterPing();
				abilityState.pingCooldownUntil = Date.now() + 3000;
				spotterFlash.active = true;
				spotterFlash.yaw = tpsCamera.yaw;
				spotterFlash.until = Date.now() + SPOTTER_FLASH_MS;
				logAbility.info('SPOTTER: flash');
			}
			return;
		}

		if (myState.classChoice === 'gunner') {
			if (e.button === 0) {
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
				soundActions.playHitmarker();
				shotFlash.until = Date.now() + SHOT_FLASH_MS;
				logAbility.info('GUNNER: attack enemy', enemy.id, 'suppress=', suppress);
			} else if (e.button === 2) {
				if (abilityState.adrenalineCooldownUntil > Date.now()) return;
				combatActions.adrenaline(sid);
				soundActions.playGunnerAdrenaline();
				abilityState.adrenalineCooldownUntil = Date.now() + 5000;
				abilityState.adrenalineUntil = Date.now() + 180;
				logAbility.info('GUNNER: adrenaline triggered');
			}
			return;
		}

		if (myState.classChoice === 'tank') {
			if (e.button === 0) {
				if (abilityState.bashCooldownUntil > Date.now()) return;
				combatActions.axeSwing(sid);
				soundActions.playTankBash();
				soundActions.playHitmarker();
				abilityState.bashCooldownUntil = Date.now() + 500;
				axeSwingFlash.active = true;
				axeSwingFlash.yaw = tpsCamera.yaw;
				axeSwingFlash.until = Date.now() + AXE_SWING_FLASH_MS;
				logAbility.info('TANK: axe swing');
			} else if (e.button === 2) {
				if (abilityState.chargeCooldownUntil > Date.now()) return;
				combatActions.chargeActivate(sid);
				soundActions.playTankBrace();

				abilityState.chargeYaw = tpsCamera.yaw + Math.PI;
				abilityState.chargeCooldownUntil = Date.now() + CHARGE_COOLDOWN_MS;
				logAbility.info('TANK: charge');
			}
			return;
		}

		if (myState.classChoice === 'healer') {
			if (e.button === 0) {
				if (abilityState.healCooldownUntil > Date.now()) return;
				// Server auto-targets lowest HP teammate; find nearest for local VFX only
				const target = nearestAliveTeammate(10_000);
				combatActions.healPlayer(sid);
				soundActions.playHealerHeal();
				abilityState.healCooldownUntil = Date.now() + 3000;
				if (target) {
					healBeam.active = true;
					healBeam.toX = Number(target.posX) / 1000;
					healBeam.toZ = Number(target.posZ) / 1000;
					healBeam.until = Date.now() + HEAL_BEAM_MS;
				}
				logAbility.info('HEALER: chain heal');
			} else if (e.button === 2) {
				const target = nearestDowned(3_000);
				if (target) {
					combatActions.reviveStart(sid, target.playerIdentity);
					soundActions.playHealerRevive();
					logAbility.info('HEALER: revive target', target.playerIdentity.toHexString());
				}
			}
			return;
		}
	}
</script>

<svelte:window onkeydown={onKeyDown} onkeyup={onKeyUp} onmousedown={onMouseDown} />
