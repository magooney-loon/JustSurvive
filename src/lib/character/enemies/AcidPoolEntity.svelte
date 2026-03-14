<script module lang="ts">
	import * as THREE from 'three';
	const acidGeo = new THREE.CircleGeometry(2.0, 10);
	const acidMat = new THREE.MeshBasicMaterial({
		color: '#3a3',
		opacity: 0.6,
		transparent: true
	});
</script>

<script lang="ts">
	import { T } from '@threlte/core';
	import type { AcidPool } from '$bindings/types.js';

	type Props = { pool: AcidPool };
	let { pool }: Props = $props();

	const x = $derived(Number(pool.posX) / 1000);
	const z = $derived(Number(pool.posZ) / 1000);
</script>

<T.Group position={[x, 0.01, z]}>
	<T.Mesh rotation={[-Math.PI / 2, 0, 0]} geometry={acidGeo} material={acidMat} />
</T.Group>
