<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { GLTF, useGltfAnimations, PositionalAudio } from '@threlte/extras';
	import * as THREE from 'three';
	import { localPos, bossShake } from '$lib/stores/movement.svelte.js';
	import { settingsState } from '$root/settings.svelte.js';

	type WormAction = 'Idle' | 'Walk' | 'Attack' | 'Dead';

	type Props = {
		speed: number;
		attackPhase?: number;
		isDead?: boolean;
		isDazed?: boolean;
		isBurrowed?: boolean;
		isEnraged?: boolean;
		bossX?: number;
		bossZ?: number;
		chargeCooldownMs?: number;
	};

	let {
		speed,
		attackPhase = 0,
		isDead = false,
		isDazed = false,
		isBurrowed = false,
		isEnraged = false,
		bossX = 0,
		bossZ = 0,
		chargeCooldownMs = 0
	}: Props = $props();

	const SHAKE_MAX_DIST = 30;
	const SHAKE_FREQ = Math.PI * 1.0;
	const SHAKE_AMPLITUDE = 0.45;

	const { gltf, actions, mixer } = useGltfAnimations<WormAction>();

	let currentAction: WormAction = 'Idle';
	let shakeTimer = 0;
	let footstepTimer = 0;

	// Burrow animation state
	let burrowY = $state(0);
	let burrowRotX = $state(0);
	let chargeFlashT = $state(0);
	let burrowFlashT = $state(0);
	let prevBurrowed = $state(false);
	let prevChargeCooldownMs = $state(0);

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

		// Burrow: rotate nose-down and sink below ground, reverse on emerge
		const targetY = isBurrowed ? -10 : 0;
		const targetRotX = isBurrowed ? -Math.PI / 2 : 0;
		burrowY += (targetY - burrowY) * Math.min(1, dt * 2.5);
		burrowRotX += (targetRotX - burrowRotX) * Math.min(1, dt * 2.5);

		chargeFlashT = Math.max(0, chargeFlashT - dt / 1.0);
		burrowFlashT = Math.max(0, burrowFlashT - dt / 0.65);

		const isWalking = !isDead && !isDazed && speed > 0.05;
		if (isWalking) {
			shakeTimer += dt;
			footstepTimer += dt;
			if (footstepTimer > 0.6) {
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
		for (const key of ['Dead', 'Attack'] as WormAction[]) {
			const action = $actions[key];
			if (!action) continue;
			action.setLoop(THREE.LoopOnce, 1);
			action.clampWhenFinished = true;
		}
	});

	$effect(() => {
		if (!mixer) return;
		const onFinished = (e: THREE.Event & { action: THREE.AnimationAction }) => {
			const name = e.action.getClip().name as WormAction;
			if (name === 'Attack') {
				const idle = $actions['Idle'];
				if (idle) {
					idle.enabled = true;
					idle.play();
					currentAction = 'Idle';
				}
			}
		};
		mixer.addEventListener('finished', onFinished as (e: THREE.Event) => void);
		return () => mixer.removeEventListener('finished', onFinished as (e: THREE.Event) => void);
	});

	$effect(() => {
		if (!$actions?.['Idle']) return;
		$actions['Idle'].play();
	});

	// Re-center model: the GLTF root node has a large translation offset baked in
	$effect(() => {
		if (!$gltf) return;
		$gltf.scene.traverse((obj: any) => {
			if (obj.name === 'CaveWormSurvival') {
				obj.position.set(0, 0, 0);
			}
		});
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
		if (chargeCooldownMs > 0 && chargeCooldownMs !== prevChargeCooldownMs) {
			prevChargeCooldownMs = chargeCooldownMs;
			chargeFlashT = 1;
		}
	});
	$effect(() => {
		if (isBurrowed !== prevBurrowed) {
			prevBurrowed = isBurrowed;
			burrowFlashT = 1;
		}
	});

	$effect(() => {
		// While burrowed use Walk so it looks like it's tunneling
		const next: WormAction = isDead
			? 'Dead'
			: isDazed
				? 'Idle'
				: isBurrowed
					? 'Walk'
					: attackPhase > 0.3
						? 'Attack'
						: speed > 0.1
							? 'Walk'
							: 'Idle';

		const current = $actions[currentAction];
		const nextAction = $actions[next];
		if (!nextAction || current === nextAction) return;

		nextAction.enabled = true;
		if (next === 'Dead' || next === 'Attack') nextAction.reset();
		if (current) current.crossFadeTo(nextAction, 0.25, true);
		nextAction.play();
		currentAction = next;

		if (next === 'Dead') playDead();
		else if (next === 'Attack') playAttack();
	});
