<script lang="ts">
	import { useTable, useSpacetimeDB } from 'spacetimedb/svelte';
	import { tables } from '../module_bindings/index.js';
	import { gameState, gameActions } from '../game.svelte.js';
	import { localPos, localAim } from '../localGameState.svelte.js';

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

	// Enemy nearest to aim point within range
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

	// Downed player nearest to local player within range (proximity ability)
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

	// Enemy nearest to player (for melee/bash — you hit what's close to you)
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

	// Gunner suppression tracking
	let lastSuppressedEnemyId: bigint | null = null;
	let suppressHits = 0;

	function onKeyDown(e: KeyboardEvent) {
		if (!myState || myState.status !== 'alive') return;
		const sid = gameState.currentSessionId;
		if (!sid) return;

		switch (e.code) {
			case 'KeyG': {
				if (myState.classChoice !== 'spotter') break;
				// Ping at aim position, not player position
				gameActions.pingLocation(
					sid,
					BigInt(Math.round(localAim.x * 1000)),
					BigInt(Math.round(localAim.z * 1000))
				);
				break;
			}
			case 'KeyE': {
				if (myState.classChoice !== 'tank') break;
				const enemy = nearestEnemyToPlayer(5_000); // 5 unit bash range
				gameActions.shieldBash(sid, enemy?.id);
				break;
			}
			case 'Space': {
				e.preventDefault();
				if (myState.classChoice !== 'tank') break;
				gameActions.braceStart(sid);
				break;
			}
			case 'KeyR': {
				if (myState.classChoice !== 'healer') break;
				const target = nearestDowned(3_000); // 3 unit revive range
				if (target) gameActions.reviveStart(sid, target.playerIdentity);
				break;
			}
		}
	}

	function onKeyUp(e: KeyboardEvent) {
		if (!myState) return;
		const sid = gameState.currentSessionId;
		if (!sid) return;
		if (e.code === 'Space' && myState.classChoice === 'tank') {
			gameActions.braceEnd(sid);
		}
	}

	function onMouseDown(e: MouseEvent) {
		if (!myState || myState.status !== 'alive') return;
		const sid = gameState.currentSessionId;
		if (!sid || e.button !== 0) return;

		if (myState.classChoice === 'spotter') {
			// LMB: mark nearest enemy to aim
			const enemy = nearestEnemyToAim(15_000);
			if (enemy) gameActions.markEnemy(sid, enemy.id);
		} else if (myState.classChoice === 'gunner' || myState.classChoice === 'healer') {
			const enemy = nearestEnemyToAim(10_000);
			if (!enemy) return;
			// Track suppression: suppress every 3rd hit on same enemy
			if (enemy.id === lastSuppressedEnemyId) {
				suppressHits++;
			} else {
				lastSuppressedEnemyId = enemy.id;
				suppressHits = 1;
			}
			const suppress = myState.classChoice === 'gunner' && suppressHits % 3 === 0;
			gameActions.attackEnemy(sid, enemy.id, suppress);
		}
	}
</script>

<svelte:window onkeydown={onKeyDown} onkeyup={onKeyUp} onmousedown={onMouseDown} />
