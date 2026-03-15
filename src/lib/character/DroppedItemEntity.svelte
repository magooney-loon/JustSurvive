<script lang="ts">
	import { T, useTask } from '@threlte/core';

	type ItemType = 'hp' | 'stamina' | 'double_damage' | 'double_speed';

	interface Props {
		posX: bigint;
		posZ: bigint;
		itemType: string;
		spawnedAt: { microsSinceUnixEpoch: bigint };
	}

	let { posX, posZ, itemType }: Props = $props();

	const ITEM_COLORS: Record<ItemType, number> = {
		hp:            0xff3333,
		stamina:       0x33ff88,
		double_damage: 0xff7700,
		double_speed:  0x33aaff
	};

	const colorHex = $derived(ITEM_COLORS[itemType as ItemType] ?? 0xffffff);

	const x = $derived(Number(posX) / 1000);
	const z = $derived(Number(posZ) / 1000);

	let t = 0;
	let rotY = $state(0);
	let bobY = $state(0);

	useTask((dt) => {
		t += dt;
		rotY = t * 1.1;
		bobY = Math.sin(t * 2.8) * 0.07;
	});

	// Chevron geometry constants — a ">" pointing along +X
	const H = 0.04;   // bar height (Y)
	const BW = 0.09;  // bar width (Z)
	const CHV_ANGLE = Math.atan2(0.2, 0.3); // ~33.7° — slope of each arm
	const CHV_LEN = Math.sqrt(0.3 * 0.3 + 0.2 * 0.2); // ~0.36 — arm length

	// Plus arm dimensions
	const PAD = 0.26; // half-length of each arm
	const PT  = 0.09; // half-thickness of each arm
</script>

<T.Group position={[x, 0.38 + bobY, z]} rotation.y={rotY}>

	{#if itemType === 'hp'}
		<!-- + shape: two perpendicular bars -->
		<T.Mesh>
			<T.BoxGeometry args={[PT * 2, H, PAD * 2]} />
			<T.MeshBasicMaterial color={colorHex} />
		</T.Mesh>
		<T.Mesh>
			<T.BoxGeometry args={[PAD * 2, H, PT * 2]} />
			<T.MeshBasicMaterial color={colorHex} />
		</T.Mesh>

	{:else if itemType === 'stamina'}
		<!-- >> double chevron — left at x=-0.14, right at x=+0.14 -->
		<!-- left chevron -->
		<T.Mesh position={[-0.14, 0, -0.1]} rotation.y={-CHV_ANGLE}>
			<T.BoxGeometry args={[CHV_LEN, H, BW]} />
			<T.MeshBasicMaterial color={colorHex} />
		</T.Mesh>
		<T.Mesh position={[-0.14, 0, 0.1]} rotation.y={CHV_ANGLE}>
			<T.BoxGeometry args={[CHV_LEN, H, BW]} />
			<T.MeshBasicMaterial color={colorHex} />
		</T.Mesh>
		<!-- right chevron -->
		<T.Mesh position={[0.14, 0, -0.1]} rotation.y={-CHV_ANGLE}>
			<T.BoxGeometry args={[CHV_LEN, H, BW]} />
			<T.MeshBasicMaterial color={colorHex} />
		</T.Mesh>
		<T.Mesh position={[0.14, 0, 0.1]} rotation.y={CHV_ANGLE}>
			<T.BoxGeometry args={[CHV_LEN, H, BW]} />
			<T.MeshBasicMaterial color={colorHex} />
		</T.Mesh>

	{:else if itemType === 'double_damage'}
		<!-- × shape: two bars at ±45° -->
		<T.Mesh rotation.y={Math.PI / 4}>
			<T.BoxGeometry args={[0.54, H, PT * 2]} />
			<T.MeshBasicMaterial color={colorHex} />
		</T.Mesh>
		<T.Mesh rotation.y={-Math.PI / 4}>
			<T.BoxGeometry args={[0.54, H, PT * 2]} />
			<T.MeshBasicMaterial color={colorHex} />
		</T.Mesh>

	{:else if itemType === 'double_speed'}
		<!-- +> : small plus on left, chevron on right -->
		<!-- plus at x=-0.18 (slightly smaller arms) -->
		<T.Mesh position={[-0.18, 0, 0]}>
			<T.BoxGeometry args={[PT * 2, H, PAD * 1.3]} />
			<T.MeshBasicMaterial color={colorHex} />
		</T.Mesh>
		<T.Mesh position={[-0.18, 0, 0]}>
			<T.BoxGeometry args={[PAD * 1.3, H, PT * 2]} />
			<T.MeshBasicMaterial color={colorHex} />
		</T.Mesh>
		<!-- chevron at x=+0.18 -->
		<T.Mesh position={[0.18, 0, -0.1]} rotation.y={-CHV_ANGLE}>
			<T.BoxGeometry args={[CHV_LEN, H, BW]} />
			<T.MeshBasicMaterial color={colorHex} />
		</T.Mesh>
		<T.Mesh position={[0.18, 0, 0.1]} rotation.y={CHV_ANGLE}>
			<T.BoxGeometry args={[CHV_LEN, H, BW]} />
			<T.MeshBasicMaterial color={colorHex} />
		</T.Mesh>
	{/if}

	<!-- ground glow -->
	<T.Mesh position={[0, -0.37, 0]} rotation.x={-Math.PI / 2}>
		<T.CircleGeometry args={[0.28, 16]} />
		<T.MeshBasicMaterial color={colorHex} transparent opacity={0.18} depthWrite={false} />
	</T.Mesh>

</T.Group>
