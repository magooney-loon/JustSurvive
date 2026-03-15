<script lang="ts">
	import { T, useTask } from '@threlte/core';
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
		isEnraged?: boolean;
		bossX?: number;
		bossZ?: number;
		leapCooldownMs?: number; // ms timestamp of last leap cooldown end — changes trigger leap anim
		stunCooldownMs?: number;
	};

	let {
		speed,
		attackPhase = 0,
		isDead = false,
		isDazed = false,
		isEnraged = false,
		bossX = 0,
		bossZ = 0,
		leapCooldownMs = 0,
		stunCooldownMs = 0
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
	let leapFlashT = $state(0);
	let stunFlashT = $state(0);
	let prevStunCooldownMs = $state(0);

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

		leapFlashT = Math.max(0, leapFlashT - dt / 0.6);
		stunFlashT = Math.max(0, stunFlashT - dt / 0.85);

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
			leapFlashT = 1;
		}
	});

	$effect(() => {
		if (stunCooldownMs > 0 && stunCooldownMs !== prevStunCooldownMs) {
			prevStunCooldownMs = stunCooldownMs;
			stunFlashT = 1;
		}
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
			}
		});
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

<!-- Leap VFX: red teleport flash -->
{#if leapFlashT > 0}
    <T.Mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={Math.max(0.1, (1 - leapFlashT) * 4)}>
        <T.RingGeometry args={[0.82, 1, 24]} />
        <T.MeshBasicMaterial color="#ff2200" transparent opacity={leapFlashT * 0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
    </T.Mesh>
    <T.Mesh position={[0, 0.8, 0]} scale={0.2 + (1 - leapFlashT) * 0.5}>
        <T.SphereGeometry args={[1, 8, 6]} />
        <T.MeshBasicMaterial color="#ff4400" transparent opacity={leapFlashT * 0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
    </T.Mesh>
    {#each Array.from({ length: 6 }, (_, i) => ({ angle: (i / 6) * Math.PI * 2 })) as s}
        <T.Mesh position={[0, 0.8, 0]} rotation={[0, s.angle, 0]}>
            <T.BoxGeometry args={[0.05, 0.05, 2.5 * (1 - leapFlashT)]} />
            <T.MeshBasicMaterial color="#ff3300" transparent opacity={leapFlashT * 0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
        </T.Mesh>
    {/each}
{/if}

<!-- Stun Attack VFX: purple slam ring -->
{#if stunFlashT > 0}
    <T.Mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={Math.max(0.1, (1 - stunFlashT) * 6)}>
        <T.RingGeometry args={[0.85, 1, 28]} />
        <T.MeshBasicMaterial color="#aa00ff" transparent opacity={stunFlashT * 0.85} blending={THREE.AdditiveBlending} depthWrite={false} />
    </T.Mesh>
    <T.Mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={Math.max(0.1, (1 - stunFlashT) * 3.5)}>
        <T.RingGeometry args={[0.8, 1, 28]} />
        <T.MeshBasicMaterial color="#cc44ff" transparent opacity={stunFlashT * 0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
    </T.Mesh>
    {#each Array.from({ length: 5 }, (_, i) => ({ angle: (i / 5) * Math.PI * 2 })) as s}
        <T.Mesh position={[Math.sin(s.angle) * 1.5 * (1 - stunFlashT), 0.9, Math.cos(s.angle) * 1.5 * (1 - stunFlashT)]} rotation={[0, s.angle, 0]}>
            <T.BoxGeometry args={[0.07, 0.07, 2.5]} />
            <T.MeshBasicMaterial color="#9900cc" transparent opacity={stunFlashT * 0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
        </T.Mesh>
    {/each}
    <T.Mesh position={[0, 0.8, 0]} scale={0.25 + (1 - stunFlashT) * 0.4}>
        <T.SphereGeometry args={[1, 8, 6]} />
        <T.MeshBasicMaterial color="#dd66ff" transparent opacity={stunFlashT * 0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
    </T.Mesh>
{/if}
