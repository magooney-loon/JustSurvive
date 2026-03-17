<script lang="ts">
	import { useTask } from '@threlte/core';
	import { GLTF, useGltfAnimations } from '@threlte/extras';
	import { input } from '$lib/stores/movement.svelte.js';

	type LegsAnim = 'Legs_Idle' | 'Legs_Forward' | 'Legs_Left' | 'Legs_Right';

	type Props = {
		speed: number;
	};
	let { speed }: Props = $props();

	const base = import.meta.env.BASE_URL;
	const { gltf, actions, mixer } = useGltfAnimations<LegsAnim>();

	let legsRotation = $state(0);
	let currentWeights = $state({ Legs_Idle: 1, Legs_Forward: 0, Legs_Left: 0, Legs_Right: 0 });
	const WEIGHT_LERP = 8;

	$effect(() => {
		if (!$actions?.['Legs_Idle']) return;
		for (const name of ['Legs_Idle', 'Legs_Forward', 'Legs_Left', 'Legs_Right'] as LegsAnim[]) {
			const a = $actions[name];
			if (!a) continue;
			a.reset().play();
			a.setEffectiveWeight(name === 'Legs_Idle' ? 1 : 0);
		}
	});

	useTask((dt) => {
		if (!mixer) return;

		let targetRotation = 0;
		const left = input.left ? 1 : 0;
		const right = input.right ? 1 : 0;
		const isBackwards = input.back;
		const isForwards = input.forward;
		const isPureStrafe = (left || right) && !isForwards && !isBackwards;

		if (left && !right) {
			targetRotation = isBackwards ? -1.2 : isPureStrafe ? 0.5 : 0.15;
		} else if (right && !left) {
			targetRotation = isBackwards ? 1.2 : isPureStrafe ? -0.5 : -0.15;
		}

		const rotDiff = targetRotation - legsRotation;
		legsRotation += rotDiff * Math.min(1, dt * 12);

		const moveIntensity = Math.min(speed / 4, 1);
		const rgtNorm = left ? -1 : right ? 1 : 0;

		const wIdle = 1 - moveIntensity;
		const wFwd = (1 - Math.abs(rgtNorm)) * moveIntensity;
		const wFwdLeft = Math.max(0, -rgtNorm) * moveIntensity;
		const wFwdRight = Math.max(0, rgtNorm) * moveIntensity;

		const lerpFactor = Math.min(1, dt * WEIGHT_LERP);
		const idleLerpFactor = lerpFactor * 0.5;
		currentWeights.Legs_Idle += (wIdle - currentWeights.Legs_Idle) * idleLerpFactor;
		currentWeights.Legs_Forward += (wFwd - currentWeights.Legs_Forward) * lerpFactor;
		currentWeights.Legs_Left += (wFwdLeft - currentWeights.Legs_Left) * lerpFactor;
		currentWeights.Legs_Right += (wFwdRight - currentWeights.Legs_Right) * lerpFactor;

		$actions['Legs_Idle']?.setEffectiveWeight(currentWeights.Legs_Idle);
		$actions['Legs_Forward']?.setEffectiveWeight(currentWeights.Legs_Forward);
		$actions['Legs_Left']?.setEffectiveWeight(currentWeights.Legs_Left);
		$actions['Legs_Right']?.setEffectiveWeight(currentWeights.Legs_Right);

		mixer.timeScale = 0.4;
		mixer.update(dt);
	});
</script>

<GLTF
	bind:gltf={$gltf}
	url="{base}models/player/GunnerLegs.glb"
	position={[0, 0, 0]}
	rotation={[0, Math.PI + legsRotation, 0]}
	scale={0.07}
/>
