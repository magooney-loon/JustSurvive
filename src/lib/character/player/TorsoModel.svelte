<script lang="ts">
	import { useTask } from '@threlte/core';
	import { GLTF, useGltfAnimations } from '@threlte/extras';
	import { input } from '$lib/stores/movement.svelte.js';

	type TorsoAnim = 'Torso_Shooting' | 'Torso_Shooting2' | 'Torso_Running' | 'Torso_Idle';

	type Props = {
		speed: number;
		isShooting: number; // 0 or 1
	};
	let { speed, isShooting }: Props = $props();

	const base = import.meta.env.BASE_URL;
	const { gltf, actions, mixer } = useGltfAnimations<TorsoAnim>();

	let torsoRotation = $state(0);
	let currentWeights = $state({
		Torso_Shooting: 0,
		Torso_Shooting2: 0,
		Torso_Running: 0,
		Torso_Idle: 1
	});
	const WEIGHT_LERP = 8; // smoothing speed for animation transitions

	// Start all actions playing at weight 0, idle at 1
	$effect(() => {
		if (!$actions?.['Torso_Idle']) return;
		for (const name of [
			'Torso_Shooting',
			'Torso_Shooting2',
			'Torso_Running',
			'Torso_Idle'
		] as TorsoAnim[]) {
			const a = $actions[name];
			if (!a) continue;
			a.reset().play();
			a.setEffectiveWeight(name === 'Torso_Idle' ? 1 : 0);
		}
	});

	useTask((dt) => {
		if (!mixer) return;

		// Calculate torso rotation based on strafe input only
		// Left strafe: rotate left, Right strafe: rotate right
		// Pure forward/back: no rotation
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
		const rotDiff = targetRotation - torsoRotation;
		torsoRotation += rotDiff * Math.min(1, dt * 12);

		// Determine animation weights based on movement and shooting
		const isMoving = speed > 0.5;
		const shootWeight = isShooting > 0.5 ? 1 : 0;
		const moveWeight = isMoving ? 1 : 0;

		// Smooth transitions between animation states
		const lerpFactor = Math.min(1, dt * WEIGHT_LERP);
		const idleLerpFactor = lerpFactor * 0.5; // slower idle transition

		// Calculate target weights
		const wShooting = shootWeight * moveWeight;
		const wShootingIdle = shootWeight * (1 - moveWeight);
		const wTorsoForward = (1 - shootWeight) * moveWeight;
		const wTorsoIdle = (1 - shootWeight) * (1 - moveWeight);

		// Smooth weight transitions
		currentWeights.Torso_Shooting += (wShooting - currentWeights.Torso_Shooting) * lerpFactor;
		currentWeights.Torso_Shooting2 +=
			(wShootingIdle - currentWeights.Torso_Shooting2) * idleLerpFactor;
		currentWeights.Torso_Running += (wTorsoForward - currentWeights.Torso_Running) * lerpFactor;
		currentWeights.Torso_Idle += (wTorsoIdle - currentWeights.Torso_Idle) * idleLerpFactor;

		$actions['Torso_Shooting']?.setEffectiveWeight(currentWeights.Torso_Shooting);
		$actions['Torso_Shooting2']?.setEffectiveWeight(currentWeights.Torso_Shooting2);
		$actions['Torso_Running']?.setEffectiveWeight(currentWeights.Torso_Running);
		$actions['Torso_Idle']?.setEffectiveWeight(currentWeights.Torso_Idle);

		mixer.update(dt);
	});
</script>

<!-- scale=0.05: torso root positioning -->
<GLTF
	bind:gltf={$gltf}
	url="{base}models/player/GunnerTorso.glb"
	position={[0, 0, 0]}
	rotation={[0, Math.PI, 0]}
	scale={[-0.07, 0.07, 0.07]}
/>
