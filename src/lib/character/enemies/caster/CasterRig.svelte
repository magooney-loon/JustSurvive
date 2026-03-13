<script module lang="ts">
	import * as THREE from 'three';
	export const casterOrbGeo = new THREE.SphereGeometry(0.16, 8, 6);
	export const casterStaffGeo = new THREE.CylinderGeometry(0.03, 0.04, 0.9, 6);
	export const casterRingGeo = new THREE.TorusGeometry(0.12, 0.025, 6, 12);
	export const casterBeamGeo = new THREE.CylinderGeometry(0.04, 0.07, 8, 6);
	export const casterOrbMat = new THREE.MeshStandardMaterial({
		color: '#8844ff',
		emissive: '#6622cc',
		emissiveIntensity: 1.4
	});
	export const casterStaffMat = new THREE.MeshStandardMaterial({
		color: '#2a1a3a',
		roughness: 0.7
	});
	export const casterRingMat = new THREE.MeshBasicMaterial({ color: '#aa66ff' });
	export const enemyEyeGeo = new THREE.SphereGeometry(0.06, 8, 6);
	export const enemyEyeMat = new THREE.MeshStandardMaterial({
		color: '#aa44ff',
		emissive: '#8844ff',
		emissiveIntensity: 4.0
	});
</script>

<script lang="ts">
	import { T } from '@threlte/core';
	import StickRig from '$lib/character/StickRig.svelte';

	export type CasterRigProps = {
		color: string;
		walkPhase: number;
		speed: number;
		attackPhase?: number;
		beamTimer?: number;
		limbRadius?: number;
	};

	let {
		color,
		walkPhase,
		speed,
		attackPhase = 0,
		beamTimer = 0,
		limbRadius = 0.065
	}: CasterRigProps = $props();

	const beamOpacity = $derived(Math.min(1, (0.65 - beamTimer) * 12) * Math.min(1, beamTimer * 6));
</script>

<StickRig {color} {walkPhase} {speed} isEnemy={true} {attackPhase} {limbRadius} />

<T.Group>
	<T.Mesh
		position={[0.3, 0.95, 0]}
		rotation={[0, 0, 0.15]}
		geometry={casterStaffGeo}
		material={casterStaffMat}
	/>
	<T.Mesh
		position={[0.3, 1.45, 0]}
		geometry={casterOrbGeo}
		material={casterOrbMat}
		scale={[1 + attackPhase * 0.28, 1 + attackPhase * 0.28, 1 + attackPhase * 0.28]}
	/>
	<T.Mesh
		position={[0.3, 1.45, 0]}
		rotation={[0, 0, Math.PI / 2]}
		geometry={casterRingGeo}
		material={casterRingMat}
	/>
	<T.Mesh
		position={[0.3, 1.45, 0]}
		rotation={[Math.PI / 4, 0, 0]}
		geometry={casterRingGeo}
		material={casterRingMat}
	/>
	{#if beamTimer > 0}
		<T.Mesh position={[0.3, 1.45, -4]} rotation={[Math.PI / 2, 0, 0]} geometry={casterBeamGeo}>
			<T.MeshBasicMaterial
				color="#dd99ff"
				transparent
				opacity={beamOpacity * 0.9}
				depthWrite={false}
			/>
		</T.Mesh>
		<T.Mesh
			position={[0.3, 1.45, -4]}
			rotation={[Math.PI / 2, 0, 0]}
			scale={[2.8, 1, 2.8]}
			geometry={casterBeamGeo}
		>
			<T.MeshBasicMaterial
				color="#9933ff"
				transparent
				opacity={beamOpacity * 0.22}
				depthWrite={false}
			/>
		</T.Mesh>
		<T.Mesh position={[0.3, 1.45, -8]} scale={[beamOpacity, beamOpacity, beamOpacity]}>
			<T.SphereGeometry args={[0.35, 8, 6]} />
			<T.MeshBasicMaterial
				color="#ffffff"
				transparent
				opacity={beamOpacity * 0.6}
				depthWrite={false}
			/>
		</T.Mesh>
	{/if}
	<T.Mesh position={[-0.1, 1.65, -0.2]} geometry={enemyEyeGeo} material={enemyEyeMat} />
	<T.Mesh position={[0.1, 1.65, -0.2]} geometry={enemyEyeGeo} material={enemyEyeMat} />
</T.Group>
