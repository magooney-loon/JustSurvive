<script lang="ts">
	import { useTask } from '@threlte/core';
	import { GLTF, useGltfAnimations } from '@threlte/extras';
	import * as THREE from 'three';
	import { localPos, bossShake } from '$lib/stores/movement.svelte.js';

	type BossAction =
		| 'zbs_phobos.qc_skeleton|zbs_walk'
		| 'zbs_phobos.qc_skeleton|zbs_attack_justiceSwing'
		| 'zbs_phobos.qc_skeleton|gutshot';

	type Props = {
		speed: number;
		attackPhase?: number;
		isDead?: boolean;
		bossX?: number;
		bossZ?: number;
	};

	let { speed, attackPhase = 0, isDead = false, bossX = 0, bossZ = 0 }: Props = $props();

	const SHAKE_MAX_DIST = 28;
	const SHAKE_FREQ = Math.PI * 1.4;
	const SHAKE_AMPLITUDE = 0.14;

	const { gltf, actions, mixer } = useGltfAnimations<BossAction>();

	let currentAction: BossAction = 'zbs_phobos.qc_skeleton|zbs_walk';
	let shakeTimer = 0;

	$effect(() => {
		if (!$gltf) return;
		console.log('GLTF loaded');
		console.log('Actions:', $actions);
		console.log('Keys:', $actions ? Object.keys($actions) : 'none');
	});

	$effect(() => {
		for (const key of ['zbs_phobos.qc_skeleton|gutshot'] as BossAction[]) {
			const action = $actions[key];
			if (!action) continue;
			action.setLoop(THREE.LoopOnce, 1);
			action.clampWhenFinished = true;
		}
	});

	$effect(() => {
		if (!$actions?.['zbs_phobos.qc_skeleton|zbs_walk']) return;
		$actions['zbs_phobos.qc_skeleton|zbs_walk'].play();
	});

	$effect(() => {
		const next: BossAction = isDead
			? 'zbs_phobos.qc_skeleton|gutshot'
			: attackPhase > 0.3
				? 'zbs_phobos.qc_skeleton|zbs_attack_justiceSwing'
				: 'zbs_phobos.qc_skeleton|zbs_walk';

		const current = $actions[currentAction];
		const nextAction = $actions[next];
		if (!nextAction || current === nextAction) return;

		nextAction.enabled = true;
		if (next === 'zbs_phobos.qc_skeleton|gutshot') nextAction.reset();
		if (current) current.crossFadeTo(nextAction, 0.25, true);
		nextAction.play();
		currentAction = next;
	});

	useTask((dt) => {
		if (mixer) {
			mixer.update(dt);
		}

		const isWalking = !isDead && speed > 0.05;
		if (isWalking) {
			shakeTimer += dt;
			const dx = bossX - localPos.x;
			const dz = bossZ - localPos.z;
			const dist = Math.sqrt(dx * dx + dz * dz);
			const proximity = Math.max(0, 1 - dist / SHAKE_MAX_DIST);
			bossShake.intensity =
				Math.abs(Math.sin(shakeTimer * SHAKE_FREQ)) * proximity * SHAKE_AMPLITUDE;
		} else {
			bossShake.intensity = Math.max(0, bossShake.intensity - dt * 3);
		}
	});
</script>

<GLTF
	bind:gltf={$gltf}
	url="{import.meta.env.BASE_URL}models/enemies/boss/scene.gltf"
	rotation.y={Math.PI}
	oncreate={(scene) => {
		scene.traverse((child) => {
			child.castShadow = true;
		});
	}}
	scale={4.5}
/>
