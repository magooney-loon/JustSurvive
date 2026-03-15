<script lang="ts">
	import { useTask } from '@threlte/core';
	import { GLTF, useGltfAnimations, PositionalAudio } from '@threlte/extras';
	import * as THREE from 'three';
	import { localPos, bossShake } from '$lib/stores/movement.svelte.js';
	import { settingsState } from '$root/settings.svelte.js';
	import { soundActions } from '$root/Sound.svelte';

	// All animations confirmed from GLTF
	type Scp096Action =
		| 'Attack'
		| 'Idle'
		| 'Idle 2'
		| 'Idle 3'
		| 'Panik'
		| 'Run'
		| 'Sit'
		| 'Sit 2'
		| 'Sit Down'
		| 'Sit Transition'
		| 'Sit Up'
		| 'Walk';

	type Props = {
		speed: number;
		attackPhase?: number;
		isDead?: boolean;
		isDazed?: boolean;
		isEnraged?: boolean;
		bossX?: number;
		bossZ?: number;
	};

	let {
		speed,
		attackPhase = 0,
		isDead = false,
		isDazed = false,
		isEnraged = false,
		bossX = 0,
		bossZ = 0
	}: Props = $props();

	const SHAKE_MAX_DIST = 25;
	const SHAKE_FREQ = Math.PI * 1.8;
	const SHAKE_AMPLITUDE = 0.22;

	const { gltf, actions, mixer } = useGltfAnimations<Scp096Action>();

	let currentAction: Scp096Action = 'Sit';
	let shakeTimer = 0;
	let footstepTimer = 0;
	let hasPlayedIntro = false;

	const onceAnimations: Scp096Action[] = ['Attack', 'Panik', 'Sit Down', 'Sit Up', 'Sit Transition'];

	let footstepAudio = $state.raw<THREE.PositionalAudio | undefined>(undefined);
	let attackAudio = $state.raw<THREE.PositionalAudio | undefined>(undefined);
	let deadAudio = $state.raw<THREE.PositionalAudio | undefined>(undefined);
	let dazeAudio = $state.raw<THREE.PositionalAudio | undefined>(undefined);

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
		if (mixer) mixer.update(dt);

		const isWalking = !isDead && !isDazed && speed > 0.05;
		if (isWalking) {
			shakeTimer += dt;
			footstepTimer += dt;
			if (footstepTimer > 0.4) {
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

	$effect(() => {
		if ($gltf && !hasPlayedIntro) {
			hasPlayedIntro = true;
			soundActions.playBossIntro();
		}
	});

	$effect(() => {
		for (const key of onceAnimations as Scp096Action[]) {
			const action = $actions[key];
			if (!action) continue;
			action.setLoop(THREE.LoopOnce, 1);
			action.clampWhenFinished = true;
		}
	});

	$effect(() => {
		if (!mixer) return;
		const onFinished = (e: THREE.Event & { action: THREE.AnimationAction }) => {
			const name = e.action.getClip().name as Scp096Action;
			if (name === 'Attack' || name === 'Panik') {
				const idle = $actions[isEnraged ? 'Idle' : 'Sit'];
				if (idle) { idle.enabled = true; idle.play(); currentAction = isEnraged ? 'Idle' : 'Sit'; }
			}
		};
		mixer.addEventListener('finished', onFinished as (e: THREE.Event) => void);
		return () => mixer.removeEventListener('finished', onFinished as (e: THREE.Event) => void);
	});

	$effect(() => {
		// Start sitting (calm SCP-096 behavior before enrage)
		const startAnim: Scp096Action = isEnraged ? 'Idle' : 'Sit';
		if (!$actions?.[startAnim]) return;
		$actions[startAnim].play();
		currentAction = startAnim;
	});

	$effect(() => {
		const next: Scp096Action = isDead
			? 'Sit Down'
			: isDazed
				? 'Panik'
				: attackPhase > 0.3
					? 'Attack'
					: speed > 2
						? 'Run'
						: speed > 0.1
							? 'Walk'
							: isEnraged
								? 'Idle'
								: 'Sit';

		const current = $actions[currentAction];
		const nextAction = $actions[next];
		if (!nextAction || current === nextAction) return;

		nextAction.enabled = true;
		if (onceAnimations.includes(next)) nextAction.reset();
		if (current) current.crossFadeTo(nextAction, 0.3, true);
		nextAction.play();
		currentAction = next;

		if (next === 'Sit Down') playDead();
		else if (next === 'Panik') playDaze();
		else if (next === 'Attack') playAttack();
	});
</script>

<PositionalAudio
	src="{import.meta.env.BASE_URL}sounds/boss_footstep.mp3"
	refDistance={3} maxDistance={22} rolloffFactor={1.5}
	oncreate={(a) => { footstepAudio = a; }}
/>
<PositionalAudio
	src="{import.meta.env.BASE_URL}sounds/boss_attack.mp3"
	refDistance={5} maxDistance={25} rolloffFactor={1.5}
	oncreate={(a) => { attackAudio = a; }}
/>
<PositionalAudio
	src="{import.meta.env.BASE_URL}sounds/boss_dead.mp3"
	refDistance={8} maxDistance={30} rolloffFactor={1.5}
	oncreate={(a) => { deadAudio = a; }}
/>
<PositionalAudio
	src="{import.meta.env.BASE_URL}sounds/boss_daze.mp3"
	refDistance={5} maxDistance={25} rolloffFactor={1.5}
	oncreate={(a) => { dazeAudio = a; }}
/>

<GLTF
	bind:gltf={$gltf}
	url="{import.meta.env.BASE_URL}models/enemies/boss/scp_096/scene.gltf"
	rotation.y={Math.PI}
	scale={3.5}
/>
