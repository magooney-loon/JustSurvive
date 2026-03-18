<script lang="ts">
	import { useTask } from '@threlte/core';
	import { GLTF, useGltfAnimations } from '@threlte/extras';

	type LegsAnim = 'Legs_Idle' | 'Legs_Forward' | 'Legs_Left' | 'Legs_Right';

	type Props = {
		speed: number;
		forward?: boolean;
		back?: boolean;
		left?: boolean;
		right?: boolean;
	};
	let { speed, forward = false, back = false, left = false, right = false }: Props = $props();

	const base = import.meta.env.BASE_URL;
	const { gltf, actions, mixer } = useGltfAnimations<LegsAnim>();

	let legsRotation = $state(0);
	let currentWeights = $state({ Legs_Idle: 1, Legs_Forward: 0, Legs_Left: 0, Legs_Right: 0 });
	const WEIGHT_LERP = 15;

	$effect(() => {
		if (!$actions?.['Legs_Idle']) return;
		for (const name of ['Legs_Idle', 'Legs_Forward', 'Legs_Left', 'Legs_Right'] as LegsAnim[]) {
			const a = $actions[name];
			if (!a) continue;
			a.reset().play();
			a.setEffectiveWeight(0);
			a.timeScale = 0.42;
		}
		$actions['Legs_Idle']?.setEffectiveWeight(1);
	});

	useTask((dt) => {
		if (!mixer) return;

		let targetRotation = 0;
		const l = left ? 1 : 0;
		const r = right ? 1 : 0;
		const isBackwards = back;
		const isForwards = forward;
		const isPureStrafe = (l || r) && !isForwards && !isBackwards;

		if (l && !r) {
			targetRotation = isBackwards ? -1.2 : isPureStrafe ? 0.5 : 0.15;
		} else if (r && !l) {
			targetRotation = isBackwards ? 1.2 : isPureStrafe ? -0.5 : -0.15;
		}

		const rotDiff = targetRotation - legsRotation;
		legsRotation += rotDiff * Math.min(1, dt * 12);

		const isMoving = speed > 0.5;

		let targetAnim: LegsAnim = 'Legs_Idle';
		if (isMoving) {
			if (l && !r) {
				targetAnim = 'Legs_Left';
			} else if (r && !l) {
				targetAnim = 'Legs_Right';
			} else {
				targetAnim = 'Legs_Forward';
			}
		}

		const lerpFactor = Math.min(1, dt * WEIGHT_LERP);
		for (const name of ['Legs_Idle', 'Legs_Forward', 'Legs_Left', 'Legs_Right'] as LegsAnim[]) {
			const targetWeight = name === targetAnim ? 1 : 0;
			currentWeights[name] += (targetWeight - currentWeights[name]) * lerpFactor;
			$actions[name]?.setEffectiveWeight(currentWeights[name]);
		}

		mixer.update(dt);
	});
</script>

<GLTF
	bind:gltf={$gltf}
	url="{base}models/player/SpotterLegs.glb"
	position={[0, 0, 0]}
	rotation={[0, Math.PI + legsRotation, 0]}
	scale={0.07}
/>
