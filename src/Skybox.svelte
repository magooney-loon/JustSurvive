<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core';
	import { Stars as StarsComponent, Sky } from '@threlte/extras';
	import * as THREE from 'three';
	import { settingsState } from './settings.svelte.js';
	import { skyState } from './localGameState.svelte.js';

	const { camera } = useThrelte();
	let skyGroup = $state<THREE.Group | undefined>(undefined);
	let skyPos = new THREE.Vector3();

	// ─── Quality-based star counts ────────────────────────────────────────────
	const starCounts = $derived.by(() => {
		switch (settingsState.graphics.quality) {
			case 'low':  return { stars1: 200, stars2: 180 };
			case 'mid':  return { stars1: 450, stars2: 350 };
			case 'high': return { stars1: 720, stars2: 540 };
			default:     return { stars1: 450, stars2: 350 };
		}
	});

	// ─── Sun world position (for directional light) ───────────────────────────
	const sunPos = $derived.by(() => {
		const elRad = skyState.elevation * (Math.PI / 180);
		const azRad = skyState.azimuth   * (Math.PI / 180);
		// Keep light source above horizon so shadows always come from above
		const y = Math.max(10, Math.sin(elRad) * 100);
		return [
			Math.cos(elRad) * Math.sin(azRad) * 100,
			y,
			Math.cos(elRad) * Math.cos(azRad) * 100
		] as [number, number, number];
	});

	const sunColor = $derived(
		`rgb(${Math.round(skyState.sunR * 255)},${Math.round(skyState.sunG * 255)},${Math.round(skyState.sunB * 255)})`
	);

	useTask((dt) => {
		if (!skyGroup) return;
		const cam = $camera;
		if (!cam) return;
		const LERP = 1 - Math.pow(0.0001, dt);
		skyPos.lerp(cam.position, LERP * 0.15);
		skyGroup.position.copy(skyPos);
	});
</script>

<!-- Global illumination: Sky atmosphere + lighting ──────────────────── -->
<Sky
	elevation={skyState.elevation}
	azimuth={skyState.azimuth}
	turbidity={skyState.turbidity}
	rayleigh={skyState.rayleigh}
	mieCoefficient={skyState.mieCoefficient}
	mieDirectionalG={skyState.mieDirectionalG}
	setEnvironment={true}
/>

<T.AmbientLight intensity={skyState.ambientIntensity} />
<T.DirectionalLight
	position={sunPos}
	intensity={skyState.sunIntensity}
	color={sunColor}
	castShadow={false}
/>

<!-- Stars ───────────────────────────────────────────────────────────── -->
<T.Group bind:ref={skyGroup}>
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
