<script module lang="ts">
	import * as THREE from 'three';
	// Shared geometries — created once, reused across all EnemyEntity instances
	export const bruteBodyGeo = new THREE.BoxGeometry(0.7, 0.18, 0.32);
	export const bruteSpikeGeo = new THREE.ConeGeometry(0.08, 0.26, 6);
	export const fastCrestGeo = new THREE.ConeGeometry(0.06, 0.36, 6);
	export const fastFinGeo = new THREE.ConeGeometry(0.05, 0.4, 6);
	export const spitterBulbGeo = new THREE.SphereGeometry(0.18, 8, 6);
	export const spitterSacGeo = new THREE.CylinderGeometry(0.08, 0.14, 0.5, 6);
	export const basicHornGeo = new THREE.ConeGeometry(0.05, 0.2, 6);
	export const markRingGeo = new THREE.TorusGeometry(0.4, 0.07, 6, 4);
	export const markStemGeo = new THREE.CylinderGeometry(0.03, 0.03, 1, 4);
	// Shared materials
	export const bruteBodyMat = new THREE.MeshStandardMaterial({ color: '#4a1f1f' });
	export const bruteSpikeMat = new THREE.MeshStandardMaterial({ color: '#5c2a2a' });
	export const fastCrestMat = new THREE.MeshStandardMaterial({ color: '#f99' });
	export const fastFinMat = new THREE.MeshStandardMaterial({ color: '#f77' });
	export const spitterBulbMat = new THREE.MeshStandardMaterial({ color: '#2f7a2f' });
	export const spitterSacMat = new THREE.MeshStandardMaterial({ color: '#2b6a2b' });
	export const basicHornMat = new THREE.MeshStandardMaterial({ color: '#c77' });
	export const markMat = new THREE.MeshBasicMaterial({ color: '#f84' });
</script>

<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { PositionalAudio } from '@threlte/extras';
	import { PositionalAudio as ThreePosAudio } from 'three';
	import { untrack } from 'svelte';
	import type { Enemy } from '../module_bindings/types.js';
	import StickRig from './StickRig.svelte';
	import { settingsState } from '../settings.svelte.js';

	type Props = { enemy: Enemy };
	let { enemy }: Props = $props();

	let displayX = $state(untrack(() => Number(enemy.posX) / 1000));
	let displayZ = $state(untrack(() => Number(enemy.posZ) / 1000));
	let facing = $state(0);
	let walkPhase = $state(0);
	let speed = $state(0);
	let nowMs = $state(Date.now());
	let deathAt = $state<number | null>(null);

	const targetX = $derived(Number(enemy.posX) / 1000);
	const targetZ = $derived(Number(enemy.posZ) / 1000);

	const ENEMY_COLORS: Record<string, string> = {
		basic: '#c33',
		fast: '#a4f',
		brute: '#833',
		spitter: '#3c3'
	};

	let pulse = $state(1);
	let t = 0;
	useTask((dt) => {
		nowMs = Date.now();
		if (!enemy.isAlive && deathAt === null) deathAt = nowMs;
		if (enemy.isAlive && deathAt !== null) deathAt = null;

		const LERP = 1 - Math.pow(0.0001, dt);
		const prevX = displayX;
		const prevZ = displayZ;
		displayX += (targetX - displayX) * LERP;
		displayZ += (targetZ - displayZ) * LERP;
		const dx = displayX - prevX;
		const dz = displayZ - prevZ;
		const moveSpeed = Math.hypot(dx, dz) / Math.max(dt, 0.0001);
		speed = deathAt ? 0 : moveSpeed;
		if (moveSpeed > 0.02) {
			facing = Math.atan2(dx, dz) + Math.PI;
		}
		if (!deathAt) walkPhase += dt * (1.2 + moveSpeed * 2.4);
		if (enemy.isMarked) {
			t += dt;
			pulse = 0.85 + Math.sin(t * 6) * 0.15;
		}
	});

	const rigClass = $derived(
		enemy.enemyType === 'brute'
			? 'tank'
			: enemy.enemyType === 'fast'
				? 'gunner'
				: enemy.enemyType === 'spitter'
					? 'spotter'
					: 'healer'
	);
	const DEAD_PERSIST_MS = 4000;
	const dead = $derived(deathAt !== null);

	let killedAudio = $state.raw<ThreePosAudio | undefined>(undefined);
	$effect(() => {
		if (dead && killedAudio?.buffer && settingsState.audio.effectsEnabled) {
			if (killedAudio.isPlaying) killedAudio.stop();
			killedAudio.play();
		}
	});
	const downedTilt = $derived(dead ? -Math.PI / 2 : 0);
	const downedYOffset = $derived(dead ? -0.35 : 0);
	const splatAge = $derived(dead ? nowMs - (deathAt ?? nowMs) : 0);
	const splatT = $derived(dead ? Math.max(0, 1 - splatAge / 2200) : 0);
	const splatGrow = $derived(dead ? Math.min(1, splatAge / 350) : 0);
	const expired = $derived(dead && splatAge >= DEAD_PERSIST_MS);
