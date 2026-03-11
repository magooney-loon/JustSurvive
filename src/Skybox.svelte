<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core';
	import { Stars as StarsComponent, GLTF, useDraco } from '@threlte/extras';
	import * as THREE from 'three';
	import { settingsState } from './settings.svelte.js';

	const dracoLoader = useDraco();
	const { camera } = useThrelte();
	let skyGroup = $state<THREE.Group | undefined>(undefined);
	let skyPos = new THREE.Vector3();

	// ─── Quality-based star counts ────────────────────────────────────────────
	const starCounts = $derived.by(() => {
		switch (settingsState.graphics.quality) {
			case 'low':
				return { stars1: 200, stars2: 180 };
			case 'mid':
				return { stars1: 450, stars2: 350 };
			case 'high':
				return { stars1: 720, stars2: 540 };
			default:
				return { stars1: 450, stars2: 350 };
		}
	});

	// ─── Nebula material opacity ──────────────────────────────────────────────
	let nebulaMaterials: THREE.Material[] = [];

	const handleNebulaLoad = (event: {
		materials: Record<string, THREE.Material>;
		nodes: Record<string, THREE.Object3D>;
	}) => {
		nebulaMaterials = [];

		Object.values(event.materials).forEach((material) => {
			if (
				material instanceof THREE.MeshStandardMaterial ||
				material instanceof THREE.MeshBasicMaterial
			) {
				material.transparent = true;
				material.opacity = 0.25;
				material.blending = THREE.AdditiveBlending;
				material.depthWrite = false;
				material.depthTest = true;
				material.needsUpdate = true;
				nebulaMaterials.push(material);
			}
		});

		Object.values(event.nodes).forEach((node) => {
			if (node instanceof THREE.Mesh && node.material) {
				const material = node.material;
				material.transparent = true;
				if (
					material instanceof THREE.MeshStandardMaterial ||
					material instanceof THREE.MeshBasicMaterial
				) {
					material.opacity = 0.25;
					material.blending = THREE.AdditiveBlending;
					if (!nebulaMaterials.includes(material)) {
						nebulaMaterials.push(material);
					}
				}
				material.depthWrite = false;
				material.depthTest = true;
				material.needsUpdate = true;
			}
		});
	};

	useTask((dt) => {
		if (!skyGroup) return;
		const cam = $camera;
		if (!cam) return;
		const LERP = 1 - Math.pow(0.0001, dt);
		skyPos.lerp(cam.position, LERP * 0.15);
		skyGroup.position.copy(skyPos);
	});
</script>

<T.Group bind:ref={skyGroup}>
	<!-- Background stars — Layer 1 (inner, faster) -->
	<T.Group userData={{ hideInTree: true, selectable: false }}>
		<StarsComponent
			count={starCounts.stars1}
			radius={10}
			depth={30}
			factor={1.45}
			fade={true}
			lightness={0.4}
			opacity={1}
			saturation={0.45}
			speed={0.72}
			userData={{ hideInTree: true, selectable: false }}
		/>
	</T.Group>

	<!-- Background stars — Layer 2 (outer, slower for depth parallax) -->
	<T.Group userData={{ hideInTree: true, selectable: false }}>
		<StarsComponent
			count={starCounts.stars2}
			radius={10}
			depth={30}
			factor={1.9}
			fade={true}
			lightness={0.4}
			opacity={1}
			saturation={0.45}
			speed={0.2}
			userData={{ hideInTree: true, selectable: false }}
		/>
	</T.Group>

	<!-- Nebula model — place at /public/models/skybox/skybox_nebula-transformed.glb -->
	<T.Group position={[0, 20, -27]} scale={0.45} userData={{ hideInTree: true, selectable: false }}>
		<GLTF
			{dracoLoader}
			scale={0.5}
			url="{import.meta.env.BASE_URL}models/skybox/skybox_nebula-transformed.glb"
			onload={handleNebulaLoad}
		/>
	</T.Group>
</T.Group>
