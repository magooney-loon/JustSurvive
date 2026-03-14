<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import * as THREE from 'three';
	import type { PlayerState } from '$bindings/types.js';
	import { healBeam, HEAL_BEAM_MS } from '$lib/stores/abilities.svelte.js';
	import { localPos } from '$lib/stores/movement.svelte.js';

	type Props = {
		x: number;
		z: number;
		player: PlayerState;
		isLocal: boolean;
		allPlayers: readonly PlayerState[];
		sessionId: bigint;
		isReviving: boolean;
	};
	let { x, z, player, isLocal, allPlayers, sessionId, isReviving }: Props = $props();

	const _yAxis = new THREE.Vector3(0, 1, 0);
	const BEAM_Y = 1.1;

	let now = $state(Date.now());
	let time = $state(0);
	useTask((dt) => {
		now = Date.now();
		time += dt;
	});

	type Beam = { fromX: number; fromZ: number; toX: number; toZ: number; until: number };

	const activeBeam = $derived.by((): Beam | null => {
		// Local: use optimistic store
		if (isLocal && healBeam.active && healBeam.until > now) {
			return { fromX: localPos.x, fromZ: localPos.z, toX: healBeam.toX, toZ: healBeam.toZ, until: healBeam.until };
		}
		// Remote: derive from server timestamp + healTargetIdentity
		const lastHealAt = (player as any).lastHealAt;
		const healTargetIdentity = (player as any).healTargetIdentity;
		if (!lastHealAt || !healTargetIdentity) return null;
		const until = Number(lastHealAt.microsSinceUnixEpoch) / 1000 + HEAL_BEAM_MS;
		if (now >= until) return null;
		const target = allPlayers.find(
			(p) => p.sessionId === sessionId && p.playerIdentity.isEqual(healTargetIdentity)
		);
		if (!target) return null;
		return {
			fromX: x,
			fromZ: z,
			toX: Number(target.posX) / 1000,
			toZ: Number(target.posZ) / 1000,
			until
		};
	});

	const beamT = $derived(activeBeam ? Math.max(0, (activeBeam.until - now) / HEAL_BEAM_MS) : 0);

	const beamDx = $derived(activeBeam ? activeBeam.toX - activeBeam.fromX : 0);
	const beamDz = $derived(activeBeam ? activeBeam.toZ - activeBeam.fromZ : 0);
	const beamLen = $derived(Math.sqrt(beamDx * beamDx + beamDz * beamDz));
	const beamMx = $derived(activeBeam ? (activeBeam.fromX + activeBeam.toX) / 2 : 0);
	const beamMz = $derived(activeBeam ? (activeBeam.fromZ + activeBeam.toZ) / 2 : 0);
	const beamQ = $derived(
		beamLen > 0.1
			? new THREE.Quaternion().setFromUnitVectors(
					_yAxis,
					new THREE.Vector3(beamDx / beamLen, 0, beamDz / beamLen)
				)
			: new THREE.Quaternion()
	);

	// Revive channeling ring — pulsing green ring around healer while reviving
	const revivePulse = $derived(0.7 + 0.3 * Math.sin(time * 5));
</script>

{#if activeBeam && beamT > 0 && beamLen > 0.1}
	<T.Mesh
		position={[beamMx, BEAM_Y, beamMz]}
		quaternion={[beamQ.x, beamQ.y, beamQ.z, beamQ.w]}
		scale={[0.06, beamLen, 0.06]}
	>
		<T.CylinderGeometry args={[1, 1, 1, 8]} />
		<T.MeshBasicMaterial
			color="#ffffff"
			transparent
			opacity={beamT * 0.85}
			blending={THREE.AdditiveBlending}
		/>
	</T.Mesh>
	<T.Mesh
		position={[beamMx, BEAM_Y, beamMz]}
		quaternion={[beamQ.x, beamQ.y, beamQ.z, beamQ.w]}
		scale={[0.18, beamLen, 0.18]}
	>
		<T.CylinderGeometry args={[1, 1, 1, 8]} />
		<T.MeshBasicMaterial
			color="#ff88cc"
			transparent
			opacity={beamT * 0.4}
			blending={THREE.AdditiveBlending}
			side={THREE.BackSide}
		/>
	</T.Mesh>
	<T.Mesh position={[activeBeam.toX, BEAM_Y, activeBeam.toZ]} scale={0.25 + (1 - beamT) * 0.35}>
		<T.SphereGeometry args={[1, 10, 8]} />
		<T.MeshBasicMaterial
			color="#ff88cc"
			transparent
			opacity={beamT * 0.9}
			blending={THREE.AdditiveBlending}
		/>
	</T.Mesh>
{/if}

{#if isReviving}
	<!-- Pulsing channeling ring around healer -->
	<T.Mesh
		position={[x, 0.05, z]}
		rotation={[-Math.PI / 2, 0, time * 1.2]}
		scale={revivePulse * 0.9}
	>
		<T.RingGeometry args={[0.4, 0.6, 20]} />
		<T.MeshBasicMaterial
			color="#44ff88"
			transparent
			opacity={0.55 * revivePulse}
			blending={THREE.AdditiveBlending}
			depthWrite={false}
		/>
	</T.Mesh>
	<T.Mesh
		position={[x, 0.05, z]}
		rotation={[-Math.PI / 2, 0, -time * 0.8]}
		scale={revivePulse * 1.15}
	>
		<T.RingGeometry args={[0.6, 0.72, 20]} />
		<T.MeshBasicMaterial
			color="#88ffcc"
			transparent
			opacity={0.3 * revivePulse}
			blending={THREE.AdditiveBlending}
			depthWrite={false}
		/>
	</T.Mesh>
{/if}
