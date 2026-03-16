<script module lang="ts">
	import * as THREE from 'three';
	const downedMarkerGeo = new THREE.ConeGeometry(0.22, 0.5, 3);
	const downedMarkerMat = new THREE.MeshBasicMaterial({
		color: '#ff2222',
		transparent: true,
		opacity: 0.92,
		depthWrite: false
	});
	const downedRingGeo = new THREE.RingGeometry(0.28, 0.42, 24);
	const downedRingMat = new THREE.MeshBasicMaterial({
		color: '#ff2222',
		transparent: true,
		opacity: 0.5,
		depthWrite: false,
		side: THREE.DoubleSide
	});
</script>

<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import type { PlayerState } from '$bindings/types.js';
	import { useTable } from 'spacetimedb/svelte';
	import { tables } from '$bindings/index.js';
	import { lobbyState } from '$lib/stores/lobby.svelte.js';
	import AimReticle from '$lib/character/ui/AimReticle.svelte';
	import LegsModel from '$lib/character/player/LegsModel.svelte';
	import TorsoModel from '$lib/character/player/TorsoModel.svelte';
	import SpotterEffects from '$lib/character/player/spotter/SpotterEffects.svelte';
	import TankEffects from '$lib/character/player/tank/TankEffects.svelte';
	import HealerEffects from '$lib/character/player/healer/HealerEffects.svelte';
	import GunnerEffects from '$lib/character/player/gunner/GunnerEffects.svelte';
	import { abilityState } from '$lib/stores/abilities.svelte.js';

	const [allPlayers] = useTable(tables.playerState);
	const [reviveChannels] = useTable(tables.reviveChannel);

	type Vec3 = { x: number; y: number; z: number };
	type Vec2 = { x: number; z: number };
	type Props = {
		player: PlayerState;
		isLocal?: boolean;
		overridePos?: Vec3;
		overrideFacing?: number;
		overrideAim?: Vec2;
		overrideVel?: Vec2;
	};
	let {
		player,
		isLocal = false,
		overridePos,
		overrideFacing,
		overrideAim,
		overrideVel
	}: Props = $props();

	const sessionId = $derived(lobbyState.currentSessionId ?? 0n);
	const isReviving = $derived(
		$reviveChannels?.some((rc) => rc.healerIdentity.isEqual(player.playerIdentity)) ?? false
	);

	let displayX = $state(0);
	let displayY = $state(0);
	let displayZ = $state(0);

	const targetX = $derived(Number(player.posX) / 1000);
	const targetY = $derived(Number(player.posY) / 1000);
	const targetZ = $derived(Number(player.posZ) / 1000);

	const CLASS_COLORS: Record<string, string> = {
		spotter: '#4af',
		gunner: '#f84',
		tank: '#8a4',
		healer: '#f4a'
	};

	const CLASS_RANGE: Record<string, number> = {
		spotter: 15,
		gunner: 10,
		healer: 10,
		tank: 5
	};

	const aimRange = $derived(CLASS_RANGE[player.classChoice] ?? 10);
	const facing = $derived(overrideFacing ?? Number(player.facingAngle) / 1000);
	const aimPosX = $derived(isLocal ? displayX : targetX);
	const aimPosZ = $derived(isLocal ? displayZ : targetZ);
	const aimX = $derived(overrideAim?.x ?? aimPosX + -Math.sin(facing) * aimRange);
	const aimZ = $derived(overrideAim?.z ?? aimPosZ + -Math.cos(facing) * aimRange);
	const isDowned = $derived(player.status === 'downed');
	const downedTilt = $derived(isDowned ? -Math.PI / 2 : 0);
	const downedYOffset = $derived(isDowned ? -0.35 : 0);

	let downedBob = $state(0);
	let walkPhase = $state(0);
	let speed = $state(0);
	let prevX = $state(0);
	let prevZ = $state(0);

	useTask((dt) => {
		if (isLocal && overridePos) {
			// During adrenaline effect, lerp toward target for visual effect
			// Otherwise snap instantly (optimistic local movement)
			const isAdrenaline = abilityState.adrenalineUntil > Date.now();
			if (isAdrenaline) {
				const LERP = 1 - Math.pow(0.01, dt);
				displayX += (overridePos.x - displayX) * LERP;
				displayY += (overridePos.y - displayY) * LERP;
				displayZ += (overridePos.z - displayZ) * LERP;
			} else {
				displayX = overridePos.x;
				displayY = overridePos.y;
				displayZ = overridePos.z;
			}
			if (overrideVel) {
				speed = Math.hypot(overrideVel.x, overrideVel.z);
			}
		} else {
			const LERP = 1 - Math.pow(0.001, dt);
			displayX += (targetX - displayX) * LERP;
			displayY += (targetY - displayY) * LERP;
			displayZ += (targetZ - displayZ) * LERP;
			const vx = (displayX - prevX) / Math.max(0.0001, dt);
			const vz = (displayZ - prevZ) / Math.max(0.0001, dt);
			speed = Math.hypot(vx, vz);
		}

		prevX = displayX;
		prevZ = displayZ;

		if (isDowned) downedBob += dt;

		if (speed > 0.2) {
			const stride = speed > 6 ? 10 : 7;
			walkPhase += dt * stride;
		}
	});
