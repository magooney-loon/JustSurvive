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
	import GunnerLegsModel from '$lib/character/player/gunner/GunnerLegsModel.svelte';
	import GunnerTorsoModel from '$lib/character/player/gunner/GunnerTorsoModel.svelte';
	import SpotterLegsModel from '$lib/character/player/spotter/SpotterLegsModel.svelte';
	import SpotterTorsoModel from '$lib/character/player/spotter/SpotterTorsoModel.svelte';
	import SpotterEffects from '$lib/character/player/spotter/SpotterEffects.svelte';
	import TankEffects from '$lib/character/player/tank/TankEffects.svelte';
	import HealerEffects from '$lib/character/player/healer/HealerEffects.svelte';
	import GunnerEffects from '$lib/character/player/gunner/GunnerEffects.svelte';
	import { abilityState, shotFlash } from '$lib/stores/abilities.svelte.js';

	const [allPlayers] = useTable(tables.playerState);
	const [reviveChannels] = useTable(tables.reviveChannel);
	const [enemies] = useTable(tables.enemy);
	const [bosses] = useTable(tables.boss);

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

	// Gunner & Spotter shooting: check both local and remote
	const isShooting = $derived.by(() => {
		if (player.classChoice !== 'gunner' && player.classChoice !== 'spotter') return 0;
		if (isLocal) {
			return shotFlash.until > Date.now() ? 1 : 0;
		}
		// Remote players: check lastShotAt timestamp (within 500ms window)
		if (player.lastShotAt) {
			const shotMicros = player.lastShotAt.microsSinceUnixEpoch;
			const nowMicros = BigInt(Date.now() * 1000);
			if (nowMicros - shotMicros < 500_000n) {
				return 1;
			}
		}
		return 0;
	});

	const facing = $derived(overrideFacing ?? Number(player.facingAngle) / 1000);
	const aimPosX = $derived(isLocal ? displayX : targetX);
	const aimPosZ = $derived(isLocal ? displayZ : targetZ);
	const aimX = $derived(overrideAim?.x ?? aimPosX + -Math.sin(facing) * aimRange);
	const aimZ = $derived(overrideAim?.z ?? aimPosZ + -Math.cos(facing) * aimRange);

	// Closer reticle position (60% of max range)
	const closeRange = $derived(aimRange * 0.6);
	const closeAimX = $derived(aimPosX + -Math.sin(facing) * closeRange);
	const closeAimZ = $derived(aimPosZ + -Math.cos(facing) * closeRange);

	// Check if any enemy is within close range from reticle position
	const hasEnemyInRange = $derived.by(() => {
		if (!isLocal) return false;
		const cAimX = closeAimX;
		const cAimZ = closeAimZ;

		// Check distance from PLAYER position for actual range (use full class range)
		const playerRange = aimRange; // full class range for green
		const playerRangeSq = playerRange * playerRange;
		const warningRange = closeRange * 1.2; // 20% beyond reticle for yellow
		const warningRangeSq = warningRange * warningRange;

		let inRange = false;
		let inWarningRange = false;

		// Player facing direction vector
		const faceX = -Math.sin(facing);
		const faceZ = -Math.cos(facing);

		for (const e of $enemies) {
			if (!e.isAlive || e.sessionId !== sessionId) continue;
			const ex = Number(e.posX) / 1000;
			const ez = Number(e.posZ) / 1000;
			// Distance from player to enemy
			const dxPlayer = ex - aimPosX;
			const dzPlayer = ez - aimPosZ;
			const distPlayerSq = dxPlayer * dxPlayer + dzPlayer * dzPlayer;
			// Distance from reticle to enemy (for warning)
			const dx = ex - cAimX;
			const dz = ez - cAimZ;
			const distSq = dx * dx + dz * dz;

			// Check if enemy is in front of player (dot product > 0 means in front)
			const dotProduct = dxPlayer * faceX + dzPlayer * faceZ;
			const isInFront = dotProduct > 0;

			if (distPlayerSq <= playerRangeSq && isInFront) inRange = true;
			if (distSq <= warningRangeSq) inWarningRange = true;
		}
		for (const b of $bosses) {
			if (!b.isAlive || b.sessionId !== sessionId) continue;
			const bx = Number(b.posX) / 1000;
			const bz = Number(b.posZ) / 1000;
			// Distance from player to boss
			const dxPlayer = bx - aimPosX;
			const dzPlayer = bz - aimPosZ;
			const distPlayerSq = dxPlayer * dxPlayer + dzPlayer * dzPlayer;
			// Distance from reticle to boss (for warning)
			const dx = bx - cAimX;
			const dz = bz - cAimZ;
			const distSq = dx * dx + dz * dz;

			// Check if boss is in front of player
			const dotProduct = dxPlayer * faceX + dzPlayer * faceZ;
			const isInFront = dotProduct > 0;

			if (distPlayerSq <= playerRangeSq && isInFront) inRange = true;
			if (distSq <= warningRangeSq) inWarningRange = true;
		}

		return { inRange, inWarningRange };
	});

	const reticleColor = $derived(
		!hasEnemyInRange
			? '#fff'
			: hasEnemyInRange.inRange
				? '#4f4' // green when in range
				: hasEnemyInRange.inWarningRange
					? '#ff0' // yellow when approaching (20% beyond)
					: '#fff' // white otherwise
	);

	const isDowned = $derived(player.status === 'downed');
	const isStunned = $derived.by(() => {
		const nowMs = Date.now();
		return player.stunUntil ? Number(player.stunUntil.microsSinceUnixEpoch) / 1000 > nowMs : false;
	});
	const isSlowed = $derived.by(() => {
		const nowMs = Date.now();
		return player.slowedUntil
			? Number(player.slowedUntil.microsSinceUnixEpoch) / 1000 > nowMs
			: false;
	});
	const downedTilt = $derived(isDowned ? -Math.PI / 2 : 0);
	const downedYOffset = $derived(isDowned ? -0.35 : 0);

	let downedBob = $state(0);
	let walkPhase = $state(0);
	let speed = $state(0);
	let prevX = $state(0);
	let prevZ = $state(0);

	// Smooth reticle transitions
	let reticleOpacity = $state(0.15);
	let reticleScale = $state(0.5);

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

		// Smooth reticle transitions
		const targetOpacity = !hasEnemyInRange
			? 0.15 // barely visible when no target
			: hasEnemyInRange.inRange
				? 0.85 // full opacity when in range
				: 0.85; // full opacity when warning
		const moveSpread = Math.min(1, speed / 8);
		const targetScale = (!hasEnemyInRange ? 0.5 : 1) + moveSpread * 0.8;
		const reticleLerp = 1 - Math.pow(0.01, dt);
		reticleOpacity += (targetOpacity - reticleOpacity) * reticleLerp;
		reticleScale += (targetScale - reticleScale) * reticleLerp;
	});