</script>

<PositionalAudio
	src="{import.meta.env.BASE_URL}sounds/enemies/boss_footstep.mp3"
	refDistance={3}
	maxDistance={20}
	rolloffFactor={1.5}
	oncreate={(a) => {
		footstepAudio = a;
	}}
/>
<PositionalAudio
	src="{import.meta.env.BASE_URL}sounds/enemies/boss_attack.mp3"
	refDistance={5}
	maxDistance={25}
	rolloffFactor={1.5}
	oncreate={(a) => {
		attackAudio = a;
	}}
/>
<PositionalAudio
	src="{import.meta.env.BASE_URL}sounds/enemies/boss_dead.mp3"
	refDistance={8}
	maxDistance={30}
	rolloffFactor={1.5}
	oncreate={(a) => {
		deadAudio = a;
	}}
/>

<!-- Burrow: sink and rotate nose-down into ground, reverse on emerge -->
<T.Group position.y={burrowY} rotation.x={burrowRotX}>
	<GLTF
		bind:gltf={$gltf}
		url="{import.meta.env.BASE_URL}models/enemies/boss/worm_monster/scene.gltf"
		rotation.y={Math.PI}
		scale={270.0}
	/>
</T.Group>

<!-- Chain Charge VFX: orange AoE ring -->
{#if chargeFlashT > 0}
    {#each Array.from({ length: 8 }, (_, i) => ({ angle: (i / 8) * Math.PI * 2, px: Math.sin((i / 8) * Math.PI * 2) * 9 * (1 - chargeFlashT), pz: Math.cos((i / 8) * Math.PI * 2) * 9 * (1 - chargeFlashT) })) as s}
        <T.Mesh position={[s.px, 0.12, s.pz]} rotation={[0, s.angle, 0]}>
            <T.BoxGeometry args={[0.1, 0.1, 20]} />
            <T.MeshBasicMaterial color="#ff6600" transparent opacity={chargeFlashT * 0.85} blending={THREE.AdditiveBlending} depthWrite={false} />
        </T.Mesh>
    {/each}
    <T.Mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={Math.max(0.1, (1 - chargeFlashT) * 20)}>
        <T.RingGeometry args={[0.88, 1, 32]} />
        <T.MeshBasicMaterial color="#ff4400" transparent opacity={chargeFlashT * 0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
    </T.Mesh>
    <T.Mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={Math.max(0.1, (1 - chargeFlashT) * 12)}>
        <T.RingGeometry args={[0.82, 1, 32]} />
        <T.MeshBasicMaterial color="#ffaa00" transparent opacity={chargeFlashT * 0.65} blending={THREE.AdditiveBlending} depthWrite={false} />
    </T.Mesh>
    <T.Mesh position={[0, 1.0, 0]} scale={0.4 + (1 - chargeFlashT) * 0.8}>
        <T.SphereGeometry args={[1, 8, 6]} />
        <T.MeshBasicMaterial color="#ff5500" transparent opacity={chargeFlashT * 0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
    </T.Mesh>
{/if}

<!-- Burrow/Emerge VFX: earth dust -->
{#if burrowFlashT > 0}
    <T.Mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={Math.max(0.1, (1 - burrowFlashT) * 5)}>
        <T.RingGeometry args={[0.75, 1, 24]} />
        <T.MeshBasicMaterial color="#886633" transparent opacity={burrowFlashT * 0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
    </T.Mesh>
    <T.Mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={Math.max(0.1, (1 - burrowFlashT) * 3)}>
        <T.CircleGeometry args={[1, 20]} />
        <T.MeshBasicMaterial color="#aa8855" transparent opacity={burrowFlashT * 0.45} blending={THREE.AdditiveBlending} depthWrite={false} />
    </T.Mesh>
    {#if !isBurrowed}
        <T.Mesh position={[0, 0.5, 0]} scale={0.3 + (1 - burrowFlashT) * 0.7}>
            <T.SphereGeometry args={[1, 8, 6]} />
            <T.MeshBasicMaterial color="#ffffff" transparent opacity={burrowFlashT * 0.75} blending={THREE.AdditiveBlending} depthWrite={false} />
        </T.Mesh>
    {/if}
{/if}
