<script module lang="ts">
	import * as THREE from 'three';

	// Inner bright beam — thin, opaque-ish
	export const beamGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 6);
	export const beamMat = new THREE.MeshBasicMaterial({
		color: '#ffffff',
		transparent: true,
		depthWrite: false,
		blending: THREE.AdditiveBlending
	});

	// Outer soft glow — wider, more transparent
	export const glowGeo = new THREE.CylinderGeometry(0.1, 0.1, 1, 8);
	export const glowMat = new THREE.MeshBasicMaterial({
		color: '#ff88cc',
		transparent: true,
		depthWrite: false,
		blending: THREE.AdditiveBlending,
		side: THREE.BackSide
	});

	// Impact burst sphere at target
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
	import { localPos, healBeam, HEAL_BEAM_MS } from '../stores/localGameState.svelte.js';

	let beamRef = $state.raw<THREE.Mesh | undefined>(undefined);
	let glowRef = $state.raw<THREE.Mesh | undefined>(undefined);
	let impactRef = $state.raw<THREE.Mesh | undefined>(undefined);

	const _dir = new THREE.Vector3();
	const _mid = new THREE.Vector3();
	const _q = new THREE.Quaternion();
	const _yAxis = new THREE.Vector3(0, 1, 0);

	const BEAM_Y = 1.1; // chest height

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

		const fromX = localPos.x, fromZ = localPos.z;
		const toX = healBeam.toX, toZ = healBeam.toZ;

		_dir.set(toX - fromX, 0, toZ - fromZ);
		const len = _dir.length();
		if (len < 0.05) { beamRef.visible = false; glowRef.visible = false; impactRef.visible = false; return; }

		_dir.normalize();
		_mid.set((fromX + toX) / 2, BEAM_Y, (fromZ + toZ) / 2);
		_q.setFromUnitVectors(_yAxis, _dir);

		// Beam starts wide and slams into target — scale X narrows, Y = length
		const xScale = 0.4 + t * 0.6; // starts wide, tightens as it fades

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

		// Impact sphere expands and fades at target
		const impactScale = 0.6 + (1 - t) * 1.2;
		impactRef.position.set(toX, BEAM_Y, toZ);
		impactRef.scale.setScalar(impactScale);
		impactMat.opacity = t * 0.8;
		impactRef.visible = true;
	});
</script>

<T.Mesh bind:ref={beamRef} visible={false} geometry={beamGeo} material={beamMat} receiveShadow={false} castShadow={false} />
<T.Mesh bind:ref={glowRef} visible={false} geometry={glowGeo} material={glowMat} receiveShadow={false} castShadow={false} />
<T.Mesh bind:ref={impactRef} visible={false} geometry={impactGeo} material={impactMat} receiveShadow={false} castShadow={false} />
