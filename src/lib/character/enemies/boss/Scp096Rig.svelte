<script lang="ts">
	import { T, useTask } from '@threlte/core';
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
		slamCooldownMs?: number;
		chargeCooldownMs?: number;
	};

	let {
		speed,
		attackPhase = 0,
		isDead = false,
		isDazed = false,
		isEnraged = false,
		bossX = 0,
		bossZ = 0,
		slamCooldownMs = 0,
		chargeCooldownMs = 0
	}: Props = $props();

	const SHAKE_MAX_DIST = 25;
	const SHAKE_FREQ = Math.PI * 1.8;
	const SHAKE_AMPLITUDE = 0.22;

	const { gltf, actions, mixer } = useGltfAnimations<Scp096Action>();

	let currentAction: Scp096Action = 'Sit';
	let shakeTimer = 0;
	let footstepTimer = 0;
	let hasPlayedIntro = false;
	let slamFlashT = $state(0);
	let chargeFlashT = $state(0);
	let prevSlamCooldownMs = $state(0);
	let prevChargeCooldownMs = $state(0);

	const onceAnimations: Scp096Action[] = [
		'Attack',
		'Panik',
		'Sit Down',
		'Sit Up',
		'Sit Transition'
	];

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

		slamFlashT = Math.max(0, slamFlashT - dt / 1.1);
		chargeFlashT = Math.max(0, chargeFlashT - dt / 0.55);

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
		if (slamCooldownMs > 0 && slamCooldownMs !== prevSlamCooldownMs) {
			prevSlamCooldownMs = slamCooldownMs;
			slamFlashT = 1;
		}
	});
	$effect(() => {
		if (chargeCooldownMs > 0 && chargeCooldownMs !== prevChargeCooldownMs) {
			prevChargeCooldownMs = chargeCooldownMs;
			chargeFlashT = 1;
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
				if (idle) {
					idle.enabled = true;
					idle.play();
					currentAction = isEnraged ? 'Idle' : 'Sit';
				}
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
	refDistance={3}
	maxDistance={22}
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
	url="{import.meta.env.BASE_URL}models/enemies/boss/scp_096/scene.gltf"
	rotation.y={Math.PI}
	position.y={1.4}
	scale={3.5}
/>

<!-- AoE Slam VFX: massive white shockwave + cracks -->
{#if slamFlashT > 0}
    {#each Array.from({ length: 8 }, (_, i) => ({ angle: (i / 8) * Math.PI * 2, px: Math.sin((i / 8) * Math.PI * 2) * 7 * (1 - slamFlashT), pz: Math.cos((i / 8) * Math.PI * 2) * 7 * (1 - slamFlashT) })) as s}
        <T.Mesh position={[s.px, 0.04, s.pz]} rotation={[-Math.PI / 2, 0, s.angle]}>
            <T.BoxGeometry args={[0.1, 15, 0.01]} />
            <T.MeshBasicMaterial color="#ffffff" transparent opacity={slamFlashT * 0.75} blending={THREE.AdditiveBlending} depthWrite={false} />
        </T.Mesh>
    {/each}
    <T.Mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={Math.max(0.1, (1 - slamFlashT) * 15)}>
        <T.RingGeometry args={[0.88, 1, 32]} />
        <T.MeshBasicMaterial color="#ffffff" transparent opacity={slamFlashT * 0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
    </T.Mesh>
    <T.Mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={Math.max(0.1, (1 - slamFlashT) * 10)}>
        <T.RingGeometry args={[0.82, 1, 32]} />
        <T.MeshBasicMaterial color="#aaddff" transparent opacity={slamFlashT * 0.7} blending={THREE.AdditiveBlending} depthWrite={false} />
    </T.Mesh>
    <T.Mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={0.8 + (1 - slamFlashT) * 3}>
        <T.CircleGeometry args={[1, 24]} />
        <T.MeshBasicMaterial color="#ffffff" transparent opacity={slamFlashT * 0.4} blending={THREE.AdditiveBlending} depthWrite={false} />
    </T.Mesh>
    <T.Mesh position={[0, 1.0, 0]} scale={0.5 + (1 - slamFlashT) * 1.0}>
        <T.SphereGeometry args={[1, 8, 6]} />
        <T.MeshBasicMaterial color="#ffffff" transparent opacity={slamFlashT * 0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
    </T.Mesh>
{/if}

<!-- Charge VFX: blue-white speed streak -->
{#if chargeFlashT > 0}
    {#each Array.from({ length: 5 }, (_, i) => ({ angle: (i / 5) * Math.PI * 2, idx: i })) as s}
        <T.Mesh position={[0, 0.9 + s.idx * 0.15, 0]} rotation={[0, s.angle, 0]}>
            <T.BoxGeometry args={[0.06, 0.06, 3.5]} />
            <T.MeshBasicMaterial color="#88ccff" transparent opacity={chargeFlashT * 0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
        </T.Mesh>
    {/each}
    <T.Mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={Math.max(0.1, (1 - chargeFlashT) * 5)}>
        <T.RingGeometry args={[0.8, 1, 24]} />
        <T.MeshBasicMaterial color="#4488ff" transparent opacity={chargeFlashT * 0.75} blending={THREE.AdditiveBlending} depthWrite={false} />
    </T.Mesh>
    <T.Mesh position={[0, 1.0, 0]} scale={0.2 + (1 - chargeFlashT) * 0.4}>
        <T.SphereGeometry args={[1, 8, 6]} />
        <T.MeshBasicMaterial color="#aaddff" transparent opacity={chargeFlashT * 0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
    </T.Mesh>
{/if}
