<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import type { ItemSpawn } from '../module_bindings/types.js';

	type Props = { item: ItemSpawn };
	let { item }: Props = $props();

	const x = $derived(Number(item.posX) / 1000);
	const z = $derived(Number(item.posZ) / 1000);

	const ITEM_COLORS: Record<string, string> = {
		energy_drink: '#ff4',
		stamina_boost: '#4af',
		medkit: '#f44',
		armor_plate: '#88f',
		flare: '#fa4',
	};

	let bobY = $state(0);
	let t = 0;
	useTask((dt) => { t += dt; bobY = Math.sin(t * 2) * 0.15; });
</script>

<T.Group position={[x, 0.5 + bobY, z]}>
	<T.Mesh>
		<T.BoxGeometry args={[0.4, 0.4, 0.4]} />
		<T.MeshStandardMaterial
			color={ITEM_COLORS[item.itemType] ?? '#fff'}
			emissive={ITEM_COLORS[item.itemType] ?? '#fff'}
			emissiveIntensity={0.3}
		/>
	</T.Mesh>
</T.Group>