</script>

<T.Group
	position={[displayX, displayY + downedYOffset, displayZ]}
	rotation={[downedTilt, facing, 0]}
>
	<LegsModel {speed} />
	<TorsoModel {speed} isShooting={0} />
</T.Group>
{#if isDowned}
	<!-- Downward-pointing arrow, bobbing above body -->
	<T.Mesh
		position={[displayX, displayY + 2.2 + Math.sin(downedBob * 2) * 0.12, displayZ]}
		rotation={[Math.PI, 0, 0]}
		geometry={downedMarkerGeo}
		material={downedMarkerMat}
	/>
	<!-- Pulsing ground ring -->
	<T.Mesh
		position={[displayX, displayY + 0.02, displayZ]}
		rotation={[-Math.PI / 2, 0, 0]}
		geometry={downedRingGeo}
		material={downedRingMat}
	/>
{/if}

<!-- Revive shield bubble on healer while channeling revive -->
{#if isReviving}
	<T.Mesh position={[displayX, displayY + 0.75, displayZ]}>
		<T.SphereGeometry args={[0.85, 14, 10]} />
		<T.MeshBasicMaterial
			color="#88ccff"
			transparent
			opacity={0.15}
			blending={THREE.AdditiveBlending}
			depthWrite={false}
			side={THREE.DoubleSide}
		/>
	</T.Mesh>
	<T.Mesh position={[displayX, displayY + 0.75, displayZ]}>
		<T.SphereGeometry args={[0.88, 14, 10]} />
		<T.MeshBasicMaterial
			color="#aaddff"
			transparent
			opacity={0.08}
			blending={THREE.AdditiveBlending}
			depthWrite={false}
			side={THREE.BackSide}
		/>
	</T.Mesh>
{/if}

<!-- Per-class ability effects (world-space, follow interpolated position) -->
{#if player.classChoice === 'spotter'}
	<SpotterEffects x={displayX} z={displayZ} yaw={facing} {player} {isLocal} />
{:else if player.classChoice === 'tank'}
	<TankEffects x={displayX} z={displayZ} yaw={facing} {player} {isLocal} />
{:else if player.classChoice === 'healer'}
	<HealerEffects
		x={displayX}
		z={displayZ}
		{player}
		{isLocal}
		allPlayers={$allPlayers ?? []}
		{sessionId}
		{isReviving}
	/>
{:else if player.classChoice === 'gunner'}
	<GunnerEffects x={displayX} z={displayZ} {isLocal} {player} />
{/if}

<AimReticle x={aimX} z={aimZ} color={CLASS_COLORS[player.classChoice] ?? '#fff'} />
