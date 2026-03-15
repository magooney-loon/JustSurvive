<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import * as THREE from 'three';
	import type { PlayerState } from '$bindings/types.js';
	import { useTable } from 'spacetimedb/svelte';
	import { tables } from '$bindings/index.js';
	import { abilityState, ultimateFlash, ULTIMATE_FLASH_MS } from '$lib/stores/abilities.svelte.js';

	type Props = { x: number; z: number; isLocal: boolean; player: PlayerState };
	let { x, z, isLocal, player }: Props = $props();

	const [gunnerStates] = useTable(tables.gunnerState);

	let now = $state(Date.now());
	let time = $state(0);
	useTask((dt) => {
		now = Date.now();
		time += dt;
	});

	const myGunnerState = $derived(
		$gunnerStates.find((g) => g.playerIdentity.toHexString() === player.playerIdentity.toHexString())
	);

	// Adrenaline: 180ms burst effect
	const ADRENALINE_VFX_MS = 180;
	const adrenalineUntil = $derived.by(() => {
		if (isLocal) return abilityState.adrenalineUntil;
		if (!myGunnerState?.lastAdrenalineAt) return 0;
		return Number(myGunnerState.lastAdrenalineAt.microsSinceUnixEpoch) / 1000 + ADRENALINE_VFX_MS;
	});
	const adrenalineT = $derived(Math.max(0, (adrenalineUntil - now) / ADRENALINE_VFX_MS));
	const pulse = $derived(0.8 + 0.2 * Math.sin(time * 25));

	// ─── Frenzy ultimate ──────────────────────────────────────────────────────
	const ultimateUntil = $derived.by(() => {
		if (isLocal) return ultimateFlash.until;
		if (!myGunnerState?.lastUltimateAt) return 0;
		return Number(myGunnerState.lastUltimateAt.microsSinceUnixEpoch) / 1000 + ULTIMATE_FLASH_MS;
	});
	const ut = $derived(Math.max(0, (ultimateUntil - now) / ULTIMATE_FLASH_MS));

	const FRENZY_R = 15;
	const frenzySpokes = $derived(
		Array.from({ length: 12 }, (_, i) => {
			const angle = (i / 12) * Math.PI * 2;
			return {
				px: x - Math.sin(angle) * FRENZY_R * 0.5,
				pz: z - Math.cos(angle) * FRENZY_R * 0.5,
				angle
			};
		})
	);
</script>

{#if adrenalineT > 0}
	<!-- Inner orange core burst -->
	<T.Mesh position={[x, 1.0, z]} scale={0.2 + (1 - adrenalineT) * 0.5}>
		<T.SphereGeometry args={[1, 8, 6]} />
		<T.MeshBasicMaterial
			color="#ff6600"
			transparent
			opacity={adrenalineT * 0.9 * pulse}
			blending={THREE.AdditiveBlending}
			depthWrite={false}
		/>
	</T.Mesh>
	<!-- Outer amber halo -->
	<T.Mesh position={[x, 1.0, z]} scale={0.45 + (1 - adrenalineT) * 0.7}>
		<T.SphereGeometry args={[1, 8, 6]} />
		<T.MeshBasicMaterial
			color="#ffaa00"
			transparent
			opacity={adrenalineT * 0.4 * pulse}
			blending={THREE.AdditiveBlending}
			depthWrite={false}
		/>
	</T.Mesh>
	<!-- Speed ring on ground -->
	<T.Mesh
		position={[x, 0.05, z]}
		rotation={[-Math.PI / 2, 0, time * 8]}
		scale={0.6 + (1 - adrenalineT) * 0.8}
	>
		<T.RingGeometry args={[0.3, 0.55, 16]} />
		<T.MeshBasicMaterial
			color="#ffcc44"
			transparent
			opacity={adrenalineT * 0.6}
			blending={THREE.AdditiveBlending}
			depthWrite={false}
		/>
	</T.Mesh>
{/if}

{#if ut > 0}
	<!-- Frenzy: 12 orange radial spokes -->
	{#each frenzySpokes as s}
		<T.Mesh position={[s.px, 1.0, s.pz]} rotation={[0, s.angle, 0]}>
			<T.BoxGeometry args={[0.05, 0.05, FRENZY_R]} />
			<T.MeshBasicMaterial
				color="#ff5500"
				transparent
				opacity={ut * 0.85}
				blending={THREE.AdditiveBlending}
				depthWrite={false}
			/>
		</T.Mesh>
		<T.Mesh position={[s.px, 1.0, s.pz]} rotation={[0, s.angle, 0]}>
			<T.BoxGeometry args={[0.14, 0.14, FRENZY_R * 0.5]} />
			<T.MeshBasicMaterial
				color="#ff2200"
				transparent
				opacity={ut * 0.28}
				blending={THREE.AdditiveBlending}
				depthWrite={false}
			/>
		</T.Mesh>
	{/each}
	<!-- Expanding fire ring -->
	<T.Mesh
		position={[x, 0.06, z]}
		rotation={[-Math.PI / 2, 0, 0]}
		scale={Math.max(0.1, (1 - ut) * FRENZY_R)}
	>
		<T.RingGeometry args={[0.82, 1, 32]} />
		<T.MeshBasicMaterial
			color="#ff4400"
			transparent
			opacity={ut * 0.75}
			blending={THREE.AdditiveBlending}
			depthWrite={false}
		/>
	</T.Mesh>
	<!-- Faster inner ring -->
	<T.Mesh
		position={[x, 0.06, z]}
		rotation={[-Math.PI / 2, 0, 0]}
		scale={Math.max(0.1, (1 - ut) * FRENZY_R * 0.55)}
	>
		<T.RingGeometry args={[0.78, 1, 32]} />
		<T.MeshBasicMaterial
			color="#ffaa00"
			transparent
			opacity={ut * 0.5}
			blending={THREE.AdditiveBlending}
			depthWrite={false}
		/>
	</T.Mesh>
	<!-- Central burst -->
	<T.Mesh position={[x, 1.0, z]} scale={0.2 + (1 - ut) * 0.6}>
		<T.SphereGeometry args={[1, 8, 6]} />
		<T.MeshBasicMaterial
			color="#ff6600"
			transparent
			opacity={ut * 0.95}
			blending={THREE.AdditiveBlending}
			depthWrite={false}
		/>
	</T.Mesh>
{/if}
