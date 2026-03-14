<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core';
	import { Stars as StarsComponent, Sky } from '@threlte/extras';
	import * as THREE from 'three';
	import { settingsState } from '$root/settings.svelte.js';
	import { skyState } from '$lib/stores/sky.svelte.js';
	import { soundActions } from '$root/Sound.svelte';

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

	// ─── Sun world position (for directional light) ───────────────────────────
	const sunPos = $derived.by(() => {
		const elRad = skyState.elevation * (Math.PI / 180);
		const azRad = skyState.azimuth * (Math.PI / 180);
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

	// ─── Lightning flash state machine ───────────────────────────────────────
	let lightningFlash = $state(0);

	// Per-strike parameters chosen at random when a strike fires
	type LPhase = 'idle' | 'f1' | 'g1' | 'f2' | 'g2' | 'f3';
	let lPhase: LPhase = 'idle';
	let lTimer = 0;
	let lNext = 6 + Math.random() * 10;
	// durations and intensities randomised per strike
	let lF1 = 0,
		lG1 = 0,
		lF2 = 0,
		lI2 = 0,
		lG2 = 0,
		lF3 = 0,
		lI3 = 0;
	let lExtra = 0; // 0, 1, or 2 extra flashes

	useTask((dt) => {
		if (!skyGroup) return;
		const cam = $camera;
		if (!cam) return;
		const LERP = 1 - Math.pow(0.0001, dt);
		skyPos.lerp(cam.position, LERP * 0.15);
		skyGroup.position.copy(skyPos);

		const storm = skyState.stormIntensity;

		if (lPhase === 'idle') {
			if (storm > 0.05) lNext -= dt;
			if (lNext <= 0) {
				// Randomise entire strike profile
				lF1 = 0.04 + Math.random() * 0.07;
				lExtra = Math.random() < 0.55 ? (Math.random() < 0.45 ? 2 : 1) : 0;
				lG1 = 0.06 + Math.random() * 0.14;
				lI2 = 0.25 + Math.random() * 0.3;
				lF2 = 0.03 + Math.random() * 0.05;
				lG2 = 0.05 + Math.random() * 0.1;
				lI3 = 0.1 + Math.random() * 0.15;
				lF3 = 0.02 + Math.random() * 0.04;
				lNext = (4 + Math.random() * 14 + Math.random() * 8) / storm;
				lPhase = 'f1';
				lTimer = 0;
				soundActions.playThunder();
			}
		} else {
			lTimer += dt;
			if (lPhase === 'f1') {
				lightningFlash = storm;
				if (lTimer >= lF1) {
					lPhase = lExtra > 0 ? 'g1' : 'idle';
					lTimer = 0;
					lightningFlash = 0;
				}
			} else if (lPhase === 'g1') {
				lightningFlash = 0;
				if (lTimer >= lG1) {
					lPhase = 'f2';
					lTimer = 0;
				}
			} else if (lPhase === 'f2') {
				lightningFlash = storm * lI2;
				if (lTimer >= lF2) {
					lPhase = lExtra > 1 ? 'g2' : 'idle';
					lTimer = 0;
					lightningFlash = 0;
				}
			} else if (lPhase === 'g2') {
				lightningFlash = 0;
				if (lTimer >= lG2) {
					lPhase = 'f3';
					lTimer = 0;
				}
			} else if (lPhase === 'f3') {
				lightningFlash = storm * lI3;
				if (lTimer >= lF3) {
					lPhase = 'idle';
					lTimer = 0;
					lightningFlash = 0;
				}
			}
		}
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

<!-- Lightning flash — subtle cold blue-white pulse, scaled way down -->
<T.AmbientLight color="#c8d8ff" intensity={lightningFlash * 1.8} />
<T.DirectionalLight
	position={[15, 60, 25]}
	color="#ddeeff"
	intensity={lightningFlash * 3.0}
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
			radius={20}
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
</T.Group>
