<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import * as THREE from 'three';
	import type { PlayerState } from '$bindings/types.js';
	import { useTable } from 'spacetimedb/svelte';
	import { tables } from '$bindings/index.js';
	import { axeSwingFlash, AXE_SWING_FLASH_MS, ultimateFlash, ULTIMATE_FLASH_MS } from '$lib/stores/abilities.svelte.js';

	type Props = { x: number; z: number; yaw: number; player: PlayerState; isLocal: boolean };
	let { x, z, yaw, player, isLocal }: Props = $props();

	const [tankStates] = useTable(tables.tankState);

	let now = $state(Date.now());
	useTask(() => {
		now = Date.now();
	});

	const myTankState = $derived(
		$tankStates.find((t) => t.playerIdentity.toHexString() === player.playerIdentity.toHexString())
	);

	let remoteSwingUntil = $state(0);
	let prevSwingMicros: bigint | undefined;
	$effect(() => {
		if (!isLocal) {
			const micros = myTankState?.lastAxeSwingAt?.microsSinceUnixEpoch;
			if (micros !== prevSwingMicros && micros != null) {
				remoteSwingUntil = Date.now() + AXE_SWING_FLASH_MS;
			}
			prevSwingMicros = micros;
		}
	});
	const swingUntil = $derived(isLocal && axeSwingFlash.active ? axeSwingFlash.until : remoteSwingUntil);

	const t = $derived(Math.max(0, (swingUntil - now) / AXE_SWING_FLASH_MS));
	const effectiveYaw = $derived(isLocal && axeSwingFlash.active ? axeSwingFlash.yaw : yaw);

	// ─── Ground Slam ultimate ────────────────────────────────────────────────

	let remoteUltimateUntil = $state(0);
	let prevUltimateMicros: bigint | undefined;
	$effect(() => {
		if (!isLocal) {
			const micros = myTankState?.lastUltimateAt?.microsSinceUnixEpoch;
			if (micros !== prevUltimateMicros && micros != null) {
				remoteUltimateUntil = Date.now() + ULTIMATE_FLASH_MS;
			}
			prevUltimateMicros = micros;
		}
	});
	const ultimateUntil = $derived(isLocal ? ultimateFlash.until : remoteUltimateUntil);
	const ut = $derived(Math.max(0, (ultimateUntil - now) / ULTIMATE_FLASH_MS));

	const SLAM_R = 8;
	const slamCracks = $derived(
		Array.from({ length: 8 }, (_, i) => {
			const angle = (i / 8) * Math.PI * 2;
			return {
				px: x - Math.sin(angle) * SLAM_R * 0.5,
				pz: z - Math.cos(angle) * SLAM_R * 0.5,
				angle
			};
		})
	);

	// 144° arc = ±72° from facing
	const HALF_ARC = Math.PI * 0.4;
	const OUTER_R = 2.0;
	const INNER_R = 1.0;
	const SPOKE_Y = 1.15;

	type Spoke = { px: number; pz: number; angle: number; bright: number };

	const outerSpokes = $derived<Spoke[]>(
		Array.from({ length: 9 }, (_, i) => {
			const f = i / 8;
			const angle = effectiveYaw + HALF_ARC * (f * 2 - 1);
			const bright = 1 - Math.abs(f * 2 - 1) * 0.6;
			return {
				px: x - Math.sin(angle) * OUTER_R * 0.5,
				pz: z - Math.cos(angle) * OUTER_R * 0.5,
				angle,
				bright
			};
		})
	);

	const innerSpokes = $derived<Spoke[]>(
		Array.from({ length: 5 }, (_, i) => {
			const f = i / 4;
			const angle = effectiveYaw + HALF_ARC * (f * 2 - 1);
			const bright = 1 - Math.abs(f * 2 - 1) * 0.5;
			return {
				px: x - Math.sin(angle) * INNER_R * 0.5,
				pz: z - Math.cos(angle) * INNER_R * 0.5,
				angle,
				bright
			};
		})
	);
</script>

