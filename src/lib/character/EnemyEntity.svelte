<script module lang="ts">
	import * as THREE from 'three';
	export const markRingGeo = new THREE.TorusGeometry(0.4, 0.07, 6, 4);
	export const markStemGeo = new THREE.CylinderGeometry(0.03, 0.03, 1, 4);
	export const markMat = new THREE.MeshBasicMaterial({ color: '#f84' });

	// Blood splatter — shared geometry only; material is per-enemy for opacity control
	export const bloodGeo = new THREE.SphereGeometry(1, 4, 3);
	export const MAX_BLOOD_PER_ENEMY = 12;

	// Shared splat decal geometry (unit-sized, scaled per mesh)
	export const splatCircleGeo = new THREE.CircleGeometry(1, 8);
	export const splatRingGeo = new THREE.RingGeometry(0.4, 1.0, 8);
</script>

<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { PositionalAudio } from '@threlte/extras';
	import { PositionalAudio as ThreePosAudio } from 'three';
	import { untrack } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import type { Enemy } from '$bindings/types.js';
	import BasicRig from '$lib/character/enemies/basic/BasicRig.svelte';
	import FastRig from '$lib/character/enemies/fast/FastRig.svelte';
	import BruteRig from '$lib/character/enemies/brute/BruteRig.svelte';
	import SpitterRig from '$lib/character/enemies/spitter/SpitterRig.svelte';
	import CasterRig from '$lib/character/enemies/caster/CasterRig.svelte';
	import JumperRig from '$lib/character/enemies/jumper/JumperRig.svelte';
	import OgreRig from '$lib/character/enemies/ogre/OgreRig.svelte';
	import BossRig from '$lib/character/enemies/boss/BossRig.svelte';
	import { settingsState } from '$root/settings.svelte.js';

	type Props = { enemy: Enemy; alivePlayers?: any[] };
	let { enemy, alivePlayers = [] }: Props = $props();

	let displayX = $state(untrack(() => Number(enemy.posX) / 1000));
	let displayZ = $state(untrack(() => Number(enemy.posZ) / 1000));
	let facing = $state(0);
	let speed = $state(0);
	let nowMs = $state(Date.now());
	let deathAt = $state<number | null>(null);

	const spawnDuration = $derived(enemy.enemyType === 'boss' ? 1800 : 400);
	let spawnT = $state(
		untrack(() => {
			if (!enemy.spawnedAt) return 1;
			const age = Date.now() - Number(enemy.spawnedAt.microsSinceUnixEpoch) / 1000;
			return age >= spawnDuration ? 1 : Math.max(0, age / spawnDuration);
		})
	);
	const spawnTimeMs = $derived(
		enemy.spawnedAt ? Number(enemy.spawnedAt.microsSinceUnixEpoch) / 1000 : 0
	);

	const targetX = $derived(Number(enemy.posX) / 1000);
	const targetZ = $derived(Number(enemy.posZ) / 1000);

	let pulse = $state(1);
	let attackPhase = $state(0);
	let attackCycle = 0;
	let beamTimer = $state(0);
	let deathScale = $state(1);
	let prevSpitAt = $state<bigint | undefined>(undefined);
	let t = 0;
	useTask((dt) => {
		nowMs = Date.now();
		const age = nowMs - spawnTimeMs;
		if (age < spawnDuration) {
			spawnT = Math.min(1, age / spawnDuration);
		} else {
			spawnT = 1;
			if (!spawnSoundPlayed) {
				spawnSoundPlayed = true;
				if (spawnAudio?.buffer && settingsState.audio.effectsEnabled) {
					if (spawnAudio.isPlaying) spawnAudio.stop();
					spawnAudio.play();
				}
			}
		}

		if (!enemy.isAlive && deathAt === null) deathAt = nowMs;
		if (enemy.isAlive && deathAt !== null) {
			deathAt = null;
			deathScale = 1;
		}

		if (deathAt !== null) {
			deathScale = Math.max(0, deathScale - dt * 0.7);
		}

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
		if (!deathAt) speed = moveSpeed;
		if (!deathAt && speed < 0.8) {
			attackCycle += dt * 0.85;
		} else {
			attackCycle = 0;
		}
		attackPhase = Math.max(0, Math.sin(attackCycle * Math.PI * 2));
		if (enemy.enemyType === 'caster' || enemy.enemyType.startsWith('caster_')) {
			const curSpitAt = enemy.lastSpitAt?.microsSinceUnixEpoch;
			if (curSpitAt !== prevSpitAt) {
				prevSpitAt = curSpitAt;
				if (curSpitAt !== undefined) beamTimer = 0.65;
			}
			// Always face nearest alive player
			if (alivePlayers.length > 0 && !deathAt) {
				let nearestPlayer = alivePlayers[0];
				let nearestDistSq = Infinity;
				for (const p of alivePlayers) {
					const px = Number(p.posX) / 1000;
					const pz = Number(p.posZ) / 1000;
					const d = (px - displayX) ** 2 + (pz - displayZ) ** 2;
					if (d < nearestDistSq) {
						nearestDistSq = d;
						nearestPlayer = p;
					}
				}
				const px = Number(nearestPlayer.posX) / 1000;
				const pz = Number(nearestPlayer.posZ) / 1000;
				facing = Math.atan2(px - displayX, pz - displayZ) + Math.PI;
			}
		}
		if (beamTimer > 0) beamTimer = Math.max(0, beamTimer - dt);

		if (enemy.isAlive && growlAudio?.buffer && settingsState.audio.effectsEnabled) {
			growlTimer -= dt;
			if (growlTimer <= 0) {
				if (growlAudio.isPlaying) growlAudio.stop();
				growlAudio.play();
				growlTimer = Math.random() * 10 + 8;
			}
		}

		if (enemy.isMarked) {
			t += dt;
			pulse = 0.85 + Math.sin(t * 6) * 0.15;
		}
	});

	const bossDropY = $derived(enemy.enemyType === 'boss' ? (1 - spawnT) * 18 : 0);

	const DEAD_PERSIST_MS = 4000;
	const dead = $derived(deathAt !== null);
	const dazed = $derived(
		enemy.isDazed &&
			(enemy.dazedUntil ? Number(enemy.dazedUntil.microsSinceUnixEpoch) / 1000 > nowMs : true)
	);

	let killedAudio = $state.raw<ThreePosAudio | undefined>(undefined);
	let spawnAudio = $state.raw<ThreePosAudio | undefined>(undefined);
	let growlAudio = $state.raw<ThreePosAudio | undefined>(undefined);
	let spawnSoundPlayed = false;
	let growlTimer = Math.random() * 10 + 8; // first growl after 8–18s
	$effect(() => {
		if (dead && killedAudio?.buffer && settingsState.audio.effectsEnabled) {
			if (killedAudio.isPlaying) killedAudio.stop();
			killedAudio.play();
		}
	});

	// Hit flash — brief white ring when enemy takes damage
	let hitFlashAt = $state(0);
	let trackedHp = $state(untrack(() => Number(enemy.hp)));
	$effect(() => {
		const curHp = Number(enemy.hp);
		if (curHp < trackedHp && enemy.isAlive) hitFlashAt = Date.now();
		trackedHp = curHp;
	});
	const downedTilt = $derived(dead ? 1.35 : 0);
	const splatAge = $derived(dead ? nowMs - (deathAt ?? nowMs) : 0);
	const splatT = $derived(dead ? Math.max(0, 1 - splatAge / 2200) : 0);
	const splatGrow = $derived(dead ? Math.min(1, splatAge / 350) : 0);
	const expired = $derived(dead && splatAge >= DEAD_PERSIST_MS);

	const GRAVITY = 14;
	let bloodParticles = $state.raw<
		{
			x: number;
			y: number;
			z: number;
			vx: number;
			vy: number;
			vz: number;
			scale: number;
			delay: number;
			color: string;
		}[]
	>([]);
	let bloodAge = $state(0);
	let bloodStarted = $state(false);

	$effect(() => {
		if (dead && !bloodStarted) {
			bloodStarted = true;
			bloodAge = 0;
			const originY = enemy.enemyType === 'boss' ? 3.5 : 1.2;
			const INITIAL_SPEED = 6 + Math.random() * 4;
			const count = enemy.enemyType === 'boss' ? 24 : 12;
			bloodParticles = [];
			for (let i = 0; i < count; i++) {
				const isBig = i < 3;
				bloodParticles.push({
					x: (Math.random() - 0.5) * 0.5,
					y: originY + Math.random() * 0.6,
					z: (Math.random() - 0.5) * 0.5,
					vx: (Math.random() - 0.5) * 5,
					vy: INITIAL_SPEED + Math.random() * 3,
					vz: (Math.random() - 0.5) * 5,
					scale: isBig ? 0.2 + Math.random() * 0.2 : 0.1 + Math.random() * 0.15,
					delay: Math.random() * 0.12,
					color:
						i % 4 === 0 ? '#b80a0a' : i % 4 === 1 ? '#8a0a0a' : i % 4 === 2 ? '#6b0808' : '#520606'
				});
			}
		}
		if (!dead) {
			bloodStarted = false;
			bloodAge = 0;
		}
	});

	// Per-enemy blood material (opacity animated imperatively — can't share across enemies)
	const perBloodMat = new THREE.MeshBasicMaterial({ color: '#8a0a0a', transparent: true });
	let bloodMeshRef = $state.raw<THREE.InstancedMesh | undefined>(undefined);
	const _dummy = new THREE.Object3D();

	useTask((dt) => {
		if (bloodStarted && dead) {
			bloodAge += dt;
			perBloodMat.opacity = Math.max(0, 1 - bloodAge / 1.8);
			if (bloodMeshRef) {
				let count = 0;
				for (const p of bloodParticles) {
					if (bloodAge < p.delay) continue;
					p.vy -= GRAVITY * dt;
					p.x += p.vx * dt;
					p.y += p.vy * dt;
					p.z += p.vz * dt;
					if (p.y < 0.015) {
						p.y = 0.015;
						p.vy = 0;
						p.vx *= 0.25;
						p.vz *= 0.25;
					}
					const localAge = bloodAge - p.delay;
					const scaleMult = p.scale * Math.max(0.4, 1 - localAge * 0.6);
					_dummy.position.set(p.x, p.y + scaleMult * 0.3, p.z);
					_dummy.scale.set(scaleMult, scaleMult * 0.6, scaleMult);
					_dummy.updateMatrix();
					bloodMeshRef.setMatrixAt(count++, _dummy.matrix);
				}
				bloodMeshRef.count = count;
				bloodMeshRef.instanceMatrix.needsUpdate = true;
			}
		}
	});
