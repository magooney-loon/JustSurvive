<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import * as THREE from 'three';
	import { abilityState } from '$lib/stores/abilities.svelte.js';

	type Props = { x: number; z: number; isLocal: boolean };
	let { x, z, isLocal }: Props = $props();

	let now = $state(Date.now());
	let time = $state(0);
	useTask((dt) => {
		now = Date.now();
		time += dt;
	});

	// Adrenaline: local only — 180ms burst effect from abilityState
	const adrenalineT = $derived(
		isLocal ? Math.max(0, (abilityState.adrenalineUntil - now) / 180) : 0
	);
	const pulse = $derived(0.8 + 0.2 * Math.sin(time * 25));
</script>

{#if adrenalineT > 0}
	<!-- Inner orange core burst -->
	<T.Mesh position={[x, 1.0, z]} scale={0.2 + (1 - adrenalineT) * 0.5}>
		<T.SphereGeometry args={[1, 8, 6]} />
		<T.MeshBasicMaterial
			color="#ff6600"
			transparent
			opacity={adrenalineT * 0.9 * pulse}
			blending={THREE.AdditiveBlending}
			depthWrite={false}
		/>
	</T.Mesh>
	<!-- Outer amber halo -->
	<T.Mesh position={[x, 1.0, z]} scale={0.45 + (1 - adrenalineT) * 0.7}>
		<T.SphereGeometry args={[1, 8, 6]} />
		<T.MeshBasicMaterial
			color="#ffaa00"
			transparent
			opacity={adrenalineT * 0.4 * pulse}
			blending={THREE.AdditiveBlending}
			depthWrite={false}
		/>
	</T.Mesh>
	<!-- Speed ring on ground -->
	<T.Mesh
		position={[x, 0.05, z]}
		rotation={[-Math.PI / 2, 0, time * 8]}
		scale={0.6 + (1 - adrenalineT) * 0.8}
	>
		<T.RingGeometry args={[0.3, 0.55, 16]} />
		<T.MeshBasicMaterial
			color="#ffcc44"
			transparent
			opacity={adrenalineT * 0.6}
			blending={THREE.AdditiveBlending}
			depthWrite={false}
		/>
	</T.Mesh>
{/if}
