<script lang="ts">
	import { T } from '@threlte/core';

	type Props = {
		x: number;
		z: number;
		color?: string;
		radius?: number;
		thickness?: number;
	};

	let { x, z, color = '#fff', radius = 0.35, thickness = 0.07 }: Props = $props();
</script>

<T.Group position={[x, 0.05, z]}>
	<T.Mesh rotation={[-Math.PI / 2, 0, 0]}>
		<T.RingGeometry args={[radius, radius + thickness, 16]} />
		<T.MeshBasicMaterial color={color} transparent opacity={0.85} />
	</T.Mesh>
	<T.Mesh rotation={[-Math.PI / 2, 0, 0]}>
		<T.CircleGeometry args={[0.05, 8]} />
		<T.MeshBasicMaterial color={color} />
	</T.Mesh>
</T.Group>
