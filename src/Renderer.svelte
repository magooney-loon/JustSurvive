<script lang="ts">
	import { useThrelte, useTask } from '@threlte/core';
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import {
		EffectComposer,
		EffectPass,
		RenderPass,
		SMAAEffect,
		SMAAPreset,
		BloomEffect,
		KernelSize,
		VignetteEffect,
		PixelationEffect,
		GlitchEffect,
		GlitchMode
	} from 'postprocessing';
	import { settingsState, log } from '$root/settings.svelte.js';
	import { localHealthState } from '$lib/stores/sky.svelte.js';

	const { scene, renderer, camera, size, autoRender, renderStage } = useThrelte();

	// Adapt the default WebGLRenderer for postprocessing
	// Note: Default WebGL anti-aliasing is disabled in Canvas for performance,
	// we use SMAA post-processing anti-aliasing instead for better control
	const composer = new EffectComposer(renderer);
	let vignetteEffect: VignetteEffect | null = null;
	let pixelationEffect: PixelationEffect | null = null;
	let glitchEffect: GlitchEffect | null = null;

	const VIGNETTE_BASE = 0.75;
	const VIGNETTE_MAX = 1.8;
	const VIGNETTE_LERP = 4; // lerp speed (units/sec)

	const PIXELATION_GRANULARITY = 4.5;

	const GLITCH_START = 0.2;
	const GLITCH_MAX_STRENGTH = 0.3;
	const GLITCH_MIN_STRENGTH = 0.05;

	const setupEffectComposer = () => {
		// Remove all existing passes to prevent duplicates
		composer.removeAllPasses();
		vignetteEffect = null;
		pixelationEffect = null;
		glitchEffect = null;

		// Add the render pass
		const renderPass = new RenderPass(scene, $camera);
		composer.addPass(renderPass);

		// Skip effects for low quality - only basic rendering (no anti-aliasing)
		if (settingsState.graphics.quality === 'low') {
			log.info('Graphics quality: LOW - Post-processing and anti-aliasing disabled');
			return;
		}

		const isHighQuality = settingsState.graphics.quality === 'high';
		log.info(
			`Graphics quality: ${settingsState.graphics.quality.toUpperCase()} - Post-processing and SMAA anti-aliasing enabled`
		);

		const bloomEffect = new BloomEffect({
			intensity: isHighQuality ? 3 : 1,
			luminanceThreshold: isHighQuality ? 0.03 : 0.01,
			height: isHighQuality ? 1024 : 512,
			width: isHighQuality ? 1024 : 512,
			luminanceSmoothing: isHighQuality ? 0.08 : 0.06,
			mipmapBlur: true,
			kernelSize: isHighQuality ? KernelSize.HUGE : KernelSize.MEDIUM
		});

		// SMAA anti-aliasing (replaces default WebGL anti-aliasing for better performance)
		const smaaEffect = new SMAAEffect({
			preset: isHighQuality ? SMAAPreset.ULTRA : SMAAPreset.MEDIUM
		});

		vignetteEffect = new VignetteEffect({
			eskil: false,
			offset: 0.2,
			darkness: VIGNETTE_BASE
		});

		pixelationEffect = new PixelationEffect(PIXELATION_GRANULARITY);

		glitchEffect = new GlitchEffect({
			delay: new THREE.Vector2(1.5, 3.5),
			duration: new THREE.Vector2(0.6, 1.0),
			strength: new THREE.Vector2(0.3, 1.0),
			ratio: 0.85
		});
		glitchEffect.mode = GlitchMode.DISABLED;

		const effectPass = new EffectPass($camera, bloomEffect, smaaEffect, vignetteEffect);
		composer.addPass(effectPass);

		const pixelPass = new EffectPass($camera, pixelationEffect, glitchEffect);
		composer.addPass(pixelPass);
	};

	$effect(() => {
		setupEffectComposer();
	});

	$effect(() => {
		composer.setSize($size.width, $size.height);
	});

	// We need to disable auto rendering as soon as this component is
	// mounted and restore the previous state when it is unmounted.
	onMount(() => {
		const before = autoRender.current;
		autoRender.set(false);
		return () => autoRender.set(before);
	});

	// Use the render task to render with the composer
	useTask(
		(delta) => {
			if (vignetteEffect) {
				const target =
					VIGNETTE_BASE + (VIGNETTE_MAX - VIGNETTE_BASE) * (1 - localHealthState.ratio);
				vignetteEffect.darkness +=
					(target - vignetteEffect.darkness) * Math.min(1, VIGNETTE_LERP * delta);
			}
			if (glitchEffect) {
				const ratio = localHealthState.ratio;
				if (ratio < GLITCH_START) {
					const intensity = (GLITCH_START - ratio) / GLITCH_START;
					glitchEffect.mode = GlitchMode.SPORADIC;
					const strength =
						GLITCH_MIN_STRENGTH + (GLITCH_MAX_STRENGTH - GLITCH_MIN_STRENGTH) * intensity;
					glitchEffect.minStrength = strength;
					glitchEffect.maxStrength = strength * 2;
				} else {
					glitchEffect.mode = GlitchMode.DISABLED;
				}
			}
			composer.render(delta);
		},
		{ stage: renderStage, autoInvalidate: false }
	);

	// Clean up resources when the component is unmounted
	$effect(() => {
		return () => {
			composer.removeAllPasses();
			composer.dispose();
		};
	});
</script>
