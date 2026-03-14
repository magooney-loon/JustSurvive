<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import * as THREE from 'three';
	import type { PlayerState } from '$bindings/types.js';
	import { axeSwingFlash, AXE_SWING_FLASH_MS } from '$lib/stores/abilities.svelte.js';

	type Props = { x: number; z: number; yaw: number; player: PlayerState; isLocal: boolean };
	let { x, z, yaw, player, isLocal }: Props = $props();

	let now = $state(Date.now());
	useTask(() => {
		now = Date.now();
	});

	const swingUntil = $derived.by(() => {
		if (isLocal && axeSwingFlash.active) return axeSwingFlash.until;
		const ts = (player as any).lastFlashAt;
		if (!ts) return 0;
		return Number(ts.microsSinceUnixEpoch) / 1000 + AXE_SWING_FLASH_MS;
	});

	const t = $derived(Math.max(0, (swingUntil - now) / AXE_SWING_FLASH_MS));
	const effectiveYaw = $derived(isLocal && axeSwingFlash.active ? axeSwingFlash.yaw : yaw);

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
