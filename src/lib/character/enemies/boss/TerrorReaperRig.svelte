<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { GLTF, useGltfAnimations, PositionalAudio } from '@threlte/extras';
	import * as THREE from 'three';
	import { localPos, bossShake } from '$lib/stores/movement.svelte.js';
	import { settingsState } from '$root/settings.svelte.js';
	import { soundActions } from '$root/Sound.svelte';

	type ReaperAction = 'attack' | 'run' | 'walk' | 'idle' | 'death';

	type Props = {
		speed: number;
		attackPhase?: number;
		isDead?: boolean;
		isDazed?: boolean;
		isEnraged?: boolean;
		bossX?: number;
		bossZ?: number;
		soulDrainCooldownMs?: number;
		deathBlinkCooldownMs?: number;
	};

	let {
		speed,
		attackPhase = 0,
		isDead = false,
		isDazed = false,
		isEnraged = false,
		bossX = 0,
		bossZ = 0,
		soulDrainCooldownMs = 0,
		deathBlinkCooldownMs = 0
	}: Props = $props();

	const SHAKE_MAX_DIST = 22;
	const SHAKE_FREQ = Math.PI * 1.1;
	const SHAKE_AMPLITUDE = 0.2;

	const { gltf, actions, mixer } = useGltfAnimations<ReaperAction>();

	let currentAction: ReaperAction = 'idle';
	let shakeTimer = 0;
	let footstepTimer = 0;
	let hasPlayedIntro = false;

	// Ability VFX timers
	let soulDrainFlashT = $state(0);
	let deathBlinkFlashT = $state(0);
	let prevSoulDrainCooldownMs = $state(0);
	let prevDeathBlinkCooldownMs = $state(0);

	const onceAnimations: ReaperAction[] = ['attack', 'death'];

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

		// Decay ability flash timers
		soulDrainFlashT = Math.max(0, soulDrainFlashT - dt / 1.0);
		deathBlinkFlashT = Math.max(0, deathBlinkFlashT - dt / 0.65);

		const isWalking = !isDead && !isDazed && speed > 0.05;
		if (isWalking) {
			shakeTimer += dt;
			footstepTimer += dt;
			if (footstepTimer > 0.55) {
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

	// Detect soul drain
	$effect(() => {
		if (soulDrainCooldownMs > 0 && soulDrainCooldownMs !== prevSoulDrainCooldownMs) {
			prevSoulDrainCooldownMs = soulDrainCooldownMs;
			soulDrainFlashT = 1;
		}
	});

	// Detect death blink
	$effect(() => {
		if (deathBlinkCooldownMs > 0 && deathBlinkCooldownMs !== prevDeathBlinkCooldownMs) {
			prevDeathBlinkCooldownMs = deathBlinkCooldownMs;
			deathBlinkFlashT = 1;
		}
	});

	$effect(() => {
		if ($gltf && !hasPlayedIntro) {
			hasPlayedIntro = true;
			soundActions.playBossIntro();
		}
	});

	$effect(() => {
		for (const key of onceAnimations) {
			const action = $actions[key];
			if (!action) continue;
			action.setLoop(THREE.LoopOnce, 1);
			action.clampWhenFinished = true;
		}
	});

	$effect(() => {
		if (!$gltf) return;
		$gltf.scene.traverse((obj: any) => {
			if (!obj.isMesh) return;
			const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
			for (const mat of mats) {
				if ('emissive' in mat) {
					mat.emissive.set(isEnraged ? '#660022' : isDazed ? '#112244' : '#000000');
					mat.emissiveIntensity = isEnraged ? 0.5 : isDazed ? 0.4 : 0;
				}
			}
		});
	});

	useTask(() => {
		if (!$gltf) return;
		const next: ReaperAction = isDead
			? 'death'
			: isDazed
				? 'idle'
				: attackPhase > 0.15
					? 'attack'
					: speed > 0.1
						? (speed > 6 ? 'run' : 'walk')
						: 'idle';

		const current = $actions[currentAction];
		const nextAction = $actions[next];
		if (!nextAction || current === nextAction) return;

		nextAction.enabled = true;
		if (onceAnimations.includes(next)) nextAction.reset();
		if (current) current.crossFadeTo(nextAction, 0.25, true);
		nextAction.play();
		currentAction = next;

		if (next === 'death') playDead();
		else if (next === 'attack') playAttack();
		else if (next === 'idle' && isDazed) playDaze();
	});
</script>

<PositionalAudio
	src="{import.meta.env.BASE_URL}sounds/enemies/boss_footstep.mp3"
	refDistance={3}
	maxDistance={20}
	rolloffFactor={1.5}
	oncreate={(a) => { footstepAudio = a; }}
/>
<PositionalAudio
	src="{import.meta.env.BASE_URL}sounds/enemies/boss_attack.mp3"
	refDistance={5}
	maxDistance={25}
	rolloffFactor={1.5}
	oncreate={(a) => { attackAudio = a; }}
/>
<PositionalAudio
	src="{import.meta.env.BASE_URL}sounds/enemies/boss_dead.mp3"
	refDistance={8}
	maxDistance={30}
	rolloffFactor={1.5}
	oncreate={(a) => { deadAudio = a; }}
/>
<PositionalAudio
	src="{import.meta.env.BASE_URL}sounds/enemies/boss_daze.mp3"
	refDistance={5}
	maxDistance={25}
	rolloffFactor={1.5}
	oncreate={(a) => { dazeAudio = a; }}
/>

<GLTF
	bind:gltf={$gltf}
	url="{import.meta.env.BASE_URL}models/enemies/boss/terror_reaper/scene.gltf"
	rotation.y={Math.PI}
	scale={3.2}
/>

<!-- Soul Drain VFX: converging dark purple tendrils + red ring -->
{#if soulDrainFlashT > 0}
	{#each Array.from({ length: 8 }, (_, i) => ({ angle: (i / 8) * Math.PI * 2 })) as s}
		<T.Mesh
			position={[
				Math.sin(s.angle) * 14 * soulDrainFlashT,
				0.9,
				Math.cos(s.angle) * 14 * soulDrainFlashT
			]}
			rotation={[0, s.angle + Math.PI, 0]}
		>
			<T.BoxGeometry args={[0.07, 0.07, 14 * soulDrainFlashT]} />
			<T.MeshBasicMaterial
				color="#880044"
				transparent
				opacity={soulDrainFlashT * 0.85}
				blending={THREE.AdditiveBlending}
				depthWrite={false}
			/>
		</T.Mesh>
		<T.Mesh
			position={[
				Math.sin(s.angle) * 14 * soulDrainFlashT,
				0.9,
				Math.cos(s.angle) * 14 * soulDrainFlashT
			]}
			rotation={[0, s.angle + Math.PI, 0]}
		>
			<T.BoxGeometry args={[0.18, 0.18, 14 * soulDrainFlashT * 0.5]} />
			<T.MeshBasicMaterial
				color="#550033"
				transparent
				opacity={soulDrainFlashT * 0.4}
				blending={THREE.AdditiveBlending}
				depthWrite={false}
			/>
		</T.Mesh>
	{/each}
	<!-- Contracting drain ring -->
	<T.Mesh
		position={[0, 0.06, 0]}
		rotation={[-Math.PI / 2, 0, 0]}
		scale={Math.max(0.1, soulDrainFlashT * 14)}
	>
		<T.RingGeometry args={[0.85, 1, 32]} />
		<T.MeshBasicMaterial
			color="#cc0044"
			transparent
			opacity={soulDrainFlashT * 0.9}
			blending={THREE.AdditiveBlending}
			depthWrite={false}
		/>
	</T.Mesh>
	<!-- Central soul absorption burst -->
	<T.Mesh position={[0, 1.1, 0]} scale={0.15 + (1 - soulDrainFlashT) * 0.6}>
		<T.SphereGeometry args={[1, 8, 6]} />
		<T.MeshBasicMaterial
			color="#ff0055"
			transparent
			opacity={soulDrainFlashT * 0.95}
			blending={THREE.AdditiveBlending}
			depthWrite={false}
		/>
	</T.Mesh>
	<!-- HP restored glow — green inner ring -->
	<T.Mesh
		position={[0, 0.06, 0]}
		rotation={[-Math.PI / 2, 0, 0]}
		scale={Math.max(0.1, (1 - soulDrainFlashT) * 3)}
	>
		<T.RingGeometry args={[0.7, 1, 24]} />
		<T.MeshBasicMaterial
			color="#44ff88"
			transparent
			opacity={soulDrainFlashT * 0.6}
			blending={THREE.AdditiveBlending}
			depthWrite={false}
		/>
	</T.Mesh>
{/if}

<!-- Death Blink VFX: dark portal flash + scythe slash ring -->
{#if deathBlinkFlashT > 0}
	<!-- Dark void portal on ground -->
	<T.Mesh
		position={[0, 0.06, 0]}
		rotation={[-Math.PI / 2, 0, 0]}
		scale={Math.max(0.1, (1 - deathBlinkFlashT) * 5)}
	>
		<T.RingGeometry args={[0.8, 1, 32]} />
		<T.MeshBasicMaterial
			color="#220033"
			transparent
			opacity={deathBlinkFlashT * 0.9}
			blending={THREE.AdditiveBlending}
			depthWrite={false}
		/>
	</T.Mesh>
	<T.Mesh
		position={[0, 0.06, 0]}
		rotation={[-Math.PI / 2, 0, 0]}
		scale={Math.max(0.1, (1 - deathBlinkFlashT) * 3.5)}
	>
		<T.CircleGeometry args={[1, 24]} />
		<T.MeshBasicMaterial
			color="#110022"
			transparent
			opacity={deathBlinkFlashT * 0.5}
			blending={THREE.AdditiveBlending}
			depthWrite={false}
		/>
	</T.Mesh>
	<!-- Scythe slash arcs — 3 curved slashes -->
	{#each [0, 1, 2] as i}
		<T.Mesh
			position={[0, 1.2 + i * 0.25, 0]}
			rotation={[-Math.PI / 2, 0, (i / 3) * Math.PI * 2]}
			scale={0.8 + (1 - deathBlinkFlashT) * 1.5}
		>
			<T.RingGeometry args={[0.7, 0.88, 20, 1, 0, Math.PI * 1.2]} />
			<T.MeshBasicMaterial
				color="#cc44ff"
				transparent
				opacity={deathBlinkFlashT * (0.9 - i * 0.15)}
				blending={THREE.AdditiveBlending}
				depthWrite={false}
			/>
		</T.Mesh>
	{/each}
	<!-- Dark burst core -->
	<T.Mesh position={[0, 1.0, 0]} scale={0.3 + (1 - deathBlinkFlashT) * 0.5}>
		<T.SphereGeometry args={[1, 8, 6]} />
		<T.MeshBasicMaterial
			color="#9900cc"
			transparent
			opacity={deathBlinkFlashT * 0.95}
			blending={THREE.AdditiveBlending}
			depthWrite={false}
		/>
	</T.Mesh>
{/if}
