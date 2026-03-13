<script module lang="ts">
	import * as THREE from 'three';
	export const fastCrestGeo = new THREE.ConeGeometry(0.06, 0.36, 6);
	export const fastFinGeo = new THREE.ConeGeometry(0.05, 0.4, 6);
	export const fastCrestMat = new THREE.MeshStandardMaterial({ color: '#f99' });
	export const fastFinMat = new THREE.MeshStandardMaterial({ color: '#f77' });
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

	export type FastRigProps = {
		color: string;
		walkPhase: number;
		speed: number;
		attackPhase?: number;
		limbRadius?: number;
	};

	let { color, walkPhase, speed, attackPhase = 0, limbRadius = 0.075 }: FastRigProps = $props();
</script>

<StickRig {color} {walkPhase} {speed} isEnemy={true} {attackPhase} {limbRadius} />

<T.Group>
	<T.Mesh
		position={[0, 1.52, -0.02]}
		rotation={[0.2, 0, 0]}
		geometry={fastCrestGeo}
		material={fastCrestMat}
	/>
	<T.Mesh
		position={[0, 1.15, 0.2]}
		rotation={[Math.PI / 2, 0, 0]}
		geometry={fastFinGeo}
		material={fastFinMat}
	/>
	<T.Mesh position={[-0.1, 1.65, -0.2]} geometry={enemyEyeGeo} material={enemyEyeMat} />
	<T.Mesh position={[0.1, 1.65, -0.2]} geometry={enemyEyeGeo} material={enemyEyeMat} />
</T.Group>
