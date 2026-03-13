<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import * as THREE from 'three';
	import { localPos } from '../stores/movement.svelte.js';
	import { spotterFlash, SPOTTER_FLASH_MS } from '../stores/abilities.svelte.js';

	// Build a flat sector geometry (pizza slice): origin + arc vertices
	function makeSector(radius: number, halfAngle: number, segments: number): THREE.BufferGeometry {
		const verts: number[] = [0, 0, 0];
		for (let i = 0; i <= segments; i++) {
			const a = -halfAngle + (2 * halfAngle * i) / segments;
			verts.push(Math.sin(a) * radius, 0, -Math.cos(a) * radius);
		}
		const idx: number[] = [];
		for (let i = 0; i < segments; i++) idx.push(0, i + 1, i + 2);
		const geo = new THREE.BufferGeometry();
		geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
		geo.setIndex(idx);
		return geo;
	}

	const geo = makeSector(5, Math.PI / 4, 16);
	const mat = new THREE.MeshBasicMaterial({
		color: 0x22ddff,
		transparent: true,
		opacity: 0,
		side: THREE.DoubleSide,
		depthWrite: false
	});

	let visible = $state(false);

	useTask(() => {
		if (!spotterFlash.active) {
			mat.opacity = 0;
			visible = false;
			return;
		}
		const elapsed = Date.now() - (spotterFlash.until - SPOTTER_FLASH_MS);
		const t = Math.max(0, 1 - elapsed / SPOTTER_FLASH_MS);
		if (t <= 0) {
			spotterFlash.active = false;
			mat.opacity = 0;
			visible = false;
			return;
		}
		mat.opacity = t * 0.6;
		visible = true;
	});
</script>

{#if visible}
	<T.Mesh
		geometry={geo}
		{mat}
		position={[localPos.x, 0.08, localPos.z]}
		rotation={[0, -spotterFlash.yaw, 0]}
	/>
{/if}
