<script module lang="ts">
	import * as THREE from 'three';
	export const markRingGeo = new THREE.TorusGeometry(0.4, 0.07, 6, 4);
	export const markStemGeo = new THREE.CylinderGeometry(0.03, 0.03, 1, 4);
	export const markMat = new THREE.MeshBasicMaterial({ color: '#f84' });
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
	import BossRig from '$lib/character/enemies/boss/BossRig.svelte';
	import { settingsState } from '$root/settings.svelte.js';

	type Props = { enemy: Enemy };
	let { enemy }: Props = $props();

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
	let prevSpitAt = $state<bigint | undefined>(undefined);
	let t = 0;
	useTask((dt) => {
		nowMs = Date.now();
		const age = nowMs - spawnTimeMs;
		if (age < spawnDuration) {
			spawnT = Math.min(1, age / spawnDuration);
		} else {
			spawnT = 1;
		}

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
		if (!deathAt) speed = moveSpeed;
		if (!deathAt && speed < 0.8) {
			attackCycle += dt * 0.85;
		} else {
			attackCycle = 0;
		}
		attackPhase = Math.max(0, Math.sin(attackCycle * Math.PI * 2));
		if (enemy.enemyType === 'caster') {
			const curSpitAt = enemy.lastSpitAt?.microsSinceUnixEpoch;
			if (curSpitAt !== prevSpitAt) {
				prevSpitAt = curSpitAt;
				if (curSpitAt !== undefined) beamTimer = 0.65;
			}
		}
		if (beamTimer > 0) beamTimer = Math.max(0, beamTimer - dt);
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
	$effect(() => {
		if (dead && killedAudio?.buffer && settingsState.audio.effectsEnabled) {
			if (killedAudio.isPlaying) killedAudio.stop();
			killedAudio.play();
		}
	});
	const downedTilt = $derived(dead ? 1.35 : 0);
	const splatAge = $derived(dead ? nowMs - (deathAt ?? nowMs) : 0);
	const splatT = $derived(dead ? Math.max(0, 1 - splatAge / 2200) : 0);
	const splatGrow = $derived(dead ? Math.min(1, splatAge / 350) : 0);
	const expired = $derived(dead && splatAge >= DEAD_PERSIST_MS);

	const PARTICLE_COUNT = 12;
	const GRAVITY = 12;
	const bloodParticles = $state.raw<
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
			const INITIAL_SPEED = 4 + Math.random() * 3;
			bloodParticles.length = 0;
			for (let i = 0; i < PARTICLE_COUNT; i++) {
				bloodParticles.push({
					x: (Math.random() - 0.5) * 0.3,
					y: originY + Math.random() * 0.5,
					z: (Math.random() - 0.5) * 0.3,
					vx: (Math.random() - 0.5) * 2.5,
					vy: INITIAL_SPEED + Math.random() * 2,
					vz: (Math.random() - 0.5) * 2.5,
					scale: 0.06 + Math.random() * 0.08,
					delay: Math.random() * 0.15,
					color: i % 3 === 0 ? '#8a0a0a' : i % 3 === 1 ? '#6b0808' : '#520606'
				});
			}
		}
		if (!dead) {
			bloodStarted = false;
			bloodAge = 0;
		}
	});

	const bloodOpacity = $derived(bloodStarted ? Math.max(0, 1 - bloodAge / 1.2) : 0);

	useTask((dt) => {
		if (bloodStarted && dead) {
			bloodAge += dt;
			for (const p of bloodParticles) {
				if (bloodAge < p.delay) continue;
				p.vy -= GRAVITY * dt;
				p.x += p.vx * dt;
				p.y += p.vy * dt;
				p.z += p.vz * dt;
				if (p.y < 0.02) {
					p.y = 0.02;
					p.vy = 0;
					p.vx *= 0.3;
					p.vz *= 0.3;
				}
			}
		}
	});
</script>

