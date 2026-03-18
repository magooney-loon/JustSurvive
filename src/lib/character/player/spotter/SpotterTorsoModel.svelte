<script lang="ts">
	import { useTask } from '@threlte/core';
	import { GLTF, useGltfAnimations } from '@threlte/extras';

	type TorsoAnim =
		| 'Torso_Idle'
		| 'Torso_Running'
		| 'Torso_Shooting'
		| 'Torso_Shooting2'
		| 'Torso_Ability';

	type Props = {
		speed: number;
		isShooting: number;
		isUsingAbility: number;
		back?: boolean;
		left?: boolean;
		right?: boolean;
	};
	let {
		speed,
		isShooting,
		isUsingAbility,
		back = false,
		left = false,
		right = false
	}: Props = $props();

	const base = import.meta.env.BASE_URL;
	const { gltf, actions, mixer } = useGltfAnimations<TorsoAnim>();

	let torsoRotation = $state(0);
	let currentWeights = $state({
		Torso_Idle: 1,
		Torso_Running: 0,
		Torso_Shooting: 0,
		Torso_Shooting2: 0,
		Torso_Ability: 0
	});
	const WEIGHT_LERP = 15;

	$effect(() => {
		if (!$actions?.['Torso_Idle']) return;
		for (const name of [
			'Torso_Idle',
			'Torso_Running',
			'Torso_Shooting',
			'Torso_Shooting2',
			'Torso_Ability'
		] as TorsoAnim[]) {
			const a = $actions[name];
			if (!a) continue;
			a.reset().play();
			a.setEffectiveWeight(0);
			a.timeScale = 0.42;
		}
		$actions['Torso_Idle']?.setEffectiveWeight(1);
	});

	useTask((dt) => {
		if (!mixer) return;

		let targetRotation = 0;
		const l = left ? 1 : 0;
		const r = right ? 1 : 0;
		const isBackwards = back;

		if (l && !r) {
			targetRotation = isBackwards ? -0.8 : 0.3;
		} else if (r && !l) {
			targetRotation = isBackwards ? 0.8 : -0.3;
		}

		const rotDiff = targetRotation - torsoRotation;
		torsoRotation += rotDiff * Math.min(1, dt * 12);

		const isMoving = speed > 0.5;
		const shooting = isShooting > 0.5;
		const ability = isUsingAbility > 0.5;

		let targetAnim: TorsoAnim;
		if (shooting) {
			targetAnim = isMoving ? 'Torso_Shooting' : 'Torso_Shooting2';
		} else if (ability) {
			targetAnim = 'Torso_Ability';
		} else if (isMoving) {
			targetAnim = 'Torso_Running';
		} else {
			targetAnim = 'Torso_Idle';
		}

		const lerpFactor = Math.min(1, dt * WEIGHT_LERP);
		for (const name of [
			'Torso_Idle',
			'Torso_Running',
			'Torso_Shooting',
			'Torso_Shooting2',
			'Torso_Ability'
		] as TorsoAnim[]) {
			const targetWeight = name === targetAnim ? 1 : 0;
			currentWeights[name as TorsoAnim] +=
				(targetWeight - currentWeights[name as TorsoAnim]) * lerpFactor;
			$actions[name]?.setEffectiveWeight(currentWeights[name as TorsoAnim]);
		}

		mixer.update(dt);
	});
</script>

<GLTF
	bind:gltf={$gltf}
	url="{base}models/player/SpotterTorso.glb"
	position={[0, 0, 0]}
	rotation={[0, Math.PI, 0]}
	scale={0.07}
/>
