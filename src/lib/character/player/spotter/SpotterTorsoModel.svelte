<script lang="ts">
	import { useTask } from '@threlte/core';
	import { GLTF, useGltfAnimations } from '@threlte/extras';
	import { input } from '$lib/stores/movement.svelte.js';

	type TorsoAnim = 'TorsoIdle' | 'TorsoForward' | 'Shooting' | 'ShootingIdle';

	type Props = {
		speed: number;
		isShooting: number;
	};
	let { speed, isShooting }: Props = $props();

	const base = import.meta.env.BASE_URL;
	const { gltf, actions, mixer } = useGltfAnimations<TorsoAnim>();

	let torsoRotation = $state(0);
	let currentWeights = $state({ TorsoIdle: 1, TorsoForward: 0, Shooting: 0, ShootingIdle: 0 });
	const WEIGHT_LERP = 8;

	$effect(() => {
		if (!$actions?.['TorsoIdle']) return;
		for (const name of ['TorsoIdle', 'TorsoForward', 'Shooting', 'ShootingIdle'] as TorsoAnim[]) {
			const a = $actions[name];
			if (!a) continue;
			a.reset().play();
			a.setEffectiveWeight(name === 'TorsoIdle' ? 1 : 0);
		}
	});

	useTask((dt) => {
		if (!mixer) return;

		let targetRotation = 0;
		const left = input.left ? 1 : 0;
		const right = input.right ? 1 : 0;
		const isBackwards = input.back;

		if (left && !right) {
			targetRotation = isBackwards ? -0.8 : 0.3;
		} else if (right && !left) {
			targetRotation = isBackwards ? 0.8 : -0.3;
		}

		const rotDiff = targetRotation - torsoRotation;
		torsoRotation += rotDiff * Math.min(1, dt * 12);

		const isMoving = speed > 0.5;
		const shootWeight = isShooting > 0.5 ? 1 : 0;
		const moveWeight = isMoving ? 1 : 0;

		const lerpFactor = Math.min(1, dt * WEIGHT_LERP);
		const idleLerpFactor = lerpFactor * 0.5;

		const wShooting = shootWeight * moveWeight;
		const wShootingIdle = shootWeight * (1 - moveWeight);
		const wTorsoForward = (1 - shootWeight) * moveWeight;
		const wTorsoIdle = (1 - shootWeight) * (1 - moveWeight);

		currentWeights.Shooting += (wShooting - currentWeights.Shooting) * lerpFactor;
		currentWeights.ShootingIdle += (wShootingIdle - currentWeights.ShootingIdle) * idleLerpFactor;
		currentWeights.TorsoForward += (wTorsoForward - currentWeights.TorsoForward) * lerpFactor;
		currentWeights.TorsoIdle += (wTorsoIdle - currentWeights.TorsoIdle) * idleLerpFactor;

		$actions['Shooting']?.setEffectiveWeight(currentWeights.Shooting);
		$actions['ShootingIdle']?.setEffectiveWeight(currentWeights.ShootingIdle);
		$actions['TorsoForward']?.setEffectiveWeight(currentWeights.TorsoForward);
		$actions['TorsoIdle']?.setEffectiveWeight(currentWeights.TorsoIdle);

		mixer.timeScale = 0.4;
		mixer.update(dt);
	});
</script>

<GLTF
	bind:gltf={$gltf}
	url="{base}models/player/SpotterTorso.glb"
	position={[0, 0, 0]}
	rotation={[0, Math.PI, 0]}
	scale={[-0.07, 0.07, 0.07]}
/>
