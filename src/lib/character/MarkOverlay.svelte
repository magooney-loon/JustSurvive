<script module lang="ts">
	import * as THREE from 'three';
	// Fixed geometries — shared across all ping instances
	const ringGeo1 = new THREE.RingGeometry(0.5, 0.65, 16);
	const ringGeo2 = new THREE.RingGeometry(0.5, 0.58, 16);
	const ringMat1 = new THREE.MeshBasicMaterial({ color: '#4af' });
	const ringMat2 = new THREE.MeshBasicMaterial({ color: '#4af', transparent: true, opacity: 0.4 });
</script>

<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { useTable } from 'spacetimedb/svelte';
	import { tables } from '../../module_bindings/index.js';
	import { gameState } from '../stores/game.svelte.js';

	const [marks] = useTable(tables.mark);

	const activePings = $derived(
		$marks.filter(m =>
			m.sessionId === gameState.currentSessionId &&
			m.targetType === 'location' &&
			m.expiresAt.microsSinceUnixEpoch > BigInt(Date.now()) * 1000n
		)
	);

	let pulse = $state(1);
	let t = 0;
	useTask((dt) => {
		t += dt;
		pulse = 0.85 + Math.sin(t * 6) * 0.15;
	});
</script>

{#each activePings as mark (mark.id)}
	{#if mark.posX !== undefined && mark.posZ !== undefined}
		<T.Group position={[Number(mark.posX) / 1000, 0.05, Number(mark.posZ) / 1000]}>
			<T.Mesh rotation={[-Math.PI / 2, 0, 0]} scale={[pulse, pulse, 1]} geometry={ringGeo1} material={ringMat1} />
			<T.Mesh rotation={[-Math.PI / 2, 0, 0]} scale={[pulse * 1.4, pulse * 1.4, 1]} geometry={ringGeo2} material={ringMat2} />
		</T.Group>
	{/if}
{/each}