</script>

{#if !expired}
	<T.Group
		position={[displayX, bossDropY, displayZ]}
		rotation={[0, facing, 0]}
		scale={cubicOut(spawnT) * deathScale}
	>
		<PositionalAudio
			src={`${import.meta.env.BASE_URL}sounds/enemies/enemy_killed.mp3`}
			refDistance={5}
			maxDistance={30}
			rolloffFactor={2}
			oncreate={(a) => {
				killedAudio = a;
			}}
		/>
		<PositionalAudio
			src={`${import.meta.env.BASE_URL}sounds/map/enemy_spawn.wav`}
			refDistance={3}
			maxDistance={25}
			rolloffFactor={2}
			oncreate={(a) => {
				spawnAudio = a;
			}}
		/>
		<PositionalAudio
			src={`${import.meta.env.BASE_URL}sounds/enemies/enemy_growl.wav`}
			refDistance={5}
			maxDistance={35}
			rolloffFactor={2}
			oncreate={(a) => {
				growlAudio = a;
			}}
		/>
		<T.Group rotation={[downedTilt, 0, 0]}>
			{#if enemy.enemyType === 'boss'}
				<BossRig
					{speed}
					{attackPhase}
					isDead={dead}
					isDazed={dazed}
					bossX={displayX}
					bossZ={displayZ}
				/>
			{:else if enemy.enemyType === 'brute'}
				<BruteRig {speed} {attackPhase} isDead={dead} />
			{:else if enemy.enemyType === 'fast'}
				<FastRig {speed} {attackPhase} isDead={dead} />
			{:else if enemy.enemyType === 'jumper'}
				<JumperRig {speed} {attackPhase} isDead={dead} />
			{:else if enemy.enemyType === 'spitter'}
				<SpitterRig {speed} {attackPhase} isDead={dead} />
			{:else if enemy.enemyType === 'caster' || enemy.enemyType.startsWith('caster_')}
				<CasterRig
					enemyType={enemy.enemyType as any}
					{speed}
					{attackPhase}
					{beamTimer}
					isDead={dead}
				/>
			{:else if enemy.enemyType === 'ogre' || enemy.enemyType === 'ogre_berserker' || enemy.enemyType === 'ogre_stalker'}
				<OgreRig enemyType={enemy.enemyType as any} {speed} {attackPhase} isDead={dead} />
			{:else}
				<BasicRig {speed} {attackPhase} isDead={dead} />
			{/if}
		</T.Group>

		{#if dead && splatT > 0}
			<T.Mesh
				position={[0, 0.01, 0]}
				rotation={[-Math.PI / 2, 0, 0]}
				scale={[1.0 + splatGrow * 0.6, 1.0 + splatGrow * 0.6, 1]}
				geometry={splatCircleGeo}
				renderOrder={1}
			>
				<T.MeshBasicMaterial
					color="#4a0f0f"
					transparent
					opacity={0.7 * splatT}
					depthWrite={false}
				/>
			</T.Mesh>
			<T.Mesh
				position={[0, 0.012, 0]}
				rotation={[-Math.PI / 2, 0, 0]}
				scale={[1.1 + splatGrow * 1.0, 1.1 + splatGrow * 1.0, 1]}
				geometry={splatRingGeo}
				renderOrder={1}
			>
				<T.MeshBasicMaterial
					color="#2b0606"
					transparent
					opacity={0.3 * splatT}
					depthWrite={false}
				/>
			</T.Mesh>
		{/if}

		{#if bloodStarted}
			<T.InstancedMesh
				args={[bloodGeo, perBloodMat, MAX_BLOOD_PER_ENEMY]}
				frustumCulled={false}
				oncreate={(m) => {
					bloodMeshRef = m;
					m.count = 0;
				}}
			/>
		{/if}

		{@const hitT = Math.max(0, 1 - (nowMs - hitFlashAt) / 160)}
		{#if hitT > 0 && !dead}
			<T.Mesh
				position={[0, 0.05, 0]}
				rotation={[-Math.PI / 2, 0, 0]}
				scale={0.3 + (1 - hitT) * 0.7}
			>
				<T.RingGeometry args={[0.2, 0.45, 16]} />
				<T.MeshBasicMaterial
					color="#ffffff"
					transparent
					opacity={hitT * 0.85}
					blending={THREE.AdditiveBlending}
					depthWrite={false}
				/>
			</T.Mesh>
			<T.Mesh position={[0, 1.0, 0]} scale={0.05 + (1 - hitT) * 0.12}>
				<T.SphereGeometry args={[1, 6, 4]} />
				<T.MeshBasicMaterial
					color="#ffffff"
					transparent
					opacity={hitT * 0.7}
					blending={THREE.AdditiveBlending}
					depthWrite={false}
				/>
			</T.Mesh>
		{/if}

		{#if enemy.isMarked && !dead}
			<T.Mesh
				position={[0, 2.7, 0]}
				rotation={[Math.PI / 4, 0, 0]}
				scale={[pulse, pulse, pulse]}
				geometry={markRingGeo}
				material={markMat}
			/>
		{/if}
	</T.Group>
{/if}
