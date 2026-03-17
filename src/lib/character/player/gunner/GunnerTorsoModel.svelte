<script lang="ts">
	import { useTask } from '@threlte/core';
	import { GLTF, useGltfAnimations } from '@threlte/extras';

	type TorsoAnim =
		| 'Torso_Shooting'
		| 'Torso_Shooting2'
		| 'Torso_Running'
		| 'Torso_Idle'
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
		Torso_Shooting: 0,
		Torso_Shooting2: 0,
		Torso_Running: 0,
		Torso_Idle: 1,
		Torso_Ability: 0
	});
	const WEIGHT_LERP = 8;

	$effect(() => {
		if (!$actions?.['Torso_Idle']) return;
		for (const name of [
			'Torso_Shooting',
			'Torso_Shooting2',
			'Torso_Running',
			'Torso_Idle',
			'Torso_Ability'
		] as TorsoAnim[]) {
			const a = $actions[name];
			if (!a) continue;
			a.reset().play();
			a.setEffectiveWeight(name === 'Torso_Idle' ? 1 : 0);
		}
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
		const shootWeight = isShooting > 0.5 ? 1 : 0;
		const abilityWeight = isUsingAbility > 0.5 ? 1 : 0;
		const moveWeight = isMoving ? 1 : 0;

		const lerpFactor = Math.min(1, dt * WEIGHT_LERP);
		const idleLerpFactor = lerpFactor * 0.5;

		const wShooting = shootWeight * moveWeight * (1 - abilityWeight);
		const wShootingIdle = shootWeight * (1 - moveWeight) * (1 - abilityWeight);
		const wAbility = abilityWeight;
		const wTorsoForward = (1 - shootWeight) * moveWeight * (1 - abilityWeight);
		const wTorsoIdle = (1 - shootWeight) * (1 - moveWeight) * (1 - abilityWeight);

		currentWeights.Torso_Shooting += (wShooting - currentWeights.Torso_Shooting) * lerpFactor;
		currentWeights.Torso_Shooting2 +=
			(wShootingIdle - currentWeights.Torso_Shooting2) * idleLerpFactor;
		currentWeights.Torso_Ability += (wAbility - currentWeights.Torso_Ability) * lerpFactor;
		currentWeights.Torso_Running += (wTorsoForward - currentWeights.Torso_Running) * lerpFactor;
		currentWeights.Torso_Idle += (wTorsoIdle - currentWeights.Torso_Idle) * idleLerpFactor;

		$actions['Torso_Shooting']?.setEffectiveWeight(currentWeights.Torso_Shooting);
		$actions['Torso_Shooting2']?.setEffectiveWeight(currentWeights.Torso_Shooting2);
		$actions['Torso_Ability']?.setEffectiveWeight(currentWeights.Torso_Ability);
		$actions['Torso_Running']?.setEffectiveWeight(currentWeights.Torso_Running);
		$actions['Torso_Idle']?.setEffectiveWeight(currentWeights.Torso_Idle);

		mixer.timeScale = 0.4;
		mixer.update(dt);
	});
</script>

<GLTF
	bind:gltf={$gltf}
	url="{base}models/player/GunnerTorso.glb"
	position={[0, 0, 0]}
	rotation={[0, Math.PI, 0]}
	scale={[-0.07, 0.07, 0.07]}
/>
