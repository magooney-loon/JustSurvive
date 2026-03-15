<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { untrack } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import * as THREE from 'three';
	import type { Boss } from '$bindings/types.js';
	import BossRig from './BossRig.svelte';
	import WormMonsterRig from './WormMonsterRig.svelte';
	import RabidDogRig from './RabidDogRig.svelte';
	import Scp096Rig from './Scp096Rig.svelte';

	type Props = { boss: Boss };
	let { boss }: Props = $props();

	const SPAWN_DURATION = 1800;

	let displayX = $state(untrack(() => Number(boss.posX) / 1000));
	let displayZ = $state(untrack(() => Number(boss.posZ) / 1000));
	let facing = $state(0);
	let speed = $state(0);
	let nowMs = $state(Date.now());
	let deathAt = $state<number | null>(null);

	const spawnTimeMs = $derived(Number(boss.spawnedAt.microsSinceUnixEpoch) / 1000);
	let spawnT = $state(
		untrack(() => {
			const age = Date.now() - Number(boss.spawnedAt.microsSinceUnixEpoch) / 1000;
			return age >= SPAWN_DURATION ? 1 : Math.max(0, age / SPAWN_DURATION);
		})
	);

	const targetX = $derived(Number(boss.posX) / 1000);
	const targetZ = $derived(Number(boss.posZ) / 1000);

	const isEnraged = $derived(boss.phase > 0n);
	const isHidden = $derived((boss as any).isHidden ?? false);
	const isBurrowed = $derived((boss as any).isBurrowed ?? false);

	// Leap cooldown as ms timestamp — RabidDogRig watches this for changes to trigger leap anim
	const leapCooldownMs = $derived(
		boss.bossType === 'rabid_dog' && (boss as any).ability1CooldownUntil
			? Number((boss as any).ability1CooldownUntil.microsSinceUnixEpoch) / 1000
			: 0
	);

	// Ice ball cooldown as ms timestamp — BossRig watches this for changes to trigger cast_1 anim
	const iceBallCooldownMs = $derived(
		boss.bossType === 'ghost_dragon' && (boss as any).ability2CooldownUntil
			? Number((boss as any).ability2CooldownUntil.microsSinceUnixEpoch) / 1000
			: 0
	);

	let attackPhase = $state(0);
	let attackCycle = 0;

	useTask((dt) => {
		nowMs = Date.now();
		const age = nowMs - spawnTimeMs;
		if (age < SPAWN_DURATION) spawnT = Math.min(1, age / SPAWN_DURATION);
		else spawnT = 1;

		if (!boss.isAlive && deathAt === null) deathAt = nowMs;
		if (boss.isAlive && deathAt !== null) deathAt = null;

		const LERP = 1 - Math.pow(0.0001, dt);
		const prevX = displayX;
		const prevZ = displayZ;
		displayX += (targetX - displayX) * LERP;
		displayZ += (targetZ - displayZ) * LERP;
		const dx = displayX - prevX;
		const dz = displayZ - prevZ;
		const moveSpeed = Math.hypot(dx, dz) / Math.max(dt, 0.0001);
		speed = deathAt ? 0 : moveSpeed;
		if (moveSpeed > 0.02) facing = Math.atan2(dx, dz) + Math.PI;
		if (!deathAt && speed < 0.8) {
			attackCycle += dt * 0.35;
		} else {
			attackCycle = 0;
		}
		attackPhase = Math.max(0, Math.sin(attackCycle * Math.PI * 2));
	});

	const dead = $derived(deathAt !== null);
	const dazed = $derived(
		boss.isDazed &&
			(boss.dazedUntil ? Number(boss.dazedUntil.microsSinceUnixEpoch) / 1000 > nowMs : true)
	);
	const bossDropY = $derived((1 - spawnT) * 18);
	const DEAD_PERSIST_MS = 5000;
	const expired = $derived(dead && nowMs - (deathAt ?? nowMs) >= DEAD_PERSIST_MS);
</script>

{#if !expired}
	<T.Group
		position={[displayX, bossDropY, displayZ]}
		rotation={[0, facing, 0]}
		scale={cubicOut(spawnT)}
	>
		<T.Group scale={isEnraged ? 1.3 : 1.0}>
			{#if boss.bossType === 'ghost_dragon'}
				<BossRig
					{speed}
					{attackPhase}
					isDead={dead}
					isDazed={dazed}
					{isHidden}
					bossX={displayX}
					bossZ={displayZ}
					{iceBallCooldownMs}
				/>
			{:else if boss.bossType === 'worm_monster'}
				<WormMonsterRig
					{speed}
					{attackPhase}
					isDead={dead}
					isDazed={dazed}
					{isBurrowed}
					bossX={displayX}
					bossZ={displayZ}
				/>
			{:else if boss.bossType === 'rabid_dog'}
				<RabidDogRig
					{speed}
					{attackPhase}
					isDead={dead}
					isDazed={dazed}
					bossX={displayX}
					bossZ={displayZ}
					{leapCooldownMs}
				/>
			{:else if boss.bossType === 'scp_096'}
				<Scp096Rig
					{speed}
					{attackPhase}
					isDead={dead}
					isDazed={dazed}
					{isEnraged}
					bossX={displayX}
					bossZ={displayZ}
				/>
			{/if}

			<!-- Ghost Dragon: faint blue aura when hidden (visible even though model is not) -->
			{#if isHidden}
				<T.Mesh position={[0, 2.5, 0]}>
					<T.SphereGeometry args={[1.8, 10, 6]} />
					<T.MeshBasicMaterial
						color="#88aaff"
						transparent
						opacity={0.08}
						blending={THREE.AdditiveBlending}
						depthWrite={false}
					/>
				</T.Mesh>
			{/if}

			<!-- Enrage aura (all bosses) -->
			{#if isEnraged}
				<T.Mesh position={[0, 2.5, 0]}>
					<T.SphereGeometry args={[2.2, 12, 8]} />
					<T.MeshBasicMaterial
						color="#ff2200"
						transparent
						opacity={0.2}
						blending={THREE.AdditiveBlending}
						depthWrite={false}
						side={THREE.DoubleSide}
					/>
				</T.Mesh>
				<T.Mesh position={[0, 2.5, 0]}>
					<T.SphereGeometry args={[2.6, 10, 6]} />
					<T.MeshBasicMaterial
						color="#ff4400"
						transparent
						opacity={0.08}
						blending={THREE.AdditiveBlending}
						depthWrite={false}
						side={THREE.BackSide}
					/>
				</T.Mesh>
			{/if}
		</T.Group>
	</T.Group>
{/if}
