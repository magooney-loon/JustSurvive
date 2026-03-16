<script lang="ts">
	import { useTask } from '@threlte/core';
	import { GLTF, useGltfAnimations } from '@threlte/extras';
	import { input } from '$lib/stores/movement.svelte.js';

	type LegsAnim = 'Idle' | 'Forward' | 'ForwardLeft' | 'ForwardRight';

	type Props = {
		speed: number;
	};
	let { speed }: Props = $props();

	const base = import.meta.env.BASE_URL;
	const { gltf, actions, mixer } = useGltfAnimations<LegsAnim>();

	let legsRotation = $state(0);
	let currentWeights = $state({ Idle: 1, Forward: 0, ForwardLeft: 0, ForwardRight: 0 });
	const WEIGHT_LERP = 8; // smoothing speed for animation transitions

	// Start all actions playing at weight 0, idle at 1
	$effect(() => {
		if (!$actions?.['Idle']) return;
		for (const name of ['Idle', 'Forward', 'ForwardLeft', 'ForwardRight'] as LegsAnim[]) {
			const a = $actions[name];
			if (!a) continue;
			a.reset().play();
			a.setEffectiveWeight(name === 'Idle' ? 1 : 0);
		}
	});

	useTask((dt) => {
		if (!mixer) return;

		// Calculate leg rotation based on strafe input only
		// Left strafe: rotate left, Right strafe: rotate right
		// Pure forward/back: no rotation (timeScale drives direction)
		let targetRotation = 0;
		const left = input.left ? 1 : 0;
		const right = input.right ? 1 : 0;
		const isBackwards = input.back;

		if (left && !right) {
			targetRotation = isBackwards ? -0.8 : 0.3; // less rotation when going forward
		} else if (right && !left) {
			targetRotation = isBackwards ? 0.8 : -0.3; // less rotation when going forward
		}

		// Smooth rotation
		const rotDiff = targetRotation - legsRotation;
		legsRotation += rotDiff * Math.min(1, dt * 12);

		const moveIntensity = Math.min(speed / 4, 1);
		// Normalised strafe component: -1 = full left, +1 = full right
		const rgtNorm = left ? -1 : right ? 1 : 0;

		// Animation weights
		const wIdle = 1 - moveIntensity;
		const wFwd = (1 - Math.abs(rgtNorm)) * moveIntensity;
		const wFwdLeft = Math.max(0, -rgtNorm) * moveIntensity;
		const wFwdRight = Math.max(0, rgtNorm) * moveIntensity;

		// Smooth weight transitions
		const lerpFactor = Math.min(1, dt * WEIGHT_LERP);
		const idleLerpFactor = lerpFactor * 0.5; // slower idle transition
		currentWeights.Idle += (wIdle - currentWeights.Idle) * idleLerpFactor;
		currentWeights.Forward += (wFwd - currentWeights.Forward) * lerpFactor;
		currentWeights.ForwardLeft += (wFwdLeft - currentWeights.ForwardLeft) * lerpFactor;
		currentWeights.ForwardRight += (wFwdRight - currentWeights.ForwardRight) * lerpFactor;

		$actions['Idle']?.setEffectiveWeight(currentWeights.Idle);
		$actions['Forward']?.setEffectiveWeight(currentWeights.Forward);
		$actions['ForwardLeft']?.setEffectiveWeight(currentWeights.ForwardLeft);
		$actions['ForwardRight']?.setEffectiveWeight(currentWeights.ForwardRight);

		// Negative timeScale plays animation in reverse → looks like backward movement
		const dir = isBackwards ? -1 : 1;
		const rate = speed > 0.5 ? Math.max(0.35, Math.min(1.4, speed / 7)) : 1;
		const timeScale = dir * rate;
		$actions['Idle']?.setEffectiveTimeScale(0.5); // half speed idle
		$actions['Forward']?.setEffectiveTimeScale(timeScale);
		$actions['ForwardLeft']?.setEffectiveTimeScale(timeScale);
		$actions['ForwardRight']?.setEffectiveTimeScale(timeScale);

		mixer.update(dt);
	});
</script>

<!-- scale=0.05: spine root sits at y≈15.2 model units → y≈0.76 game units (hip height) -->
<GLTF
	bind:gltf={$gltf}
	url="{base}models/player/legs.glb"
	position={[0, 0, 0]}
	rotation={[0, Math.PI + legsRotation, 0]}
	scale={0.07}
/>
