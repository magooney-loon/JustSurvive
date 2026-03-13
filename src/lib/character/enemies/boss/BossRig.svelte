<script lang="ts">
	import { useTask } from '@threlte/core';
	import { GLTF, useGltfAnimations } from '@threlte/extras';
	import * as THREE from 'three';
	import { localPos, bossShake } from '$lib/stores/movement.svelte.js';

	type BossAction =
		| 'zbs_phobos.qc_skeleton|zbs_idle1'
		| 'zbs_phobos.qc_skeleton|zbs_run'
		| 'zbs_phobos.qc_skeleton|zbs_walk'
		| 'zbs_phobos.qc_skeleton|zbs_attack_justiceSwing'
		| 'zbs_phobos.qc_skeleton|zbs_attack_mahadash'
		| 'zbs_phobos.qc_skeleton|gutshot';

	type Props = {
		speed: number;
		attackPhase?: number;
		isDead?: boolean;
		isDazed?: boolean;
		bossX?: number;
		bossZ?: number;
	};

	let {
		speed,
		attackPhase = 0,
		isDead = false,
		isDazed = false,
		bossX = 0,
		bossZ = 0
	}: Props = $props();

	const SHAKE_MAX_DIST = 28;
	const SHAKE_FREQ = Math.PI * 1.4;
	const SHAKE_AMPLITUDE = 0.14;

	const { gltf, actions, mixer } = useGltfAnimations<BossAction>();

	let currentAction: BossAction | null = null;
	let shakeTimer = 0;

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

	$effect(() => {
		for (const key of ['zbs_phobos.qc_skeleton|gutshot'] as BossAction[]) {
			const action = $actions[key];
			if (!action) continue;
			action.setLoop(THREE.LoopOnce, 1);
			action.clampWhenFinished = true;
		}
		for (const key of ['zbs_phobos.qc_skeleton|zbs_attack_mahadash'] as BossAction[]) {
			const action = $actions[key];
			if (!action) continue;
			action.setLoop(THREE.LoopOnce, 1);
			action.clampWhenFinished = true;
		}
		for (const key of ['zbs_phobos.qc_skeleton|zbs_run'] as BossAction[]) {
			const action = $actions[key];
			if (!action) continue;
			action.setLoop(THREE.LoopPingPong, Infinity);
		}
	});

	$effect(() => {
		if (!currentAction && $actions?.['zbs_phobos.qc_skeleton|zbs_idle1']) {
			$actions['zbs_phobos.qc_skeleton|zbs_idle1'].play();
			currentAction = 'zbs_phobos.qc_skeleton|zbs_idle1';
		}
	});

	$effect(() => {
		const next: BossAction = isDead
			? 'zbs_phobos.qc_skeleton|gutshot'
			: isDazed
				? 'zbs_phobos.qc_skeleton|zbs_attack_mahadash'
				: attackPhase > 0.3
					? 'zbs_phobos.qc_skeleton|zbs_attack_justiceSwing'
					: speed < 0.1
						? 'zbs_phobos.qc_skeleton|zbs_idle1'
						: 'zbs_phobos.qc_skeleton|zbs_run';

		if (currentAction === next) return;

		const current = currentAction ? $actions[currentAction] : null;
		const nextAction = $actions[next];
		if (!nextAction) return;

		nextAction.enabled = true;
		if (
			next === 'zbs_phobos.qc_skeleton|gutshot' ||
			next === 'zbs_phobos.qc_skeleton|zbs_attack_mahadash'
		) {
			nextAction.reset();
		}
		if (current) current.crossFadeTo(nextAction, 0.25, true);
		nextAction.play();
		currentAction = next;
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
