<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { untrack } from 'svelte';
	import type { Enemy } from '../module_bindings/types.js';
	import StickRig from './StickRig.svelte';

	type Props = { enemy: Enemy };
	let { enemy }: Props = $props();

	let displayX = $state(untrack(() => Number(enemy.posX) / 1000));
	let displayZ = $state(untrack(() => Number(enemy.posZ) / 1000));
	let facing = $state(0);
	let walkPhase = $state(0);
	let speed = $state(0);

	const targetX = $derived(Number(enemy.posX) / 1000);
	const targetZ = $derived(Number(enemy.posZ) / 1000);

	const ENEMY_COLORS: Record<string, string> = {
		basic: '#c33',
		fast: '#f73',
		brute: '#833',
		spitter: '#3c3'
	};

	let pulse = $state(1);
	let t = 0;
	useTask((dt) => {
		const LERP = 1 - Math.pow(0.0001, dt);
		const prevX = displayX;
		const prevZ = displayZ;
		displayX += (targetX - displayX) * LERP;
		displayZ += (targetZ - displayZ) * LERP;
		const dx = displayX - prevX;
		const dz = displayZ - prevZ;
		const moveSpeed = Math.hypot(dx, dz) / Math.max(dt, 0.0001);
		speed = moveSpeed;
		if (moveSpeed > 0.02) {
			facing = Math.atan2(dx, dz) + Math.PI;
		}
		walkPhase += dt * (1.2 + moveSpeed * 2.4);
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
</script>

<T.Group position={[displayX, 0, displayZ]} rotation={[0, facing, 0]}>
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
		<T.Mesh position={[0, 1.35, -0.05]}>
			<T.BoxGeometry args={[0.7, 0.18, 0.32]} />
			<T.MeshStandardMaterial color="#4a1f1f" />
		</T.Mesh>
		<T.Mesh position={[-0.25, 1.55, -0.05]} rotation={[0, 0.2, 0]}>
			<T.ConeGeometry args={[0.08, 0.26, 6]} />
			<T.MeshStandardMaterial color="#5c2a2a" />
		</T.Mesh>
		<T.Mesh position={[0.25, 1.55, -0.05]} rotation={[0, -0.2, 0]}>
			<T.ConeGeometry args={[0.08, 0.26, 6]} />
			<T.MeshStandardMaterial color="#5c2a2a" />
		</T.Mesh>
	{:else if enemy.enemyType === 'fast'}
		<!-- Fast fins + lean head crest -->
		<T.Mesh position={[0, 1.52, -0.02]} rotation={[0.2, 0, 0]}>
			<T.ConeGeometry args={[0.06, 0.36, 6]} />
			<T.MeshStandardMaterial color="#f99" />
		</T.Mesh>
		<T.Mesh position={[0, 1.15, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
			<T.ConeGeometry args={[0.05, 0.4, 6]} />
			<T.MeshStandardMaterial color="#f77" />
		</T.Mesh>
	{:else if enemy.enemyType === 'spitter'}
		<!-- Spitter bulb + dorsal sac -->
		<T.Mesh position={[0, 1.3, 0.22]}>
			<T.SphereGeometry args={[0.18, 8, 6]} />
			<T.MeshStandardMaterial color="#2f7a2f" />
		</T.Mesh>
		<T.Mesh position={[0, 1.0, 0.25]} rotation={[Math.PI / 2, 0, 0]}>
			<T.CylinderGeometry args={[0.08, 0.14, 0.5, 6]} />
			<T.MeshStandardMaterial color="#2b6a2b" />
		</T.Mesh>
	{:else}
		<!-- Basic: head horns -->
		<T.Mesh position={[-0.14, 1.64, 0]} rotation={[0, 0, -0.3]}>
			<T.ConeGeometry args={[0.05, 0.2, 6]} />
			<T.MeshStandardMaterial color="#c77" />
		</T.Mesh>
		<T.Mesh position={[0.14, 1.64, 0]} rotation={[0, 0, 0.3]}>
			<T.ConeGeometry args={[0.05, 0.2, 6]} />
			<T.MeshStandardMaterial color="#c77" />
		</T.Mesh>
	{/if}

	{#if enemy.isMarked}
		<!-- Mark ring above enemy -->
		<T.Mesh position={[0, 2.2, 0]} rotation={[Math.PI / 4, 0, 0]} scale={[pulse, pulse, pulse]}>
			<T.TorusGeometry args={[0.4, 0.07, 6, 4]} />
			<T.MeshBasicMaterial color="#f84" />
		</T.Mesh>
		<!-- Stem -->
		<T.Mesh position={[0, 1.6, 0]}>
			<T.CylinderGeometry args={[0.03, 0.03, 1, 4]} />
			<T.MeshBasicMaterial color="#f84" />
		</T.Mesh>
	{/if}
</T.Group>
