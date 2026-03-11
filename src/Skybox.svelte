<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core';
	import { Stars as StarsComponent } from '@threlte/extras';
	import * as THREE from 'three';
	import { settingsState } from './settings.svelte.js';

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
			radius={20}
			depth={20}
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
			depth={20}
			factor={1.9}
			fade={true}
			lightness={0.4}
			opacity={1}
			saturation={0.45}
			speed={0.2}
			userData={{ hideInTree: true, selectable: false }}
		/>
	</T.Group>
</T.Group>
