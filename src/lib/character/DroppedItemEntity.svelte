<script lang="ts">
	import { T } from '@threlte/core';

	type ItemType = 'hp' | 'stamina' | 'double_damage' | 'double_speed';

	interface Props {
		posX: bigint;
		posZ: bigint;
		itemType: string;
		spawnedAt: { microsSinceUnixEpoch: bigint };
	}

	let { posX, posZ, itemType }: Props = $props();

	const ITEM_COLORS: Record<ItemType, number> = {
		hp:            0xff4444,
		stamina:       0x44ff88,
		double_damage: 0xff8800,
		double_speed:  0x44aaff
	};

	const colorHex = ITEM_COLORS[itemType as ItemType] ?? 0xffffff;

	const x = $derived(Number(posX) / 1000);
	const z = $derived(Number(posZ) / 1000);
</script>

<T.Mesh position={[x, 0.15, z]} rotation.x={Math.PI / 2}>
	<T.TorusGeometry args={[0.38, 0.06, 8, 24]} />
	<T.MeshBasicMaterial color={colorHex} />
</T.Mesh>
