<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import * as THREE from 'three';
	import { useTable, useSpacetimeDB } from 'spacetimedb/svelte';
	import { tables } from '$bindings/index.js';
	import { lobbyState } from '$lib/stores/lobby.svelte.js';
	import {
		healBeam,
		HEAL_BEAM_MS,
		spotterFlash,
		SPOTTER_FLASH_MS
	} from '$lib/stores/abilities.svelte.js';
	import { localPos } from '$lib/stores/movement.svelte.js';

	const conn = useSpacetimeDB();
	const [players] = useTable(tables.playerState);

	const beamGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 6);
	const beamMat = new THREE.MeshBasicMaterial({
		color: '#ffffff',
		transparent: true,
		depthWrite: false,
		blending: THREE.AdditiveBlending
	});
	const glowGeo = new THREE.CylinderGeometry(0.1, 0.1, 1, 8);
	const glowMat = new THREE.MeshBasicMaterial({
		color: '#ff88cc',
		transparent: true,
		depthWrite: false,
		blending: THREE.AdditiveBlending,
		side: THREE.BackSide
	});
	const impactGeo = new THREE.SphereGeometry(0.22, 8, 6);
	const impactMat = new THREE.MeshBasicMaterial({
		color: '#ff88cc',
		transparent: true,
		depthWrite: false,
		blending: THREE.AdditiveBlending
	});

	const flashGeo = new THREE.ConeGeometry(4, 12, 16, 1, true);
	const flashMat = new THREE.MeshBasicMaterial({
		color: '#22ddff',
		transparent: true,
		opacity: 0.5,
		side: THREE.DoubleSide,
		depthWrite: false,
		blending: THREE.AdditiveBlending
	});

	const _yAxis = new THREE.Vector3(0, 1, 0);
	const BEAM_Y = 1.1;

	let healBeams = $state<
		{ fromX: number; fromZ: number; toX: number; toZ: number; until: number }[]
	>([]);
	let flashEffects = $state<{ x: number; z: number; yaw: number; until: number }[]>([]);

	useTask(() => {
		const now = Date.now();
		const sessId = lobbyState.currentSessionId;
		if (!sessId) return;

		const allPlayers = $players ?? [];
		const beams: typeof healBeams = [];
		const flashes: typeof flashEffects = [];

		for (const p of allPlayers) {
			if (p.sessionId !== sessId) continue;

			// Heal beam for healers
			if (p.classChoice === 'healer' && (p as any).lastHealAt && (p as any).healTargetIdentity) {
				const lastHeal = (p as any).lastHealAt;
				const healUntil = Number(lastHeal?.microsSinceUnixEpoch ?? 0) / 1000 + HEAL_BEAM_MS;
				if (now < healUntil) {
					// Find target position
					const target = allPlayers.find(
						(tp) =>
							tp.sessionId === sessId && tp.playerIdentity.isEqual((p as any).healTargetIdentity)
					);
					if (target) {
						beams.push({
							fromX: Number(p.posX) / 1000,
							fromZ: Number(p.posZ) / 1000,
							toX: Number(target.posX) / 1000,
							toZ: Number(target.posZ) / 1000,
							until: healUntil
						});
					}
				}
			}

			// Flash effect for spotters
			if (p.classChoice === 'spotter' && (p as any).lastFlashAt) {
				const lastFlash = (p as any).lastFlashAt;
				const flashUntil = Number(lastFlash?.microsSinceUnixEpoch ?? 0) / 1000 + SPOTTER_FLASH_MS;
				if (now < flashUntil) {
					flashes.push({
						x: Number(p.posX) / 1000,
						z: Number(p.posZ) / 1000,
						yaw: Number(p.facingAngle) / 1000,
						until: flashUntil
					});
				}
			}
		}

		healBeams = beams;
		flashEffects = flashes;

		// Add local player optimistic effects (use existing 'now' from useTask)

		// Local heal beam
		if (healBeam.active && healBeam.until > now) {
			beams.push({
				fromX: localPos.x,
				fromZ: localPos.z,
				toX: healBeam.toX,
				toZ: healBeam.toZ,
				until: healBeam.until
			});
		}

		// Local spotter flash
		if (spotterFlash.active && spotterFlash.until > now) {
			flashes.push({
				x: localPos.x,
				z: localPos.z,
				yaw: spotterFlash.yaw,
				until: spotterFlash.until
			});
		}
	});
</script>

{#each healBeams as beam}
	{@const now = Date.now()}
	{@const t = now < beam.until ? 1 - (now - (beam.until - HEAL_BEAM_MS)) / HEAL_BEAM_MS : 0}
	{#if t > 0}
		{@const dx = beam.toX - beam.fromX}
		{@const dz = beam.toZ - beam.fromZ}
		{@const len = Math.sqrt(dx * dx + dz * dz)}
		{#if len >= 0.05}
			{@const nx = dx / len}
			{@const nz = dz / len}
			{@const mx = (beam.fromX + beam.toX) / 2}
			{@const mz = (beam.fromZ + beam.toZ) / 2}
			{@const q = new THREE.Quaternion().setFromUnitVectors(_yAxis, new THREE.Vector3(nx, 0, nz))}
			{@const xScale = 0.4 + t * 0.6}
			<T.Mesh
				position={[mx, BEAM_Y, mz]}
				quaternion={[q.x, q.y, q.z, q.w]}
				scale={[xScale, len, xScale]}
				geometry={beamGeo}
				material={beamMat}
				material-opacity={t * 0.95}
			/>
			<T.Mesh
				position={[mx, BEAM_Y, mz]}
				quaternion={[q.x, q.y, q.z, q.w]}
				scale={[xScale * 2.5, len, xScale * 2.5]}
				geometry={glowGeo}
				material={glowMat}
				material-opacity={t * 0.35}
			/>
			<T.Mesh
				position={[beam.toX, BEAM_Y, beam.toZ]}
				scale={0.6 + (1 - t) * 1.2}
				geometry={impactGeo}
				material={impactMat}
				material-opacity={t * 0.8}
			/>
		{/if}
	{/if}
{/each}

{#each flashEffects as flash}
	{@const t = Math.max(0, (flash.until - Date.now()) / SPOTTER_FLASH_MS)}
	{#if t > 0}
		<T.Mesh
			position={[flash.x, 1.0, flash.z]}
			rotation={[0, -flash.yaw + Math.PI / 2, 0]}
			geometry={flashGeo}
			material={flashMat}
			material-opacity={t * 0.5}
		/>
	{/if}
{/each}

{#each flashEffects as flash}
	{@const t = Math.max(0, (flash.until - Date.now()) / SPOTTER_FLASH_MS)}
	{#if t > 0}
		<T.Mesh
			position={[flash.x, 1.0, flash.z]}
			rotation={[0, -flash.yaw + Math.PI / 2, 0]}
			geometry={flashGeo}
			material={flashMat}
			material-opacity={t * 0.5}
			visible={true}
		/>
	{/if}
{/each}
