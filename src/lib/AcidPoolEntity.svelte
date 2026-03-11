<script lang="ts">
	import { T } from '@threlte/core';
	import type { AcidPool } from '../module_bindings/types.js';

	type Props = { pool: AcidPool };
	let { pool }: Props = $props();

	const x = $derived(Number(pool.posX) / 1000);
	const z = $derived(Number(pool.posZ) / 1000);
	const r = $derived(Number(pool.radius) / 1000);
</script>

<T.Group position={[x, 0.01, z]}>
	<T.Mesh rotation={[-Math.PI / 2, 0, 0]}>
		<T.CircleGeometry args={[r, 16]} />
		<T.MeshStandardMaterial color="#3f3" emissive="#1a1" opacity={0.6} transparent />
	</T.Mesh>
</T.Group>