</script>

<T.Group
	position={[displayX, displayY + downedYOffset, displayZ]}
	rotation={[downedTilt, facing, 0]}
>
	{#if player.classChoice === 'gunner'}
		<GunnerLegsModel {speed} />
		<GunnerTorsoModel {speed} {isShooting} />
	{:else if player.classChoice === 'spotter'}
		<SpotterLegsModel {speed} />
		<SpotterTorsoModel {speed} {isShooting} />
	{:else}
		<GunnerLegsModel {speed} />
		<GunnerTorsoModel {speed} {isShooting} />
	{/if}
</T.Group>

<!-- Stun/Slow visual indicator -->
{#if (isStunned || isSlowed) && !isDowned}
	<!-- Ground ring effect -->
	<T.Mesh position={[displayX, displayY + 0.02, displayZ]} rotation.x={-Math.PI / 2}>
		<T.RingGeometry args={[0.6, 0.8, 24]} />
		<T.MeshBasicMaterial
			color={isStunned ? '#ffaa00' : '#44aaff'}
			transparent
			opacity={0.5}
			side={THREE.DoubleSide}
			depthWrite={false}
		/>
	</T.Mesh>
	<!-- Inner ground ring -->
	<T.Mesh position={[displayX, displayY + 0.02, displayZ]} rotation.x={-Math.PI / 2}>
		<T.RingGeometry args={[0.3, 0.45, 24]} />
		<T.MeshBasicMaterial
			color={isStunned ? '#ffcc44' : '#66ccff'}
			transparent
			opacity={0.35}
			side={THREE.DoubleSide}
			depthWrite={false}
		/>
	</T.Mesh>
	<!-- Floating sphere indicator -->
	<T.Mesh position={[displayX, displayY + 1.2, displayZ]}>
		<T.SphereGeometry args={[0.5, 12, 8]} />
		<T.MeshBasicMaterial
			color={isStunned ? '#ffaa00' : '#44aaff'}
			transparent
			opacity={0.25}
			side={THREE.DoubleSide}
			depthWrite={false}
		/>
	</T.Mesh>
{/if}

<!-- Local player reticle floating in air closer to player -->
{#if isLocal && !isDowned}
	<T.Group
		position={[closeAimX, 2, closeAimZ]}
		rotation={[0, facing + Math.PI, 0]}
		scale={[reticleScale, reticleScale, reticleScale]}
	>
		<T.Mesh rotation={[0, 0, 0]}>
			<T.RingGeometry args={[0.05, 0.08, 16]} />
			<T.MeshBasicMaterial
				color={reticleColor}
				transparent
				opacity={reticleOpacity}
				side={2}
				depthWrite={false}
			/>
		</T.Mesh>
		<T.Mesh rotation={[0, 0, 0]}>
			<T.CircleGeometry args={[0.015, 8]} />
			<T.MeshBasicMaterial
				color={reticleColor}
				transparent
				opacity={reticleOpacity}
				side={2}
				depthWrite={false}
			/>
		</T.Mesh>
	</T.Group>
{/if}
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

<!-- Ground aim reticle for remote players only -->
{#if !isLocal}
	<AimReticle x={aimX} z={aimZ} color={CLASS_COLORS[player.classChoice] ?? '#fff'} />
{/if}
