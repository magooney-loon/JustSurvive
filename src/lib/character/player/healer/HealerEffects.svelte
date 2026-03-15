<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import * as THREE from 'three';
	import type { PlayerState } from '$bindings/types.js';
	import { useTable } from 'spacetimedb/svelte';
	import { tables } from '$bindings/index.js';
	import { healBeam, HEAL_BEAM_MS, ultimateFlash, ULTIMATE_FLASH_MS } from '$lib/stores/abilities.svelte.js';
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

	const [healerStates] = useTable(tables.healerState);

	const _yAxis = new THREE.Vector3(0, 1, 0);
	const BEAM_Y = 1.1;

	let now = $state(Date.now());
	let time = $state(0);
	useTask((dt) => {
		now = Date.now();
		time += dt;
	});

	type Beam = { fromX: number; fromZ: number; toX: number; toZ: number; until: number };

	const myHealerState = $derived(
		$healerStates.find((h) => h.playerIdentity.toHexString() === player.playerIdentity.toHexString())
	);

	const activeBeam = $derived.by((): Beam | null => {
		// Local: use optimistic store
		if (isLocal && healBeam.active && healBeam.until > now) {
			return { fromX: localPos.x, fromZ: localPos.z, toX: healBeam.toX, toZ: healBeam.toZ, until: healBeam.until };
		}
		// Remote: derive from HealerState timestamp + healTargetIdentity
		if (!myHealerState?.lastHealAt || !myHealerState?.healTargetIdentity) return null;
		const until = Number(myHealerState.lastHealAt.microsSinceUnixEpoch) / 1000 + HEAL_BEAM_MS;
		if (now >= until) return null;
		const target = allPlayers.find(
			(p) => p.sessionId === sessionId && p.playerIdentity.isEqual(myHealerState!.healTargetIdentity!)
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

	const activeChainBeam = $derived.by((): Beam | null => {
		if (!myHealerState?.lastHealAt || !myHealerState?.chainHealTargetIdentity) return null;
		const until = Number(myHealerState.lastHealAt.microsSinceUnixEpoch) / 1000 + HEAL_BEAM_MS;
		if (now >= until) return null;
		// Chain beam starts from primary target's position
		const primaryTarget = allPlayers.find(
			(p) => p.sessionId === sessionId && myHealerState?.healTargetIdentity && p.playerIdentity.isEqual(myHealerState.healTargetIdentity!)
		);
		const chainTarget = allPlayers.find(
			(p) => p.sessionId === sessionId && p.playerIdentity.isEqual(myHealerState!.chainHealTargetIdentity!)
		);
		if (!primaryTarget || !chainTarget) return null;
		return {
			fromX: Number(primaryTarget.posX) / 1000,
			fromZ: Number(primaryTarget.posZ) / 1000,
			toX: Number(chainTarget.posX) / 1000,
			toZ: Number(chainTarget.posZ) / 1000,
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

	const chainT = $derived(activeChainBeam ? Math.max(0, (activeChainBeam.until - now) / HEAL_BEAM_MS) : 0);
	const chainDx = $derived(activeChainBeam ? activeChainBeam.toX - activeChainBeam.fromX : 0);
	const chainDz = $derived(activeChainBeam ? activeChainBeam.toZ - activeChainBeam.fromZ : 0);
	const chainLen = $derived(Math.sqrt(chainDx * chainDx + chainDz * chainDz));
	const chainMx = $derived(activeChainBeam ? (activeChainBeam.fromX + activeChainBeam.toX) / 2 : 0);
	const chainMz = $derived(activeChainBeam ? (activeChainBeam.fromZ + activeChainBeam.toZ) / 2 : 0);
	const chainQ = $derived(
		chainLen > 0.1
			? new THREE.Quaternion().setFromUnitVectors(
					_yAxis,
					new THREE.Vector3(chainDx / chainLen, 0, chainDz / chainLen)
				)
			: new THREE.Quaternion()
	);

	// Revive channeling ring — pulsing green ring around healer while reviving
	const revivePulse = $derived(0.7 + 0.3 * Math.sin(time * 5));

	// ─── Revitalize ultimate ─────────────────────────────────────────────────

	const ultimateUntil = $derived.by(() => {
		if (isLocal) return ultimateFlash.until;
		if (!myHealerState?.lastUltimateAt) return 0;
		return Number(myHealerState.lastUltimateAt.microsSinceUnixEpoch) / 1000 + ULTIMATE_FLASH_MS;
	});
	const ut = $derived(Math.max(0, (ultimateUntil - now) / ULTIMATE_FLASH_MS));

	const REVIT_R = 10;
	const revitRays = $derived(
		Array.from({ length: 8 }, (_, i) => {
			const angle = (i / 8) * Math.PI * 2;
			return {
				px: x - Math.sin(angle) * REVIT_R * 0.5,
				pz: z - Math.cos(angle) * REVIT_R * 0.5,
				angle
			};
		})
	);
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

{#if activeChainBeam && chainT > 0 && chainLen > 0.1}
	<!-- Chain beam: slightly thinner, green tint -->
	<T.Mesh
		position={[chainMx, BEAM_Y, chainMz]}
		quaternion={[chainQ.x, chainQ.y, chainQ.z, chainQ.w]}
		scale={[0.045, chainLen, 0.045]}
	>
		<T.CylinderGeometry args={[1, 1, 1, 8]} />
		<T.MeshBasicMaterial
			color="#aaffcc"
			transparent
			opacity={chainT * 0.75}
			blending={THREE.AdditiveBlending}
		/>
	</T.Mesh>
	<T.Mesh
		position={[chainMx, BEAM_Y, chainMz]}
		quaternion={[chainQ.x, chainQ.y, chainQ.z, chainQ.w]}
		scale={[0.14, chainLen, 0.14]}
	>
		<T.CylinderGeometry args={[1, 1, 1, 8]} />
		<T.MeshBasicMaterial
			color="#44ffaa"
			transparent
			opacity={chainT * 0.3}
			blending={THREE.AdditiveBlending}
			side={THREE.BackSide}
		/>
	</T.Mesh>
	<T.Mesh position={[activeChainBeam.toX, BEAM_Y, activeChainBeam.toZ]} scale={0.2 + (1 - chainT) * 0.25}>
		<T.SphereGeometry args={[1, 10, 8]} />
		<T.MeshBasicMaterial
			color="#aaffcc"
			transparent
			opacity={chainT * 0.75}
			blending={THREE.AdditiveBlending}
		/>
	</T.Mesh>
{/if}

{#if ut > 0}
	<!-- Revitalize: 8 golden outward rays -->
	{#each revitRays as s}
		<T.Mesh position={[s.px, 1.0, s.pz]} rotation={[0, s.angle, 0]}>
			<T.BoxGeometry args={[0.05, 0.05, REVIT_R]} />
			<T.MeshBasicMaterial
				color="#ffe866"
				transparent
				opacity={ut * 0.8}
				blending={THREE.AdditiveBlending}
				depthWrite={false}
			/>
		</T.Mesh>
		<T.Mesh position={[s.px, 1.0, s.pz]} rotation={[0, s.angle, 0]}>
			<T.BoxGeometry args={[0.15, 0.15, REVIT_R * 0.55]} />
			<T.MeshBasicMaterial
				color="#44ffaa"
				transparent
				opacity={ut * 0.25}
				blending={THREE.AdditiveBlending}
				depthWrite={false}
			/>
		</T.Mesh>
	{/each}
	<!-- Expanding green healing ring -->
	<T.Mesh
		position={[x, 0.06, z]}
		rotation={[-Math.PI / 2, 0, 0]}
		scale={Math.max(0.1, (1 - ut) * REVIT_R)}
	>
		<T.RingGeometry args={[0.84, 1, 32]} />
		<T.MeshBasicMaterial
			color="#44ffaa"
			transparent
			opacity={ut * 0.7}
			blending={THREE.AdditiveBlending}
			depthWrite={false}
		/>
	</T.Mesh>
	<!-- Gold inner ring -->
	<T.Mesh
		position={[x, 0.06, z]}
		rotation={[-Math.PI / 2, 0, 0]}
		scale={Math.max(0.1, (1 - ut) * REVIT_R * 0.55)}
	>
		<T.RingGeometry args={[0.78, 1, 32]} />
		<T.MeshBasicMaterial
			color="#ffe866"
			transparent
			opacity={ut * 0.55}
			blending={THREE.AdditiveBlending}
			depthWrite={false}
		/>
	</T.Mesh>
	<!-- Golden pillar of light -->
	<T.Mesh position={[x, 1.5, z]} scale={[0.18 + (1 - ut) * 0.12, 3, 0.18 + (1 - ut) * 0.12]}>
		<T.CylinderGeometry args={[1, 1.2, 1, 12]} />
		<T.MeshBasicMaterial
			color="#ffe866"
			transparent
			opacity={ut * 0.55}
			blending={THREE.AdditiveBlending}
			depthWrite={false}
		/>
	</T.Mesh>
	<!-- Core burst -->
	<T.Mesh position={[x, 1.0, z]} scale={0.18 + (1 - ut) * 0.4}>
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
