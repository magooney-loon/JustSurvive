<script module lang="ts">
	import { MeshLambertMaterial } from 'three';
	const _lc = new Map<string, MeshLambertMaterial>();
	export function eL(hex: string): MeshLambertMaterial {
		let m = _lc.get(hex);
		if (!m) _lc.set(hex, (m = new MeshLambertMaterial({ color: hex })));
		return m;
	}

	import * as THREE from 'three';
	export const beamGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 6);
	export const beamMat = new THREE.MeshBasicMaterial({
		color: '#ffffff',
		transparent: true,
		depthWrite: false,
		blending: THREE.AdditiveBlending
	});

	export const glowGeo = new THREE.CylinderGeometry(0.1, 0.1, 1, 8);
	export const glowMat = new THREE.MeshBasicMaterial({
		color: '#ff88cc',
		transparent: true,
		depthWrite: false,
		blending: THREE.AdditiveBlending,
		side: THREE.BackSide
	});

	export const impactGeo = new THREE.SphereGeometry(0.22, 8, 6);
	export const impactMat = new THREE.MeshBasicMaterial({
		color: '#ff88cc',
		transparent: true,
		depthWrite: false,
		blending: THREE.AdditiveBlending
	});
</script>

<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import type { Texture } from 'three';
	import PlayerRig from '$lib/character/PlayerRig.svelte';
	import { localPos } from '$lib/stores/movement.svelte.js';
	import { healBeam, HEAL_BEAM_MS } from '$lib/stores/abilities.svelte.js';

	export type HealerRigProps = {
		color: string;
		walkPhase: number;
		speed: number;
		shotPulse: number;
		phase?: string;
		isBracing?: boolean;
		texture?: Texture | null;
	};

	let {
		color,
		walkPhase,
		speed,
		shotPulse,
		phase = 'sunset',
		isBracing = false,
		texture = null
	}: HealerRigProps = $props();

	const moveIntensity = $derived(Math.min(speed / 6, 1));
	const sinWalk = $derived(Math.sin(walkPhase));
	const sinHalf = $derived(Math.sin(walkPhase * 0.5));
	const swing = $derived(sinWalk * 1.1 * moveIntensity);
	const bob = $derived(Math.abs(sinWalk) * 0.07 * moveIntensity);
	const sway = $derived(sinHalf * 0.18 * moveIntensity);
	const hipShift = $derived(sinWalk * 0.06 * moveIntensity);
	const torsoTwist = $derived(sinWalk * 0.18 * moveIntensity);
	const isSprinting = $derived(speed > 6);
	const leanForward = $derived((isSprinting ? 0.22 : 0.08) * moveIntensity);

	const armForwardZ = -0.2;
	const rightArmRotX = $derived(swing * 0.8);

	const _dir = new THREE.Vector3();
	const _mid = new THREE.Vector3();
	const _q = new THREE.Quaternion();
	const _yAxis = new THREE.Vector3(0, 1, 0);
	const BEAM_Y = 1.1;

	let beamRef = $state.raw<THREE.Mesh | undefined>(undefined);
	let glowRef = $state.raw<THREE.Mesh | undefined>(undefined);
	let impactRef = $state.raw<THREE.Mesh | undefined>(undefined);

	useTask(() => {
		const now = Date.now();
		const elapsed = now - (healBeam.until - HEAL_BEAM_MS);
		const t = healBeam.active && now < healBeam.until ? 1 - elapsed / HEAL_BEAM_MS : 0;

		if (t <= 0 || !beamRef || !glowRef || !impactRef) {
			if (beamRef) beamRef.visible = false;
			if (glowRef) glowRef.visible = false;
			if (impactRef) impactRef.visible = false;
			return;
		}

		// Start from player position (0,0 since we're already inside PlayerEntity's transform)
		const fromX = 0,
			fromZ = 0;
		const toX = healBeam.toX - localPos.x;
		const toZ = healBeam.toZ - localPos.z;

		_dir.set(toX - fromX, 0, toZ - fromZ);
		const len = _dir.length();
		if (len < 0.05) {
			beamRef.visible = false;
			glowRef.visible = false;
			impactRef.visible = false;
			return;
		}

		_dir.normalize();
		_mid.set((fromX + toX) / 2, BEAM_Y, (fromZ + toZ) / 2);
		_q.setFromUnitVectors(_yAxis, _dir);

		const xScale = 0.4 + t * 0.6;

		beamRef.position.copy(_mid);
		beamRef.quaternion.copy(_q);
		beamRef.scale.set(xScale, len, xScale);
		beamMat.opacity = t * 0.95;
		beamRef.visible = true;

		glowRef.position.copy(_mid);
		glowRef.quaternion.copy(_q);
		glowRef.scale.set(xScale * 2.5, len, xScale * 2.5);
		glowMat.opacity = t * 0.35;
		glowRef.visible = true;

		const impactScale = 0.6 + (1 - t) * 1.2;
		impactRef.position.set(toX, BEAM_Y, toZ);
		impactRef.scale.setScalar(impactScale);
		impactMat.opacity = t * 0.8;
		impactRef.visible = true;
	});
</script>

<PlayerRig
	classChoice="healer"
	{color}
	{walkPhase}
	{speed}
	{shotPulse}
	{phase}
	{isBracing}
	{texture}
/>

<T.Group position={[hipShift, bob, 0]} rotation={[sway * 0.08, torsoTwist, sway * 0.12]}>
	<T.Group position={[0.24, 1.1, armForwardZ - leanForward * 0.6]} rotation={[rightArmRotX, 0, 0]}>
		{@const recoil = shotPulse * 0.12}
		<T.Mesh position={[0, 0, -0.6 - recoil]} rotation={[Math.PI / 2, 0, 0]}>
			<T.CylinderGeometry args={[0.045, 0.055, 0.45, 6]} />
			<T.MeshStandardMaterial color="#2b2b2b" roughness={0.38} metalness={0.42} />
		</T.Mesh>
		{#if shotPulse > 0}
			<T.Mesh position={[0, 0, -0.95 - recoil]} scale={[shotPulse, shotPulse, shotPulse]}>
				<T.ConeGeometry args={[0.12, 0.3, 6]} />
				<T.MeshBasicMaterial color="#ff88cc" transparent opacity={shotPulse} />
			</T.Mesh>
		{/if}
	</T.Group>
</T.Group>

<!-- Heal Beam Effect -->
<T.Mesh
	bind:ref={beamRef}
	visible={false}
	geometry={beamGeo}
	material={beamMat}
	receiveShadow={false}
	castShadow={false}
/>
<T.Mesh
	bind:ref={glowRef}
	visible={false}
	geometry={glowGeo}
	material={glowMat}
	receiveShadow={false}
	castShadow={false}
/>
<T.Mesh
	bind:ref={impactRef}
	visible={false}
	geometry={impactGeo}
	material={impactMat}
	receiveShadow={false}
	castShadow={false}
/>
