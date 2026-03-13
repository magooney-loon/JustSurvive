<script module lang="ts">
	import * as THREE from 'three';
	import { AdditiveBlending } from 'three';
	export const bruteBodyGeo = new THREE.BoxGeometry(0.7, 0.18, 0.32);
	export const bruteSpikeGeo = new THREE.ConeGeometry(0.08, 0.26, 6);
	export const bruteBodyMat = new THREE.MeshStandardMaterial({ color: '#4a1f1f' });
	export const bruteSpikeMat = new THREE.MeshStandardMaterial({ color: '#5c2a2a' });
	export const bruteShieldGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.08, 6);
	export const bruteShieldMat = new THREE.MeshStandardMaterial({
		color: '#2a2a2a',
		roughness: 0.3,
		metalness: 0.7
	});
	export const bruteShieldGlowMat = new THREE.MeshStandardMaterial({
		color: '#ff4400',
		emissive: '#ff2200',
		emissiveIntensity: 0.8
	});
	export const enemyEyeGeo = new THREE.SphereGeometry(0.06, 8, 6);
	export const enemyEyeMat = new THREE.MeshStandardMaterial({
		color: '#ff3300',
		emissive: '#ff0000',
		emissiveIntensity: 4.0
	});
	export { AdditiveBlending };
</script>

<script lang="ts">
	import { T } from '@threlte/core';
	import StickRig from '$lib/character/StickRig.svelte';

	export type BruteRigProps = {
		color: string;
		walkPhase: number;
		speed: number;
		attackPhase?: number;
		limbRadius?: number;
	};

	let { color, walkPhase, speed, attackPhase = 0, limbRadius = 0.13 }: BruteRigProps = $props();

	const moveIntensity = $derived(Math.min(speed / 6, 1));
	const sinWalk = $derived(Math.sin(walkPhase));
	const swing = $derived(sinWalk * 1.1 * moveIntensity);
	const shieldGlow = $derived(0.5 + Math.sin(speed * 2) * 0.3);
	const leanForward = $derived(0.08 * moveIntensity);
</script>

<StickRig {color} {walkPhase} {speed} isEnemy={true} {attackPhase} {limbRadius} />

<T.Group>
	<T.Mesh
		position={[0, 1.35, -0.08]}
		scale={[1.15, 1.1, 1.0]}
		geometry={bruteBodyGeo}
		material={bruteBodyMat}
	/>
	<T.Mesh
		position={[-0.28, 1.55, -0.05]}
		rotation={[0, 0.25, 0]}
		geometry={bruteSpikeGeo}
		material={bruteSpikeMat}
	/>
	<T.Mesh
		position={[0.28, 1.55, -0.05]}
		rotation={[0, -0.25, 0]}
		geometry={bruteSpikeGeo}
		material={bruteSpikeMat}
	/>
	<T.Group position={[0.24, 1.1, -0.2 - leanForward * 0.6]} rotation={[swing * 0.8, 0, 0]}>
		<T.Group position={[0, 0, -0.25]} rotation={[-Math.PI / 2, 0, 0]}>
			<T.Mesh scale={[1.3, 1.2, 1]} geometry={bruteShieldGeo} material={bruteShieldMat} />
			<T.Mesh>
				<T.CylinderGeometry args={[0.47, 0.44, 0.02, 6]} />
				<T.MeshStandardMaterial
					color="#ff4400"
					emissive="#ff2200"
					emissiveIntensity={0.15 + shieldGlow * 1.5}
					roughness={0.28}
					metalness={0.7}
				/>
			</T.Mesh>
			<T.Mesh position={[0, 0.04, 0]}>
				<T.BoxGeometry args={[0.07, 0.01, 0.38]} />
				<T.MeshBasicMaterial color="#ff6633" transparent opacity={0.2 + shieldGlow * 0.4} />
			</T.Mesh>
			<T.Mesh position={[0, 0.04, 0]}>
				<T.BoxGeometry args={[0.38, 0.01, 0.07]} />
				<T.MeshBasicMaterial color="#ff6633" transparent opacity={0.2 + shieldGlow * 0.4} />
			</T.Mesh>
			<T.Mesh position={[0, 0.04, 0]}>
				<T.CylinderGeometry args={[0.06, 0.06, 0.012, 6]} />
				<T.MeshStandardMaterial
					color="#ff6633"
					emissive="#ff4400"
					emissiveIntensity={0.2 + shieldGlow * 1.2}
					roughness={0.3}
					metalness={0.6}
				/>
			</T.Mesh>
			<T.Mesh position={[0, 0.038, 0]}>
				<T.CylinderGeometry args={[0.43, 0.43, 0.001, 16]} />
				<T.MeshBasicMaterial
					color="#ff4400"
					transparent
					opacity={shieldGlow * 0.12}
					blending={AdditiveBlending}
					depthWrite={false}
				/>
			</T.Mesh>
			<T.Mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
				<T.RingGeometry args={[0.44, 0.62, 14]} />
				<T.MeshBasicMaterial
					color="#ff6644"
					transparent
					opacity={shieldGlow * 0.5}
					blending={AdditiveBlending}
					depthWrite={false}
				/>
			</T.Mesh>
		</T.Group>
	</T.Group>
	<T.Mesh position={[-0.1, 1.65, -0.2]} geometry={enemyEyeGeo} material={enemyEyeMat} />
	<T.Mesh position={[0.1, 1.65, -0.2]} geometry={enemyEyeGeo} material={enemyEyeMat} />
</T.Group>
