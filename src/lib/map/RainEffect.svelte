<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core';
	import * as THREE from 'three';
	import { skyState } from '../stores/sky.svelte.js';

	const { camera } = useThrelte();

	const DROP_COUNT = 700;
	const BOX_W = 30;   // ±15 units around camera in XZ
	const BOX_H = 16;   // vertical span
	const FALL_SPEED = 22; // units/s
	const STREAK_LEN = 0.38; // vertical length of each drop

	// Pre-allocate positions: each drop = 2 vertices × 3 floats
	const positions = new Float32Array(DROP_COUNT * 6);

	for (let i = 0; i < DROP_COUNT; i++) {
		const x = (Math.random() - 0.5) * BOX_W;
		const y = Math.random() * BOX_H;
		const z = (Math.random() - 0.5) * BOX_W;
		const b = i * 6;
		positions[b]     = x;  positions[b + 1] = y;              positions[b + 2] = z;
		positions[b + 3] = x;  positions[b + 4] = y - STREAK_LEN; positions[b + 5] = z;
	}

	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

	const mat = new THREE.LineBasicMaterial({
		color: '#8aaebb',
		transparent: true,
		opacity: 0,
		depthWrite: false
	});

	const rainMesh = new THREE.LineSegments(geo, mat);
	rainMesh.frustumCulled = false; // follows camera, never cull

	useTask((dt) => {
		const storm = skyState.stormIntensity;
		// Fade opacity with storm intensity
		mat.opacity = Math.min(storm * 0.45, 0.45);

		if (storm < 0.02) return;

		const cam = $camera;
		if (!cam) return;

		// Whole mesh tracks camera XZ — only Y needs updating per drop
		rainMesh.position.set(cam.position.x, 0, cam.position.z);

		const fall = FALL_SPEED * dt;
		for (let i = 0; i < DROP_COUNT; i++) {
			const b = i * 6;
			positions[b + 1] -= fall;
			positions[b + 4] -= fall;
			// Wrap: when top of streak falls below ground, teleport to top of box
			if (positions[b + 1] < -0.5) {
				const newY = BOX_H - 0.5 + Math.random() * 2;
				positions[b + 1] = newY;
				positions[b + 4] = newY - STREAK_LEN;
			}
		}
		geo.attributes.position.needsUpdate = true;
	});
</script>

<T is={rainMesh} />
