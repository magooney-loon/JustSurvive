<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import * as THREE from 'three';
	import type { PlayerState } from '$bindings/types.js';
	import {
		spotterFlash,
		SPOTTER_FLASH_MS,
		steadyShotFlash,
		STEADY_SHOT_FLASH_MS
	} from '$lib/stores/abilities.svelte.js';

	type Props = { x: number; z: number; yaw: number; player: PlayerState; isLocal: boolean };
	let { x, z, yaw, player, isLocal }: Props = $props();

	let now = $state(Date.now());
	useTask(() => {
		now = Date.now();
	});

	const flashUntil = $derived.by(() => {
		if (isLocal && spotterFlash.active) return spotterFlash.until;
		const ts = (player as any).lastFlashAt;
		if (!ts) return 0;
		return Number(ts.microsSinceUnixEpoch) / 1000 + SPOTTER_FLASH_MS;
	});

	const shotUntil = $derived.by(() => {
		if (isLocal) return steadyShotFlash.until;
		const ts = (player as any).lastShotAt;
		if (!ts) return 0;
		return Number(ts.microsSinceUnixEpoch) / 1000 + STEADY_SHOT_FLASH_MS;
	});

	const ft = $derived(Math.max(0, (flashUntil - now) / SPOTTER_FLASH_MS));
	const st = $derived(Math.max(0, (shotUntil - now) / STEADY_SHOT_FLASH_MS));

	const effectiveFlashYaw = $derived(isLocal && spotterFlash.active ? spotterFlash.yaw : yaw);
	const coneOffset = 2.5;
	const cx = $derived(x - Math.sin(effectiveFlashYaw) * coneOffset);
	const cz = $derived(z - Math.cos(effectiveFlashYaw) * coneOffset);
	const coneQ = $derived(
		new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, -effectiveFlashYaw, 0))
	);
</script>

{#if ft > 0}
	<T.Mesh
		position={[cx, 0.8, cz]}
		quaternion={[coneQ.x, coneQ.y, coneQ.z, coneQ.w]}
		scale={0.5 + ft * 0.15}
	>
		<T.ConeGeometry args={[2, 4, 12, 1, true]} />
		<T.MeshBasicMaterial
			color="#22ddff"
			transparent
			opacity={ft * 0.5}
			blending={THREE.AdditiveBlending}
			side={THREE.DoubleSide}
			depthWrite={false}
		/>
	</T.Mesh>
{/if}

{#if st > 0}
	<T.Mesh position={[x, 1.0, z]} scale={0.15 + (1 - st) * 0.25}>
		<T.SphereGeometry args={[1, 8, 6]} />
		<T.MeshBasicMaterial
			color="#ffe066"
			transparent
			opacity={st * 0.9}
			blending={THREE.AdditiveBlending}
			depthWrite={false}
		/>
	</T.Mesh>
	<T.Mesh position={[x, 1.0, z]} scale={0.35 + (1 - st) * 0.5}>
		<T.SphereGeometry args={[1, 8, 6]} />
		<T.MeshBasicMaterial
			color="#ffffff"
			transparent
			opacity={st * 0.4}
			blending={THREE.AdditiveBlending}
			depthWrite={false}
		/>
	</T.Mesh>
{/if}
