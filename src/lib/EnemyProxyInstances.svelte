<script lang="ts">
	import { T } from '@threlte/core';
	import { InstancedMesh, Instance } from '@threlte/extras';
	import type { Enemy } from '../module_bindings/types.js';

	type Props = { enemies: Enemy[] };
	let { enemies }: Props = $props();

	const ENEMY_COLORS: Record<string, string> = {
		basic: '#a22',
		fast: '#94d',
		brute: '#722',
		spitter: '#2a6'
	};

	// Fixed limit — avoids InstancedMesh rebuild when enemy count changes.
	// range controls how many are actually rendered.
	const MAX_FAR_ENEMIES = 150;
</script>

<InstancedMesh limit={MAX_FAR_ENEMIES} range={enemies.length}>
	<T.CapsuleGeometry args={[0.08, 0.35, 4, 6]} />
	<T.MeshLambertMaterial />
	{#each enemies as enemy (enemy.id)}
		<Instance
			position={[Number(enemy.posX) / 1000, 0.9, Number(enemy.posZ) / 1000]}
			scale={[enemy.enemyType === 'brute' ? 1.2 : enemy.enemyType === 'fast' ? 0.9 : 1.0, 1, 1]}
			color={ENEMY_COLORS[enemy.enemyType] ?? '#a22'}
		/>
	{/each}
</InstancedMesh>
