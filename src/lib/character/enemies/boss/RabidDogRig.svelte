<script lang="ts">
	import { useTask } from '@threlte/core';
	import { GLTF, useGltfAnimations, PositionalAudio } from '@threlte/extras';
	import * as THREE from 'three';
	import { localPos, bossShake } from '$lib/stores/movement.svelte.js';
	import { settingsState } from '$root/settings.svelte.js';
	import { soundActions } from '$root/Sound.svelte';

	type DogAction = 'Attack 1' | 'Attack 2' | 'Idle 1' | 'Idle 2' | 'Leap' | 'Run' | 'Vocal' | 'Walk';

	type Props = {
		speed: number;
		attackPhase?: number;
		isDead?: boolean;
		isDazed?: boolean;
		bossX?: number;
		bossZ?: number;
		leapCooldownMs?: number; // ms timestamp of last leap cooldown end — changes trigger leap anim
	};

	let {
		speed,
		attackPhase = 0,
		isDead = false,
		isDazed = false,
		bossX = 0,
		bossZ = 0,
		leapCooldownMs = 0
	}: Props = $props();

	const SHAKE_MAX_DIST = 20;
	const SHAKE_FREQ = Math.PI * 2.2;
	const SHAKE_AMPLITUDE = 0.18;

	const { gltf, actions, mixer } = useGltfAnimations<DogAction>();

	let currentAction: DogAction = 'Idle 1';
	let shakeTimer = 0;
	let footstepTimer = 0;
	let attackIndex = 0;
	let hasPlayedIntro = false;

	// Leap detection: track previous cooldown value, play Leap anim for 0.85s when it changes
	let prevLeapCooldownMs = $state(0);
	let isLeaping = $state(false);
	let leapTimer = $state(0);

	const attackAnimations: DogAction[] = ['Attack 1', 'Attack 2'];
	const onceAnimations: DogAction[] = ['Vocal', 'Leap', ...attackAnimations];

	let footstepAudio = $state.raw<THREE.PositionalAudio | undefined>(undefined);
	let attackAudio = $state.raw<THREE.PositionalAudio | undefined>(undefined);
	let deadAudio = $state.raw<THREE.PositionalAudio | undefined>(undefined);

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

	useTask((dt) => {
		if (mixer) mixer.update(dt);

		// Leap timer
		if (isLeaping) {
			leapTimer += dt;
			if (leapTimer > 0.85) isLeaping = false;
		}

		const isWalking = !isDead && !isDazed && speed > 0.05;
		if (isWalking) {
			shakeTimer += dt;
			footstepTimer += dt;
			if (footstepTimer > 0.3) {
				footstepTimer = 0;
				playFootstep();
			}
			const dx = bossX - localPos.x;
			const dz = bossZ - localPos.z;
			const dist = Math.sqrt(dx * dx + dz * dz);
			const proximity = Math.max(0, 1 - dist / SHAKE_MAX_DIST);
			bossShake.intensity = Math.sin(shakeTimer * SHAKE_FREQ) * proximity * SHAKE_AMPLITUDE;
		} else {
			bossShake.intensity = Math.max(0, bossShake.intensity - dt * 3);
			footstepTimer = 0;
		}
	});

	// Detect leap ability trigger (cooldown timestamp changes when leap fires)
	$effect(() => {
		if (leapCooldownMs > 0 && leapCooldownMs !== prevLeapCooldownMs) {
			prevLeapCooldownMs = leapCooldownMs;
			isLeaping = true;
			leapTimer = 0;
		}
	});

	$effect(() => {
		if ($gltf && !hasPlayedIntro) {
			hasPlayedIntro = true;
			soundActions.playBossIntro();
		}
	});

	$effect(() => {
		for (const key of onceAnimations as DogAction[]) {
			const action = $actions[key];
			if (!action) continue;
			action.setLoop(THREE.LoopOnce, 1);
			action.clampWhenFinished = true;
		}
	});

	$effect(() => {
		if (!mixer) return;
		const onFinished = (e: THREE.Event & { action: THREE.AnimationAction }) => {
			const name = e.action.getClip().name as DogAction;
			if (name === 'Leap' || attackAnimations.includes(name)) {
				if (attackAnimations.includes(name)) {
					attackIndex = (attackIndex + 1) % attackAnimations.length;
				}
				const idle = $actions['Idle 1'];
				if (idle) { idle.enabled = true; idle.play(); currentAction = 'Idle 1'; }
			}
		};
		mixer.addEventListener('finished', onFinished as (e: THREE.Event) => void);
		return () => mixer.removeEventListener('finished', onFinished as (e: THREE.Event) => void);
	});

	$effect(() => {
		if (!$actions?.['Idle 1']) return;
		$actions['Idle 1'].play();
	});

	$effect(() => {
		const currentAttack = attackAnimations[attackIndex];
		const next: DogAction = isDead
			? 'Vocal'
			: isDazed
				? 'Idle 2'
				: isLeaping
					? 'Leap'
					: attackPhase > 0.3
						? currentAttack
						: speed > 0.1
							? 'Run'
							: 'Idle 1';

		const current = $actions[currentAction];
		const nextAction = $actions[next];
		if (!nextAction || current === nextAction) return;

		nextAction.enabled = true;
		if (onceAnimations.includes(next)) nextAction.reset();
		if (current) current.crossFadeTo(nextAction, 0.2, true);
		nextAction.play();
		currentAction = next;

		if (next === 'Vocal') playDead();
		else if (attackAnimations.includes(next)) playAttack();
	});
</script>

<PositionalAudio
	src="{import.meta.env.BASE_URL}sounds/boss_footstep.mp3"
	refDistance={2} maxDistance={18} rolloffFactor={1.5}
	oncreate={(a) => { footstepAudio = a; }}
/>
<PositionalAudio
	src="{import.meta.env.BASE_URL}sounds/boss_attack.mp3"
	refDistance={4} maxDistance={22} rolloffFactor={1.5}
	oncreate={(a) => { attackAudio = a; }}
/>
<PositionalAudio
	src="{import.meta.env.BASE_URL}sounds/boss_dead.mp3"
	refDistance={6} maxDistance={28} rolloffFactor={1.5}
	oncreate={(a) => { deadAudio = a; }}
/>

<GLTF
	bind:gltf={$gltf}
	url="{import.meta.env.BASE_URL}models/enemies/boss/rabid_dog/scene.gltf"
	rotation.y={Math.PI}
	scale={2.2}
/>
