<script lang="ts">
	import { useTask } from '@threlte/core';
	import { GLTF, useGltfAnimations, PositionalAudio } from '@threlte/extras';
	import * as THREE from 'three';
	import { localPos, bossShake } from '$lib/stores/movement.svelte.js';
	import { settingsState } from '$root/settings.svelte.js';
	import { soundActions } from '$root/Sound.svelte';

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
	let footstepTimer = 0;
	let hasPlayedIntro = false;

	let footstepAudio: THREE.PositionalAudio | undefined = $state(undefined);
	let attackAudio: THREE.PositionalAudio | undefined = $state(undefined);
	let deadAudio: THREE.PositionalAudio | undefined = $state(undefined);
	let dazeAudio: THREE.PositionalAudio | undefined = $state(undefined);

	const playFootstep = () => {
		if (!footstepAudio || !settingsState.audio.effectsEnabled) return;
		if (footstepAudio.isPlaying) footstepAudio.stop();
		footstepAudio.play();
	};

	const playAttack = () => {
		if (!attackAudio || !settingsState.audio.effectsEnabled) return;
		if (attackAudio.isPlaying) attackAudio.stop();
		attackAudio.play();
	};

	const playDead = () => {
		if (!deadAudio || !settingsState.audio.effectsEnabled) return;
		if (deadAudio.isPlaying) deadAudio.stop();
		deadAudio.play();
	};

	const playDaze = () => {
		if (!dazeAudio || !settingsState.audio.effectsEnabled) return;
		if (dazeAudio.isPlaying) dazeAudio.stop();
		dazeAudio.play();
	};

	useTask((dt) => {
		if (mixer) {
			mixer.update(dt);
		}

		const isWalking = !isDead && speed > 0.05;
		if (isWalking) {
			shakeTimer += dt;
			footstepTimer += dt;
			if (footstepTimer > 0.5) {
				footstepTimer = 0;
				playFootstep();
			}
			const dx = bossX - localPos.x;
			const dz = bossZ - localPos.z;
			const dist = Math.sqrt(dx * dx + dz * dz);
			const proximity = Math.max(0, 1 - dist / SHAKE_MAX_DIST);
			bossShake.intensity =
				Math.abs(Math.sin(shakeTimer * SHAKE_FREQ)) * proximity * SHAKE_AMPLITUDE;
		} else {
			bossShake.intensity = Math.max(0, bossShake.intensity - dt * 3);
			footstepTimer = 0;
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

	// Play boss intro when GLTF loads
	$effect(() => {
		if ($gltf && !hasPlayedIntro) {
			hasPlayedIntro = true;
			soundActions.playBossIntro();
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

		// Trigger sounds on animation change
		if (next === 'zbs_phobos.qc_skeleton|gutshot') {
			playDead();
		} else if (next === 'zbs_phobos.qc_skeleton|zbs_attack_mahadash') {
			playDaze();
		} else if (next === 'zbs_phobos.qc_skeleton|zbs_attack_justiceSwing') {
			playAttack();
		}

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

<PositionalAudio
	src="{import.meta.env.BASE_URL}sounds/boss_footstep.mp3"
	loop
	refDistance={3}
	maxDistance={20}
	rolloffFactor={1.5}
	oncreate={(a) => {
		footstepAudio = a;
	}}
/>
<PositionalAudio
	src="{import.meta.env.BASE_URL}sounds/boss_attack.mp3"
	refDistance={5}
	maxDistance={25}
	rolloffFactor={1.5}
	oncreate={(a) => {
		attackAudio = a;
	}}
/>
<PositionalAudio
	src="{import.meta.env.BASE_URL}sounds/boss_dead.mp3"
	refDistance={8}
	maxDistance={30}
	rolloffFactor={1.5}
	oncreate={(a) => {
		deadAudio = a;
	}}
/>
<PositionalAudio
	src="{import.meta.env.BASE_URL}sounds/boss_daze.mp3"
	refDistance={5}
	maxDistance={25}
	rolloffFactor={1.5}
	oncreate={(a) => {
		dazeAudio = a;
	}}
/>

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
