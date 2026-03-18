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

		if (!isMoving) {
			$actions['Legs_Idle']?.setEffectiveWeight(1);
			$actions['Legs_Forward']?.setEffectiveWeight(0);
			$actions['Legs_Left']?.setEffectiveWeight(0);
			$actions['Legs_Right']?.setEffectiveWeight(0);
		} else if (l && !r) {
			$actions['Legs_Idle']?.setEffectiveWeight(0);
			$actions['Legs_Forward']?.setEffectiveWeight(0);
			$actions['Legs_Left']?.setEffectiveWeight(1);
			$actions['Legs_Right']?.setEffectiveWeight(0);
		} else if (r && !l) {
			$actions['Legs_Idle']?.setEffectiveWeight(0);
			$actions['Legs_Forward']?.setEffectiveWeight(0);
			$actions['Legs_Left']?.setEffectiveWeight(0);
			$actions['Legs_Right']?.setEffectiveWeight(1);
		} else {
			$actions['Legs_Idle']?.setEffectiveWeight(0);
			$actions['Legs_Forward']?.setEffectiveWeight(1);
			$actions['Legs_Left']?.setEffectiveWeight(0);
			$actions['Legs_Right']?.setEffectiveWeight(0);
		}

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
