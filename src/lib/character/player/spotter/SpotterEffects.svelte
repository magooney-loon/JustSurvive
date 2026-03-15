<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import * as THREE from 'three';
	import type { PlayerState } from '$bindings/types.js';
	import { useTable } from 'spacetimedb/svelte';
	import { tables } from '$bindings/index.js';
	import {
		spotterFlash,
		SPOTTER_FLASH_MS,
		steadyShotFlash,
		STEADY_SHOT_FLASH_MS,
		ultimateFlash,
		ULTIMATE_FLASH_MS
	} from '$lib/stores/abilities.svelte.js';

	type Props = { x: number; z: number; yaw: number; player: PlayerState; isLocal: boolean };
	let { x, z, yaw, player, isLocal }: Props = $props();

	const [spotterStates] = useTable(tables.spotterState);

	let now = $state(Date.now());
	useTask(() => {
		now = Date.now();
	});

	// ─── Flash stun cone ────────────────────────────────────────────────────────

	const mySpotterState = $derived(
		$spotterStates.find((s) => s.playerIdentity.toHexString() === player.playerIdentity.toHexString())
	);

	const flashUntil = $derived.by(() => {
		if (isLocal && spotterFlash.active) return spotterFlash.until;
		if (!mySpotterState?.lastFlashAt) return 0;
		return Number(mySpotterState.lastFlashAt.microsSinceUnixEpoch) / 1000 + SPOTTER_FLASH_MS;
	});

	const ft = $derived(Math.max(0, (flashUntil - now) / SPOTTER_FLASH_MS));
	const effectiveFlashYaw = $derived(isLocal && spotterFlash.active ? spotterFlash.yaw : yaw);

	// 7 spokes in a 90° arc
	const FLASH_HALF_ARC = Math.PI * 0.25;
	const FLASH_R = 2.5;
	type Spoke = { px: number; pz: number; angle: number; bright: number };
	const flashSpokes = $derived<Spoke[]>(
		Array.from({ length: 7 }, (_, i) => {
			const f = i / 6;
			const angle = effectiveFlashYaw + FLASH_HALF_ARC * (f * 2 - 1);
			const bright = 1 - Math.abs(f * 2 - 1) * 0.5;
			return {
				px: x - Math.sin(angle) * FLASH_R * 0.5,
				pz: z - Math.cos(angle) * FLASH_R * 0.5,
				angle,
				bright
			};
		})
	);

	// ─── Steady shot railbeam ────────────────────────────────────────────────────

	const shotUntil = $derived.by(() => {
		if (isLocal) return steadyShotFlash.until;
		const ts = (player as any).lastShotAt;
		if (!ts) return 0;
		return Number(ts.microsSinceUnixEpoch) / 1000 + STEADY_SHOT_FLASH_MS;
	});

	const st = $derived(Math.max(0, (shotUntil - now) / STEADY_SHOT_FLASH_MS));
	const effectiveShotYaw = $derived(
		isLocal && steadyShotFlash.until > now ? steadyShotFlash.yaw : yaw
	);

	// ─── Barrage ultimate ──────────────────────────────────────────────────────

	const ultimateUntil = $derived.by(() => {
		if (isLocal) return ultimateFlash.until;
		if (!mySpotterState?.lastUltimateAt) return 0;
		return Number(mySpotterState.lastUltimateAt.microsSinceUnixEpoch) / 1000 + ULTIMATE_FLASH_MS;
	});
	const ut = $derived(Math.max(0, (ultimateUntil - now) / ULTIMATE_FLASH_MS));

	const BARRAGE_R = 15;
	const barrageSpokes = $derived(
		Array.from({ length: 16 }, (_, i) => {
			const angle = (i / 16) * Math.PI * 2;
			return {
				px: x - Math.sin(angle) * BARRAGE_R * 0.5,
				pz: z - Math.cos(angle) * BARRAGE_R * 0.5,
				angle
			};
		})
	);

	const BEAM_LEN = 15;
	const beamMx = $derived(x - Math.sin(effectiveShotYaw) * BEAM_LEN * 0.5);
	const beamMz = $derived(z - Math.cos(effectiveShotYaw) * BEAM_LEN * 0.5);
	const impactX = $derived(x - Math.sin(effectiveShotYaw) * BEAM_LEN);
	const impactZ = $derived(z - Math.cos(effectiveShotYaw) * BEAM_LEN);
	const beamQ = $derived(
		new THREE.Quaternion().setFromUnitVectors(
			new THREE.Vector3(0, 1, 0),
			new THREE.Vector3(-Math.sin(effectiveShotYaw), 0, -Math.cos(effectiveShotYaw))
		)
	);
</script>

