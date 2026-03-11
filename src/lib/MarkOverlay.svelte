<script lang="ts">
	import { T } from '@threlte/core';
	import { HTML } from '@threlte/extras';
	import { useTable } from 'spacetimedb/svelte';
	import { tables } from '../module_bindings/index.js';
	import { gameState } from '../game.svelte.js';

	const [marks] = useTable(tables.mark);
	const [enemies] = useTable(tables.enemy);

	const activeMarks = $derived(
		$marks.filter(m =>
			m.sessionId === gameState.currentSessionId &&
			m.expiresAt.microsSinceUnixEpoch > BigInt(Date.now()) * 1000n
		)
	);

	function getEnemyPos(enemyId: bigint) {
		const e = $enemies.find(e => e.id === enemyId);
		return e ? { x: Number(e.posX) / 1000, z: Number(e.posZ) / 1000 } : null;
	}
</script>

{#each activeMarks as mark (mark.id)}
	{#if mark.targetType === 'enemy' && mark.targetEnemyId !== undefined}
		{@const pos = getEnemyPos(mark.targetEnemyId)}
		{#if pos}
			<T.Group position={[pos.x, 3, pos.z]}>
				<HTML center>
					<div style="color: #f84; font-size: 1.2rem; font-weight: bold; text-shadow: 0 0 4px #000;">⚠</div>
				</HTML>
			</T.Group>
		{/if}
	{:else if mark.targetType === 'location' && mark.posX !== undefined}
		<T.Group position={[Number(mark.posX) / 1000, 2, Number(mark.posZ) / 1000]}>
			<HTML center>
				<div style="color: #4af; font-size: 1rem; text-shadow: 0 0 4px #000;">📍</div>
			</HTML>
		</T.Group>
	{/if}
{/each}
