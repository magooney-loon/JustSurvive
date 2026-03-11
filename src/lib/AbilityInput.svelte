<script lang="ts">
	import { useTable, useSpacetimeDB } from 'spacetimedb/svelte';
	import { tables } from '../module_bindings/index.js';
	import { gameState, gameActions } from '../game.svelte.js';
	import { localPos, localAim, abilityState } from '../localGameState.svelte.js';

	const conn = useSpacetimeDB();
	const [players] = useTable(tables.playerState);
	const [enemies] = useTable(tables.enemy);

	const myState = $derived(
		$players.find(
			(p) =>
				p.playerIdentity.toHexString() === $conn.identity?.toHexString() &&
				p.sessionId === gameState.currentSessionId
		)
	);

	function nearestEnemyToAim(rangeFP: number) {
		const ax = BigInt(Math.round(localAim.x * 1000));
		const az = BigInt(Math.round(localAim.z * 1000));
		const rangeSq = BigInt(rangeFP) * BigInt(rangeFP);
		let best: any = null;
		let bestDist = BigInt(Number.MAX_SAFE_INTEGER);
		for (const e of $enemies) {
			if (!e.isAlive || e.sessionId !== gameState.currentSessionId) continue;
			const dx = e.posX - ax;
			const dz = e.posZ - az;
			const d = dx * dx + dz * dz;
			if (d < rangeSq && d < bestDist) {
				best = e;
				bestDist = d;
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
			if (p.status !== 'alive' || p.hp === 0n || p.sessionId !== gameState.currentSessionId) continue;
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
			if (p.status !== 'downed' || p.sessionId !== gameState.currentSessionId) continue;
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
			if (!e.isAlive || e.sessionId !== gameState.currentSessionId) continue;
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
		const sid = gameState.currentSessionId;
		if (!sid) return;

		// ── SPOTTER ─────────────────────────────────────────────────────────
		if (myState.classChoice === 'spotter') {
			if (e.button === 0) {
				// LMB: mark nearest enemy at aim
				const enemy = nearestEnemyToAim(15_000);
				if (enemy) {
					gameActions.markEnemy(sid, enemy.id);
					abilityState.markCooldownUntil = Date.now() + 5000;
				}
			} else if (e.button === 2) {
				// RMB: ping location
				gameActions.pingLocation(
					sid,
					BigInt(Math.round(localAim.x * 1000)),
					BigInt(Math.round(localAim.z * 1000))
				);
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
			gameActions.attackEnemy(sid, enemy.id, suppress);
			return;
		}

		// ── TANK ────────────────────────────────────────────────────────────
		if (myState.classChoice === 'tank') {
			if (e.button === 0) {
				// LMB: shield bash (1.5s cooldown)
				if (abilityState.bashCooldownUntil > Date.now()) return;
				const enemy = nearestEnemyToPlayer(5_000);
				gameActions.shieldBash(sid, enemy?.id);
				abilityState.bashCooldownUntil = Date.now() + 1500;
			} else if (e.button === 2) {
				// RMB hold: start brace (1s cooldown between activations)
				if (abilityState.braceCooldownUntil > Date.now()) return;
				gameActions.braceStart(sid);
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
					gameActions.healPlayer(sid, target.playerIdentity);
					abilityState.healCooldownUntil = Date.now() + 2000;
				}
			} else if (e.button === 2) {
				// RMB: revive nearest downed teammate
				const target = nearestDowned(3_000);
				if (target) gameActions.reviveStart(sid, target.playerIdentity);
			}
			return;
		}
	}

	function onMouseUp(e: MouseEvent) {
		if (!myState) return;
		const sid = gameState.currentSessionId;
		if (!sid) return;
		// RMB release: end tank brace, start cooldown
		if (e.button === 2 && myState.classChoice === 'tank') {
			gameActions.braceEnd(sid);
			abilityState.braceCooldownUntil = Date.now() + 1000;
		}
	}
</script>

<svelte:window onmousedown={onMouseDown} onmouseup={onMouseUp} />
