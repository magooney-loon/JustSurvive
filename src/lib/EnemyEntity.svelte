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

	useTask((dt) => {
		const LERP = 1 - Math.pow(0.0001, dt);
		displayX += (targetX - displayX) * LERP;
		displayZ += (targetZ - displayZ) * LERP;
	});
</script>

<T.Group position={[displayX, 0, displayZ]}>
	<T.Mesh>
		<T.BoxGeometry args={[0.8, 1.5, 0.6]} />
		<T.MeshStandardMaterial color={ENEMY_COLORS[enemy.enemyType] ?? '#c33'} />
	</T.Mesh>
</T.Group>
