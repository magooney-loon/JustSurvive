<script module lang="ts">
	import * as THREE from 'three';
	export const basicHornGeo = new THREE.ConeGeometry(0.05, 0.2, 6);
	export const basicHornMat = new THREE.MeshStandardMaterial({ color: '#c77' });
	export const enemyEyeGeo = new THREE.SphereGeometry(0.06, 8, 6);
	export const enemyEyeMat = new THREE.MeshStandardMaterial({
		color: '#ff0000',
		emissive: '#ff0000',
		emissiveIntensity: 4.0
	});
</script>

<script lang="ts">
	import { T } from '@threlte/core';
	import StickRig from '$lib/character/StickRig.svelte';

	export type BasicRigProps = {
		color: string;
		walkPhase: number;
		speed: number;
		attackPhase?: number;
		limbRadius?: number;
	};

	let { color, walkPhase, speed, attackPhase = 0, limbRadius = 0.065 }: BasicRigProps = $props();
</script>

<StickRig {color} {walkPhase} {speed} isEnemy={true} {attackPhase} {limbRadius} />

<T.Group>
	<T.Mesh
		position={[-0.14, 1.64, 0]}
		rotation={[0, 0, -0.3]}
		geometry={basicHornGeo}
		material={basicHornMat}
	/>
	<T.Mesh
		position={[0.14, 1.64, 0]}
		rotation={[0, 0, 0.3]}
		geometry={basicHornGeo}
		material={basicHornMat}
	/>
	<T.Mesh position={[-0.1, 1.65, -0.2]} geometry={enemyEyeGeo} material={enemyEyeMat} />
	<T.Mesh position={[0.1, 1.65, -0.2]} geometry={enemyEyeGeo} material={enemyEyeMat} />
</T.Group>
