<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { untrack } from 'svelte';
	import type { Enemy } from '../module_bindings/types.js';

	type Props = { enemy: Enemy };
	let { enemy }: Props = $props();

	let displayX = $state(untrack(() => Number(enemy.posX) / 1000));
	let displayZ = $state(untrack(() => Number(enemy.posZ) / 1000));

	const targetX = $derived(Number(enemy.posX) / 1000);
	const targetZ = $derived(Number(enemy.posZ) / 1000);

	const ENEMY_COLORS: Record<string, string> = {
		basic:   '#c33',
		fast:    '#f73',
		brute:   '#833',
		spitter: '#3c3',
	};

	let pulse = $state(1);
	let t = 0;
	useTask((dt) => {
		const LERP = 1 - Math.pow(0.0001, dt);
		displayX += (targetX - displayX) * LERP;
		displayZ += (targetZ - displayZ) * LERP;
		if (enemy.isMarked) {
			t += dt;
			pulse = 0.85 + Math.sin(t * 6) * 0.15;
		}
	});
</script>

<T.Group position={[displayX, 0, displayZ]}>
	<T.Mesh>
		<T.BoxGeometry args={[0.8, 1.5, 0.6]} />
		<T.MeshStandardMaterial color={ENEMY_COLORS[enemy.enemyType] ?? '#c33'} />
	</T.Mesh>

	{#if enemy.isMarked}
		<!-- Mark ring above enemy -->
		<T.Mesh position={[0, 2.2, 0]} rotation={[Math.PI / 4, 0, 0]} scale={[pulse, pulse, pulse]}>
			<T.TorusGeometry args={[0.4, 0.07, 6, 4]} />
			<T.MeshBasicMaterial color="#f84" />
		</T.Mesh>
		<!-- Stem -->
		<T.Mesh position={[0, 1.6, 0]}>
			<T.CylinderGeometry args={[0.03, 0.03, 1, 4]} />
			<T.MeshBasicMaterial color="#f84" />
		</T.Mesh>
	{/if}
</T.Group>