</script>

{#if !expired}
	<T.Group position={[displayX, 0, displayZ]} rotation={[0, facing, 0]}>
		<!-- Enemy death sound — positional, plays once on kill -->
		<PositionalAudio
			src={`${import.meta.env.BASE_URL}sounds/enemy_killed.mp3`}
			refDistance={5}
			maxDistance={30}
			rolloffFactor={2}
			oncreate={(a) => {
				killedAudio = a;
			}}
		/>
		<T.Group position={[0, downedYOffset, 0]} rotation={[downedTilt, 0, 0]}>
			<T.Group
				scale={[
					enemy.enemyType === 'brute' ? 1.2 : enemy.enemyType === 'fast' ? 0.9 : 1.0,
					enemy.enemyType === 'brute' ? 1.1 : enemy.enemyType === 'fast' ? 1.05 : 1.0,
					enemy.enemyType === 'brute' ? 1.15 : enemy.enemyType === 'fast' ? 0.8 : 1.0
				]}
			>
				<StickRig
					classChoice={rigClass}
					color={ENEMY_COLORS[enemy.enemyType] ?? '#c33'}
					{walkPhase}
					{speed}
					shotPulse={0}
					isEnemy={true}
				/>
			</T.Group>
			{#if enemy.enemyType === 'brute'}
				<!-- Brute spikes + wide shoulders -->
				<T.Mesh position={[0, 1.35, -0.05]} geometry={bruteBodyGeo} material={bruteBodyMat} />
				<T.Mesh
					position={[-0.25, 1.55, -0.05]}
					rotation={[0, 0.2, 0]}
					geometry={bruteSpikeGeo}
					material={bruteSpikeMat}
				/>
				<T.Mesh
					position={[0.25, 1.55, -0.05]}
					rotation={[0, -0.2, 0]}
					geometry={bruteSpikeGeo}
					material={bruteSpikeMat}
				/>
			{:else if enemy.enemyType === 'fast'}
				<!-- Fast fins + lean head crest -->
				<T.Mesh
					position={[0, 1.52, -0.02]}
					rotation={[0.2, 0, 0]}
					geometry={fastCrestGeo}
					material={fastCrestMat}
				/>
				<T.Mesh
					position={[0, 1.15, 0.2]}
					rotation={[Math.PI / 2, 0, 0]}
					geometry={fastFinGeo}
					material={fastFinMat}
				/>
			{:else if enemy.enemyType === 'spitter'}
				<!-- Spitter bulb + dorsal sac -->
				<T.Mesh position={[0, 1.3, 0.22]} geometry={spitterBulbGeo} material={spitterBulbMat} />
				<T.Mesh
					position={[0, 1.0, 0.25]}
					rotation={[Math.PI / 2, 0, 0]}
					geometry={spitterSacGeo}
					material={spitterSacMat}
				/>
			{:else}
				<!-- Basic: head horns -->
				<T.Mesh
					position={[-0.14, 1.64, 0]}
					rotation={[0, 0, -0.3]}
					geometry={basicHornGeo}
					material={basicHornMat}
				/>
				<T.Mesh
					position={[0.14, 1.64, 0]}
					rotation={[0, 0, 0.3]}
					geometry={basicHornGeo}
					material={basicHornMat}
				/>
			{/if}
		</T.Group>

		{#if dead && splatT > 0}
			<!-- Blood splatter -->
			<T.Mesh
				position={[0, -0.49, 0]}
				rotation={[-Math.PI / 2, 0, 0]}
				scale={[1.1 + splatGrow * 0.6, 1.1 + splatGrow * 0.6, 1]}
			>
				<T.CircleGeometry args={[0.45 + (1 - splatT) * 0.55, 16]} />
				<T.MeshBasicMaterial
					color="#4a0f0f"
					transparent
					opacity={0.7 * splatT}
					depthWrite={false}
				/>
			</T.Mesh>
			<!-- Darker edge puddle -->
			<T.Mesh
				position={[0.05, -0.491, -0.08]}
				rotation={[-Math.PI / 2, 0.2, 0]}
				scale={[1.2 + splatGrow * 0.7, 1.0 + splatGrow * 0.5, 1]}
			>
				<T.RingGeometry args={[0.35, 0.85, 18]} />
				<T.MeshBasicMaterial
					color="#2b0606"
					transparent
					opacity={0.35 * splatT}
					depthWrite={false}
				/>
			</T.Mesh>
			<!-- Splash droplets -->
			<T.Mesh
				position={[-0.35, -0.485, 0.15]}
				rotation={[-Math.PI / 2, 0, 0]}
				scale={[0.35, 0.25, 1]}
			>
				<T.CircleGeometry args={[0.25, 12]} />
				<T.MeshBasicMaterial
					color="#4a0f0f"
					transparent
					opacity={0.45 * splatT}
					depthWrite={false}
				/>
			</T.Mesh>
			<T.Mesh
				position={[0.32, -0.485, -0.22]}
				rotation={[-Math.PI / 2, 0, 0]}
				scale={[0.28, 0.22, 1]}
			>
				<T.CircleGeometry args={[0.22, 12]} />
				<T.MeshBasicMaterial
					color="#4a0f0f"
					transparent
					opacity={0.4 * splatT}
					depthWrite={false}
				/>
			</T.Mesh>
			<T.Mesh
				position={[0.18, -0.485, 0.32]}
				rotation={[-Math.PI / 2, 0, 0]}
				scale={[0.22, 0.18, 1]}
			>
				<T.CircleGeometry args={[0.18, 12]} />
				<T.MeshBasicMaterial
					color="#3b0b0b"
					transparent
					opacity={0.35 * splatT}
					depthWrite={false}
				/>
			</T.Mesh>
			<!-- Shock ring -->
			<T.Mesh
				position={[0, -0.48, 0]}
				rotation={[-Math.PI / 2, 0, 0]}
				scale={[1 + splatGrow * 1.2, 1 + splatGrow * 1.2, 1]}
			>
				<T.RingGeometry args={[0.25, 0.55, 16]} />
				<T.MeshBasicMaterial
					color="#aa2222"
					transparent
					opacity={0.25 * splatT}
					depthWrite={false}
				/>
			</T.Mesh>
		{/if}

		{#if enemy.isMarked && !dead}
			<!-- Mark ring above enemy -->
			<T.Mesh
				position={[0, 2.2, 0]}
				rotation={[Math.PI / 4, 0, 0]}
				scale={[pulse, pulse, pulse]}
				geometry={markRingGeo}
				material={markMat}
			/>
			<!-- Stem -->
			<T.Mesh position={[0, 1.6, 0]} geometry={markStemGeo} material={markMat} />
		{/if}
	</T.Group>
{/if}