{#if ft > 0}
	<!-- Electric cyan fan spokes -->
	{#each flashSpokes as s}
		<T.Mesh position={[s.px, 0.9, s.pz]} rotation={[0, s.angle, 0]}>
			<T.BoxGeometry args={[0.03, 0.03, FLASH_R]} />
			<T.MeshBasicMaterial
				color="#22ffff"
				transparent
				opacity={ft * s.bright * 0.95}
				blending={THREE.AdditiveBlending}
				depthWrite={false}
			/>
		</T.Mesh>
	{/each}
	<!-- Wider inner glow on alternating spokes -->
	{#each flashSpokes.filter((_, i) => i % 2 === 1) as s}
		<T.Mesh position={[s.px, 0.9, s.pz]} rotation={[0, s.angle, 0]}>
			<T.BoxGeometry args={[0.08, 0.08, FLASH_R * 0.7]} />
			<T.MeshBasicMaterial
				color="#88eeff"
				transparent
				opacity={ft * s.bright * 0.5}
				blending={THREE.AdditiveBlending}
				depthWrite={false}
			/>
		</T.Mesh>
	{/each}
	<!-- Center electric discharge -->
	<T.Mesh position={[x, 0.9, z]} scale={0.08 + (1 - ft) * 0.12}>
		<T.SphereGeometry args={[1, 8, 6]} />
		<T.MeshBasicMaterial
			color="#ffffff"
			transparent
			opacity={ft * 0.95}
			blending={THREE.AdditiveBlending}
			depthWrite={false}
		/>
	</T.Mesh>
{/if}

{#if ut > 0}
	<!-- Barrage: 16 golden laser beams radiating 360° -->
	{#each barrageSpokes as s}
		<T.Mesh position={[s.px, 1.1, s.pz]} rotation={[0, s.angle, 0]}>
			<T.BoxGeometry args={[0.04, 0.04, BARRAGE_R]} />
			<T.MeshBasicMaterial
				color="#ffe033"
				transparent
				opacity={ut * 0.9}
				blending={THREE.AdditiveBlending}
				depthWrite={false}
			/>
		</T.Mesh>
		<T.Mesh position={[s.px, 1.1, s.pz]} rotation={[0, s.angle, 0]}>
			<T.BoxGeometry args={[0.12, 0.12, BARRAGE_R * 0.6]} />
			<T.MeshBasicMaterial
				color="#ffaa00"
				transparent
				opacity={ut * 0.35}
				blending={THREE.AdditiveBlending}
				depthWrite={false}
			/>
		</T.Mesh>
	{/each}
	<!-- Expanding ring at beam tips -->
	<T.Mesh
		position={[x, 0.06, z]}
		rotation={[-Math.PI / 2, 0, 0]}
		scale={Math.max(0.1, (1 - ut) * BARRAGE_R)}
	>
		<T.RingGeometry args={[0.88, 1, 32]} />
		<T.MeshBasicMaterial
			color="#ffe033"
			transparent
			opacity={ut * 0.6}
			blending={THREE.AdditiveBlending}
			depthWrite={false}
		/>
	</T.Mesh>
	<!-- White core burst -->
	<T.Mesh position={[x, 1.1, z]} scale={0.15 + (1 - ut) * 0.4}>
		<T.SphereGeometry args={[1, 8, 6]} />
		<T.MeshBasicMaterial
			color="#ffffff"
			transparent
			opacity={ut * 0.95}
			blending={THREE.AdditiveBlending}
			depthWrite={false}
		/>
	</T.Mesh>
{/if}

{#if st > 0}
	<!-- Rail beam core — yellow/white -->
	<T.Mesh
		position={[beamMx, 1.1, beamMz]}
		quaternion={[beamQ.x, beamQ.y, beamQ.z, beamQ.w]}
		scale={[0.03, BEAM_LEN, 0.03]}
	>
		<T.CylinderGeometry args={[1, 1, 1, 6]} />
		<T.MeshBasicMaterial
			color="#ffe066"
			transparent
			opacity={st * 0.95}
			blending={THREE.AdditiveBlending}
			depthWrite={false}
		/>
	</T.Mesh>
	<!-- Rail beam outer glow — cyan -->
	<T.Mesh
		position={[beamMx, 1.1, beamMz]}
		quaternion={[beamQ.x, beamQ.y, beamQ.z, beamQ.w]}
		scale={[0.1, BEAM_LEN, 0.1]}
	>
		<T.CylinderGeometry args={[1, 1, 1, 6]} />
		<T.MeshBasicMaterial
			color="#22ccff"
			transparent
			opacity={st * 0.35}
			blending={THREE.AdditiveBlending}
			depthWrite={false}
		/>
	</T.Mesh>
	<!-- Muzzle flash at origin -->
	<T.Mesh position={[x, 1.1, z]} scale={0.12 + (1 - st) * 0.08}>
		<T.SphereGeometry args={[1, 6, 4]} />
		<T.MeshBasicMaterial
			color="#ffffff"
			transparent
			opacity={st * 0.9}
			blending={THREE.AdditiveBlending}
			depthWrite={false}
		/>
	</T.Mesh>
	<!-- Impact flash at far end -->
	<T.Mesh position={[impactX, 1.1, impactZ]} scale={0.1 + (1 - st) * 0.2}>
		<T.SphereGeometry args={[1, 6, 4]} />
		<T.MeshBasicMaterial
			color="#ffe066"
			transparent
			opacity={st * 0.85}
			blending={THREE.AdditiveBlending}
			depthWrite={false}
		/>
	</T.Mesh>
{/if}
