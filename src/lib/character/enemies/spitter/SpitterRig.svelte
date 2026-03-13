<script module lang="ts">
	import * as THREE from 'three';
	export const spitterBulbGeo = new THREE.SphereGeometry(0.18, 8, 6);
	export const spitterSacGeo = new THREE.CylinderGeometry(0.08, 0.14, 0.5, 6);
	export const spitterBulbMat = new THREE.MeshStandardMaterial({ color: '#2f7a2f' });
	export const spitterSacMat = new THREE.MeshStandardMaterial({ color: '#2b6a2b' });
	export const enemyEyeGeo = new THREE.SphereGeometry(0.06, 8, 6);
	export const enemyEyeMat = new THREE.MeshStandardMaterial({
		color: '#ffff00',
		emissive: '#ffff00',
		emissiveIntensity: 4.0
	});
</script>

<script lang="ts">
	import { T } from '@threlte/core';
	import StickRig from '$lib/character/StickRig.svelte';

	export type SpitterRigProps = {
		color: string;
		walkPhase: number;
		speed: number;
		attackPhase?: number;
		limbRadius?: number;
	};

	let { color, walkPhase, speed, attackPhase = 0, limbRadius = 0.065 }: SpitterRigProps = $props();
</script>

<StickRig {color} {walkPhase} {speed} isEnemy={true} {attackPhase} {limbRadius} />

<T.Group>
	<T.Mesh position={[0, 1.3, 0.22]} geometry={spitterBulbGeo} material={spitterBulbMat} />
	<T.Mesh
		position={[0, 1.0, 0.25]}
		rotation={[Math.PI / 2, 0, 0]}
		geometry={spitterSacGeo}
		material={spitterSacMat}
	/>
	<T.Mesh position={[-0.1, 1.65, -0.2]} geometry={enemyEyeGeo} material={enemyEyeMat} />
	<T.Mesh position={[0.1, 1.65, -0.2]} geometry={enemyEyeGeo} material={enemyEyeMat} />
</T.Group>