{#if t > 0}
	<!-- Outer white fan spokes -->
	{#each outerSpokes as s}
		<T.Mesh position={[s.px, SPOKE_Y, s.pz]} rotation={[0, s.angle, 0]}>
			<T.BoxGeometry args={[0.04, 0.04, OUTER_R]} />
			<T.MeshBasicMaterial
				color="#ffffff"
				transparent
				opacity={t * s.bright * 0.9}
				blending={THREE.AdditiveBlending}
				depthWrite={false}
			/>
		</T.Mesh>
	{/each}

	<!-- Inner blue-white glow spokes (closer, wider) -->
	{#each innerSpokes as s}
		<T.Mesh position={[s.px, SPOKE_Y, s.pz]} rotation={[0, s.angle, 0]}>
			<T.BoxGeometry args={[0.08, 0.08, INNER_R]} />
			<T.MeshBasicMaterial
				color="#ddeeff"
				transparent
				opacity={t * s.bright * 0.6}
				blending={THREE.AdditiveBlending}
				depthWrite={false}
			/>
		</T.Mesh>
	{/each}

	<!-- Central bright flash at impact point -->
	<T.Mesh
		position={[x - Math.sin(effectiveYaw) * 1.6, SPOKE_Y, z - Math.cos(effectiveYaw) * 1.6]}
		scale={0.12 + (1 - t) * 0.18}
	>
		<T.SphereGeometry args={[1, 6, 4]} />
		<T.MeshBasicMaterial
			color="#ffffff"
			transparent
			opacity={t * 0.9}
			blending={THREE.AdditiveBlending}
			depthWrite={false}
		/>
	</T.Mesh>
{/if}

{#if ut > 0}
	<!-- Ground Slam: 8 radial crack lines on the ground -->
	{#each slamCracks as s}
		<T.Mesh position={[s.px, 0.04, s.pz]} rotation={[-Math.PI / 2, 0, s.angle]}>
			<T.BoxGeometry args={[0.08, SLAM_R, 0.01]} />
			<T.MeshBasicMaterial
				color="#ffffff"
				transparent
				opacity={ut * 0.7}
				blending={THREE.AdditiveBlending}
				depthWrite={false}
			/>
		</T.Mesh>
	{/each}
	<!-- White expanding shockwave ring -->
	<T.Mesh
		position={[x, 0.06, z]}
		rotation={[-Math.PI / 2, 0, 0]}
		scale={Math.max(0.1, (1 - ut) * SLAM_R)}
	>
		<T.RingGeometry args={[0.8, 1, 32]} />
		<T.MeshBasicMaterial
			color="#ffffff"
			transparent
			opacity={ut * 0.85}
			blending={THREE.AdditiveBlending}
			depthWrite={false}
		/>
	</T.Mesh>
	<!-- Blue outer ring (slightly slower) -->
	<T.Mesh
		position={[x, 0.06, z]}
		rotation={[-Math.PI / 2, 0, 0]}
		scale={Math.max(0.1, (1 - ut) * SLAM_R * 0.75)}
	>
		<T.RingGeometry args={[0.75, 1, 32]} />
		<T.MeshBasicMaterial
			color="#88ccff"
			transparent
			opacity={ut * 0.6}
			blending={THREE.AdditiveBlending}
			depthWrite={false}
		/>
	</T.Mesh>
	<!-- Ground flash -->
	<T.Mesh position={[x, 0.05, z]} rotation={[-Math.PI / 2, 0, 0]} scale={0.5 + (1 - ut) * 2.5}>
		<T.CircleGeometry args={[1, 24]} />
		<T.MeshBasicMaterial
			color="#ffffff"
			transparent
			opacity={ut * 0.4}
			blending={THREE.AdditiveBlending}
			depthWrite={false}
		/>
	</T.Mesh>
	<!-- Central upward burst -->
	<T.Mesh position={[x, 0.5 + (1 - ut) * 1.5, z]} scale={[0.3 + (1 - ut) * 0.5, 1.5, 0.3 + (1 - ut) * 0.5]}>
		<T.CylinderGeometry args={[1, 1.5, 1, 12]} />
		<T.MeshBasicMaterial
			color="#aaddff"
			transparent
			opacity={ut * 0.6}
			blending={THREE.AdditiveBlending}
			depthWrite={false}
		/>
	</T.Mesh>
{/if}
