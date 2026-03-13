<script lang="ts">
	import { useTask } from '@threlte/core';
	import { GLTF, useGltfAnimations } from '@threlte/extras';
	import * as THREE from 'three';
	import { localPos, bossShake } from '$lib/stores/movement.svelte.js';

	type BossAction = 'zbs_walk' | 'zbs_attack_justiceSwing' | 'gutshot';

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

	const { gltf, actions } = useGltfAnimations<BossAction>();

	let currentAction: BossAction = 'zbs_walk';
	let shakeTimer = 0;

	// Configure one-shots and start walk as soon as actions are ready.
	// Reading $actions here means this effect re-runs when GLTF finishes loading.
	$effect(() => {
		const death = $actions['gutshot'];
		if (!death) return;
		death.setLoop(THREE.LoopOnce, 1);
		death.clampWhenFinished = true;

		const walk = $actions['zbs_walk'];
		if (!walk) return;
		walk.play();
	});

	// Transition between animations whenever isDead / attackPhase / actions change.
	// IMPORTANT: always read from $actions before any early-return so that this
	// effect tracks $actions as a dependency and re-runs when the GLTF loads.
	$effect(() => {
		const next: BossAction = isDead
			? 'gutshot'
			: attackPhase > 0.3
				? 'zbs_attack_justiceSwing'
				: 'zbs_walk';
		const from = $actions[currentAction];
		const to = $actions[next];
		if (!to || from === to) return;
		to.enabled = true;
		if (next === 'gutshot') to.reset();
		if (from) from.crossFadeTo(to, 0.25, true);
		to.play();
		currentAction = next;
	});

	useTask((dt) => {
		// Camera shake — boss footsteps felt through the ground
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