{#if !expired}
	<T.Group
		position={[displayX, bossDropY, displayZ]}
		rotation={[0, facing, 0]}
		scale={cubicOut(spawnT)}
	>
		<PositionalAudio
			src={`${import.meta.env.BASE_URL}sounds/enemy_killed.mp3`}
			refDistance={5}
			maxDistance={30}
			rolloffFactor={2}
			oncreate={(a) => {
				killedAudio = a;
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
			{:else if enemy.enemyType === 'spitter'}
				<SpitterRig {speed} {attackPhase} isDead={dead} />
			{:else if enemy.enemyType === 'caster'}
				<CasterRig {speed} {attackPhase} {beamTimer} isDead={dead} />
			{:else}
				<BasicRig {speed} {attackPhase} isDead={dead} />
			{/if}
		</T.Group>

		{#if dead && splatT > 0}
			<T.Mesh
				position={[0, 0.01, 0]}
				rotation={[-Math.PI / 2, 0, 0]}
				scale={[1.1 + splatGrow * 0.6, 1.1 + splatGrow * 0.6, 1]}
				renderOrder={1}
			>
				<T.CircleGeometry args={[0.45 + (1 - splatT) * 0.55, 16]} />
				<T.MeshBasicMaterial
					color="#4a0f0f"
					transparent
					opacity={0.7 * splatT}
					depthWrite={false}
				/>
			</T.Mesh>
			<T.Mesh
				position={[0.05, 0.011, -0.08]}
				rotation={[-Math.PI / 2, 0.2, 0]}
				scale={[1.2 + splatGrow * 0.7, 1.0 + splatGrow * 0.5, 1]}
				renderOrder={1}
			>
				<T.RingGeometry args={[0.35, 0.85, 18]} />
				<T.MeshBasicMaterial
					color="#2b0606"
					transparent
					opacity={0.35 * splatT}
					depthWrite={false}
				/>
			</T.Mesh>
			<T.Mesh
				position={[-0.35, 0.01, 0.15]}
				rotation={[-Math.PI / 2, 0, 0]}
				scale={[0.35, 0.25, 1]}
				renderOrder={1}
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
				position={[0.32, 0.01, -0.22]}
				rotation={[-Math.PI / 2, 0, 0]}
				scale={[0.28, 0.22, 1]}
				renderOrder={1}
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
				position={[0.18, 0.01, 0.32]}
				rotation={[-Math.PI / 2, 0, 0]}
				scale={[0.22, 0.18, 1]}
				renderOrder={1}
			>
				<T.CircleGeometry args={[0.18, 12]} />
				<T.MeshBasicMaterial
					color="#3b0b0b"
					transparent
					opacity={0.35 * splatT}
					depthWrite={false}
				/>
			</T.Mesh>
			<T.Mesh
				position={[0, 0.012, 0]}
				rotation={[-Math.PI / 2, 0, 0]}
				scale={[1 + splatGrow * 1.2, 1 + splatGrow * 1.2, 1]}
				renderOrder={1}
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

		{#if bloodStarted && bloodOpacity > 0}
			{#each bloodParticles as p}
				{@const localAge = bloodAge - p.delay}
				{#if localAge >= 0}
					<T.Mesh position={[p.x, p.y, p.z]} scale={p.scale * Math.max(0.3, 1 - localAge * 0.8)}>
						<T.SphereGeometry args={[1, 6, 4]} />
						<T.MeshBasicMaterial
							color={p.color}
							transparent
							opacity={bloodOpacity * (0.7 + Math.random() * 0.3)}
						/>
					</T.Mesh>
				{/if}
			{/each}
		{/if}

		{#if enemy.isMarked && !dead}
			<T.Mesh
				position={[0, 2.2, 0]}
				rotation={[Math.PI / 4, 0, 0]}
				scale={[pulse, pulse, pulse]}
				geometry={markRingGeo}
				material={markMat}
			/>
			<T.Mesh position={[0, 1.6, 0]} geometry={markStemGeo} material={markMat} />
		{/if}
	</T.Group>
{/if}
