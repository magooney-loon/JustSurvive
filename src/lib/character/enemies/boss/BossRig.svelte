<script module lang="ts">
	export type BossAction =
		| 'winidle'
		| 'travelmove'
		| 'attack_3'
		| 'cast_1'
		| 'attack_2'
		| 'attack_4'
		| 'stunidle'
		| 'dead';

	export const bossState = $state({ action: 'winidle' as BossAction, attackIndex: 0 });
</script>

<script lang="ts">
	import { useTask } from '@threlte/core';
	import { GLTF, useGltfAnimations, PositionalAudio } from '@threlte/extras';
	import * as THREE from 'three';
	import { localPos, bossShake } from '$lib/stores/movement.svelte.js';
	import { settingsState } from '$root/settings.svelte.js';
	import { soundActions } from '$root/Sound.svelte';

	type Props = {
		speed: number;
		attackPhase?: number;
		isDead?: boolean;
		isDazed?: boolean;
		isHidden?: boolean;
		isEnraged?: boolean;
		bossX?: number;
		bossZ?: number;
		iceBallCooldownMs?: number;
	};

	let {
		speed,
		attackPhase = 0,
		isDead = false,
		isDazed = false,
		isHidden = false,
		isEnraged = false,
		bossX = 0,
		bossZ = 0,
		iceBallCooldownMs = 0
	}: Props = $props();

	const SHAKE_MAX_DIST = 28;
	const SHAKE_FREQ = Math.PI * 1.4;
	const SHAKE_AMPLITUDE = 0.28;

	const { gltf, actions, mixer } = useGltfAnimations<BossAction>();

	let currentAction: BossAction = 'winidle';
	let shakeTimer = 0;
	let footstepTimer = 0;
	let hasPlayedIntro = false;
	let attackIndex = 0;

	// Ice ball detection — triggers cast_1 anim when ability2 cooldown timestamp changes
	let prevIceBallCooldownMs = $state(0);
	let isCasting = $state(false);
	let castTimer = $state(0);

	const attackAnimations: BossAction[] = ['attack_3', 'attack_2', 'attack_4'];

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
		if (mixer) {
			mixer.update(dt);
		}

		if (isCasting) {
			castTimer += dt;
			if (castTimer > 2.0) isCasting = false;
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
			bossShake.intensity = Math.sin(shakeTimer * SHAKE_FREQ) * proximity * SHAKE_AMPLITUDE;
		} else {
			bossShake.intensity = Math.max(0, bossShake.intensity - dt * 3);
			footstepTimer = 0;
		}
	});

	$effect(() => {
		for (const key of ['dead', 'stunidle', 'cast_1', ...attackAnimations] as BossAction[]) {
			const action = $actions[key];
			if (!action) continue;
			action.setLoop(THREE.LoopOnce, 1);
			action.clampWhenFinished = true;
		}
	});

	// Detect ice ball cast (ability2 cooldown timestamp changes)
	$effect(() => {
		if (iceBallCooldownMs > 0 && iceBallCooldownMs !== prevIceBallCooldownMs) {
			prevIceBallCooldownMs = iceBallCooldownMs;
			isCasting = true;
			castTimer = 0;
		}
	});

	$effect(() => {
		if (!mixer) return;
		const onFinished = (e: THREE.Event & { action: THREE.AnimationAction }) => {
			const name = e.action.getClip().name as BossAction;
			if (attackAnimations.includes(name)) {
				attackIndex = (attackIndex + 1) % attackAnimations.length;
			}
			if (name === 'dead' || name === 'stunidle' || name === 'cast_1' || attackAnimations.includes(name)) {
				bossState.action = 'winidle';
			}
		};
		mixer.addEventListener('finished', onFinished as (e: THREE.Event) => void);
		return () => mixer.removeEventListener('finished', onFinished as (e: THREE.Event) => void);
	});

	$effect(() => {
		if (!$actions?.['winidle']) return;
		$actions['winidle'].play();
	});

	$effect(() => {
		if ($gltf && !hasPlayedIntro) {
			hasPlayedIntro = true;
			soundActions.playBossIntro();
		}
	});

	$effect(() => {
		if (!$gltf) return;
		$gltf.scene.traverse((obj: any) => {
			if (!obj.isMesh) return;
			const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
			for (const mat of mats) {
				if ('emissive' in mat) {
					mat.emissive.set(isEnraged ? '#cc1100' : '#000000');
					mat.emissiveIntensity = isEnraged ? 0.6 : 0;
				}
				mat.transparent = isHidden;
				mat.opacity = isHidden ? 0.18 : 1;
				mat.depthWrite = !isHidden;
			}
		});
	});

	$effect(() => {
		const currentAttack = attackAnimations[attackIndex];
		const next: BossAction = isDead
			? 'dead'
			: isDazed
				? 'stunidle'
				: isCasting
					? 'cast_1'
					: attackPhase > 0.3
						? currentAttack
						: speed < 0.1
							? 'winidle'
							: 'travelmove';

		const current = $actions[currentAction];
		const nextAction = $actions[next];
		if (!nextAction || current === nextAction) return;

		nextAction.enabled = true;
		if (next === 'dead' || next === 'stunidle' || next === 'cast_1' || attackAnimations.includes(next))
			nextAction.reset();
		if (current) current.crossFadeTo(nextAction, 0.3, true);
		nextAction.play();
		currentAction = next;

		if (next === 'dead') playDead();
		else if (next === 'stunidle') playDaze();
		else if (next === 'cast_1') playAttack();
		else if (attackAnimations.includes(next)) playAttack();
	});
</script>

<PositionalAudio
	src="{import.meta.env.BASE_URL}sounds/boss_footstep.mp3"
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
	url="{import.meta.env.BASE_URL}models/enemies/boss/ghost_dragon/scene.gltf"
	rotation.y={Math.PI}
	scale={5.4}
/>
