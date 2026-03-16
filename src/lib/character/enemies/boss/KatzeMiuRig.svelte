<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { GLTF, useGltfAnimations, PositionalAudio } from '@threlte/extras';
	import * as THREE from 'three';
	import { localPos, bossShake } from '$lib/stores/movement.svelte.js';
	import { settingsState } from '$root/settings.svelte.js';
	import { soundActions } from '$root/Sound.svelte';

	type KatzeAction = 'idle' | 'AttackIdle' | 'Attack2' | 'Attack3' | 'walking';

	type Props = {
		speed: number;
		attackPhase?: number;
		isDead?: boolean;
		isDazed?: boolean;
		isEnraged?: boolean;
		isChanneling?: boolean;
		bossX?: number;
		bossZ?: number;
		uppercutCooldownMs?: number;
	};

	let {
		speed,
		attackPhase = 0,
		isDead = false,
		isDazed = false,
		isEnraged = false,
		isChanneling = false,
		bossX = 0,
		bossZ = 0,
		uppercutCooldownMs = 0
	}: Props = $props();

	const SHAKE_MAX_DIST = 20;
	const SHAKE_FREQ = Math.PI * 2.2;
	const SHAKE_AMPLITUDE = 0.18;

	const { gltf, actions, mixer } = useGltfAnimations<KatzeAction>();

	let currentAction: KatzeAction = 'idle';
	let shakeTimer = 0;
	let footstepTimer = 0;
	let hasPlayedIntro = false;
	let modelRotation = $state(0);

	let prevUppercutCooldownMs = $state(0);
	let isUppercutting = $state(false);
	let uppercutTimer = $state(0);
	let uppercutFlashT = $state(0);

	const attackAnimations: KatzeAction[] = ['Attack2', 'Attack3'];
	const onceAnimations: KatzeAction[] = ['Attack2', 'Attack3'];

	let footstepAudio = $state.raw<THREE.PositionalAudio | undefined>(undefined);
	let attackAudio = $state.raw<THREE.PositionalAudio | undefined>(undefined);

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

	useTask((dt) => {
		if (mixer) mixer.update(dt);

		// Spin rotation when channeling - full 360 spin then reset
		if (isChanneling) {
			modelRotation += dt * 6; // ~1 rotation per second
			// After full 360 (2*PI), reset to 0 so model faces original direction
			if (modelRotation >= Math.PI * 2) {
				modelRotation = 0;
			}
		} else {
			modelRotation = 0;
		}

		// Uppercut timer and VFX
		if (isUppercutting) {
			uppercutTimer += dt;
			uppercutFlashT = Math.max(0, 1 - uppercutTimer / 0.5);
			if (uppercutTimer > 0.5) {
				isUppercutting = false;
				uppercutFlashT = 0;
			}
		}

		const isWalking = !isDead && !isDazed && !isChanneling && speed > 0.05;
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

	// Detect uppercut ability trigger - when cooldown is newly set
	$effect(() => {
		if (uppercutCooldownMs > 0 && uppercutCooldownMs !== prevUppercutCooldownMs) {
			prevUppercutCooldownMs = uppercutCooldownMs;
			isUppercutting = true;
			uppercutTimer = 0;
			uppercutFlashT = 1;
		} else if (uppercutCooldownMs === 0) {
			prevUppercutCooldownMs = 0;
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
		for (const key of onceAnimations as KatzeAction[]) {
			const action = $actions[key];
			if (!action) continue;
			action.setLoop(THREE.LoopOnce, 1);
			action.clampWhenFinished = true;
		}
	});

	$effect(() => {
		if (!mixer) return;
		const onFinished = (e: THREE.Event & { action: THREE.AnimationAction }) => {
			const name = e.action.getClip().name as KatzeAction;
			if (attackAnimations.includes(name) || name === 'Attack2' || name === 'Attack3') {
				const idle = $actions['idle'];
				if (idle) {
					idle.enabled = true;
					idle.play();
					currentAction = 'idle';
				}
			}
		};
		mixer.addEventListener('finished', onFinished as (e: THREE.Event) => void);
		return () => mixer.removeEventListener('finished', onFinished as (e: THREE.Event) => void);
	});

	$effect(() => {
		if (!$actions?.['idle']) return;
		$actions['idle'].play();
	});

	$effect(() => {
		const currentAttack = attackAnimations[0];
		const next: KatzeAction = isDead
			? 'idle'
			: isDazed
				? 'idle'
				: isUppercutting
					? 'Attack3'
					: isChanneling
						? 'Attack2'
						: attackPhase > 0.3
							? currentAttack
							: speed > 0.1
								? 'walking'
								: 'idle';

		const current = $actions[currentAction];
		const nextAction = $actions[next];
		if (!nextAction || current === nextAction) return;

		nextAction.enabled = true;
		if (onceAnimations.includes(next)) nextAction.reset();
		if (current) current.crossFadeTo(nextAction, 0.2, true);
		nextAction.play();
		currentAction = next;

		if (attackAnimations.includes(next)) playAttack();
	});
</script>

<PositionalAudio
	src="{import.meta.env.BASE_URL}sounds/boss_footstep.mp3"
	refDistance={2}
	maxDistance={18}
	rolloffFactor={1.5}
	oncreate={(a) => {
		footstepAudio = a;
	}}
/>
<PositionalAudio
	src="{import.meta.env.BASE_URL}sounds/boss_attack.mp3"
	refDistance={4}
	maxDistance={22}
	rolloffFactor={1.5}
	oncreate={(a) => {
		attackAudio = a;
	}}
/>

<T.Group rotation.y={modelRotation}>
	<GLTF
		bind:gltf={$gltf}
		url="{import.meta.env.BASE_URL}models/enemies/boss/katze_miu/model.glb"
		rotation.y={Math.PI}
		scale={2.2}
	/>
</T.Group>

<!-- Uppercut VFX: vertical impact ring -->
{#if uppercutFlashT > 0}
	<T.Mesh
		position={[0, 0.06, 0]}
		rotation={[-Math.PI / 2, 0, 0]}
		scale={Math.max(0.1, (1 - uppercutFlashT) * 8)}
	>
		<T.RingGeometry args={[0.85, 1, 24]} />
		<T.MeshBasicMaterial
			color="#ffaa00"
			transparent
			opacity={uppercutFlashT * 0.9}
			blending={THREE.AdditiveBlending}
			depthWrite={false}
		/>
	</T.Mesh>
	<T.Mesh position={[0, 0.8, 0]} scale={0.3 + (1 - uppercutFlashT) * 0.6}>
		<T.SphereGeometry args={[1, 8, 6]} />
		<T.MeshBasicMaterial
			color="#ff6600"
			transparent
			opacity={uppercutFlashT * 0.85}
			blending={THREE.AdditiveBlending}
			depthWrite={false}
		/>
	</T.Mesh>
{/if}
