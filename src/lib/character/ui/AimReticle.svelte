<script lang="ts">
	import { T } from '@threlte/core';

	type Props = {
		x: number;
		z: number;
		color?: string;
		radius?: number;
		thickness?: number;
		opacity?: number;
		circleRadius?: number;
		y?: number;
		rotationY?: number;
		scale?: number;
	};

	let {
		x,
		z,
		color = '#fff',
		radius = 0.35,
		thickness = 0.07,
		opacity = 0.85,
		circleRadius = 0.05,
		y = 0.05,
		rotationY = 0,
		scale = 1
	}: Props = $props();
</script>

<T.Group position={[x, y, z]} rotation={[0, rotationY, 0]} scale={[scale, scale, scale]}>
	<T.Mesh rotation={[-Math.PI / 2, 0, 0]}>
		<T.RingGeometry args={[radius, radius + thickness, 16]} />
		<T.MeshBasicMaterial {color} transparent {opacity} />
	</T.Mesh>
	<T.Mesh rotation={[-Math.PI / 2, 0, 0]}>
		<T.CircleGeometry args={[circleRadius, 8]} />
		<T.MeshBasicMaterial {color} transparent {opacity} />
	</T.Mesh>
</T.Group>
