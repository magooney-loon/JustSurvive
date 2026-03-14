<script module lang="ts">
	import * as THREE from 'three';
	const downedMarkerGeo = new THREE.ConeGeometry(0.1, 0.22, 3);
	const downedMarkerMat = new THREE.MeshBasicMaterial({
		color: '#ffffff',
		transparent: true,
		opacity: 0.18,
		depthWrite: false
	});
</script>

<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { useTexture } from '@threlte/extras';
	import type { PlayerState } from '$bindings/types.js';
	import { useTable } from 'spacetimedb/svelte';
	import { tables } from '$bindings/index.js';
	import { lobbyState } from '$lib/stores/lobby.svelte.js';
	import AimReticle from '$lib/character/ui/AimReticle.svelte';
	import SpotterRig from '$lib/character/player/spotter/SpotterRig.svelte';
	import GunnerRig from '$lib/character/player/gunner/GunnerRig.svelte';
	import TankRig from '$lib/character/player/tank/TankRig.svelte';
	import HealerRig from '$lib/character/player/healer/HealerRig.svelte';
	import SpotterEffects from '$lib/character/player/spotter/SpotterEffects.svelte';
	import TankEffects from '$lib/character/player/tank/TankEffects.svelte';
	import HealerEffects from '$lib/character/player/healer/HealerEffects.svelte';
	import GunnerEffects from '$lib/character/player/gunner/GunnerEffects.svelte';
	import { RepeatWrapping } from 'three';
	import { shotFlash, SHOT_FLASH_MS, abilityState } from '$lib/stores/abilities.svelte.js';

	const [allPlayers] = useTable(tables.playerState);
	const [reviveChannels] = useTable(tables.reviveChannel);

	const base = import.meta.env.BASE_URL;

	type Vec3 = { x: number; y: number; z: number };
	type Vec2 = { x: number; z: number };
	type Props = {
		player: PlayerState;
		isLocal?: boolean;
		phase?: string;
		overridePos?: Vec3;
		overrideFacing?: number;
		overrideAim?: Vec2;
		overrideVel?: Vec2;
	};
	let {
		player,
		isLocal = false,
		phase = 'sunset',
		overridePos,
		overrideFacing,
		overrideAim,
		overrideVel
	}: Props = $props();

	const sessionId = $derived(lobbyState.currentSessionId ?? 0n);
	const isReviving = $derived(
		$reviveChannels?.some((rc) => rc.healerIdentity.isEqual(player.playerIdentity)) ?? false
	);
	const isBeingRevived = $derived(
		$reviveChannels?.some((rc) => rc.targetIdentity.isEqual(player.playerIdentity)) ?? false
	);

	const CLASS_TEXTURES: Record<string, string> = {
		spotter: `${base}textures/spotter.webp`,
		gunner: `${base}textures/gunner.webp`,
		tank: `${base}textures/tank.webp`,
		healer: `${base}textures/healer.webp`
	};

	let classTexture = $state<any>(null);

	$effect(() => {
		const tex = CLASS_TEXTURES[player.classChoice];
		if (tex) {
			useTexture(tex, {
				transform: (t) => {
					t.wrapS = RepeatWrapping;
					t.wrapT = RepeatWrapping;
					return t;
				}
			})
				.catch(() => null)
				.then((t) => {
					classTexture = t;
				});
		}
	});

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
	const aimX = $derived(overrideAim?.x ?? displayX + -Math.sin(facing) * aimRange);
	const aimZ = $derived(overrideAim?.z ?? displayZ + -Math.cos(facing) * aimRange);
	const isDowned = $derived(player.status === 'downed');
	const downedTilt = $derived(isDowned ? -Math.PI / 2 : 0);
	const downedYOffset = $derived(isDowned ? -0.35 : 0);

	let downedBob = $state(0);
	let shotPulse = $state(0);
	let walkPhase = $state(0);
	let speed = $state(0);
	let prevX = $state(0);
	let prevZ = $state(0);

	// Remote shot flash: record local receive time when lastShotAt changes.
	// Avoids server-client clock drift and subscription delivery latency.
	const REMOTE_SHOT_FLASH_MS = 500;
	let remoteFlashUntil = $state(0);
	// Plain let (not $state) to avoid reactive loop — we only use it as a "last seen" tracker
	let prevLastShotMicros: bigint | undefined;
	$effect(() => {
		if (!isLocal) {
			const cur = player.lastShotAt;
			const curMicros = cur?.microsSinceUnixEpoch;
			if (curMicros !== prevLastShotMicros && curMicros != null) {
				remoteFlashUntil = Date.now() + REMOTE_SHOT_FLASH_MS;
			}
			prevLastShotMicros = curMicros;
		} else {
			remoteFlashUntil = 0;
		}
	});

	useTask((dt) => {
		// For local player, use optimistic local state (immediate, no latency)
		// For remote players, record when we receive the update and flash from that
		if (isLocal) {
			const remainingMs = shotFlash.until - Date.now();
			shotPulse = remainingMs > 0 ? remainingMs / SHOT_FLASH_MS : 0;
		} else {
			const remainingMs = remoteFlashUntil - Date.now();
			// Force reset to 0 if expired
			shotPulse = remainingMs > 0 ? remainingMs / REMOTE_SHOT_FLASH_MS : 0;
		}

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
		{#if player.classChoice === 'spotter'}
			{#if classTexture}
				<SpotterRig
					color={CLASS_COLORS[player.classChoice] ?? '#fff'}
					{walkPhase}
					{speed}
					{shotPulse}
					{phase}
					isBracing={player.isBracing}
					texture={classTexture}
				/>
			{:else}
				<SpotterRig
					color={CLASS_COLORS[player.classChoice] ?? '#fff'}
					{walkPhase}
					{speed}
					{shotPulse}
					{phase}
					isBracing={player.isBracing}
				/>
			{/if}
		{:else if player.classChoice === 'gunner'}
			{#if classTexture}
				<GunnerRig
					color={CLASS_COLORS[player.classChoice] ?? '#fff'}
					{walkPhase}
					{speed}
					{shotPulse}
					{phase}
					isBracing={player.isBracing}
					texture={classTexture}
				/>
			{:else}
				<GunnerRig
					color={CLASS_COLORS[player.classChoice] ?? '#fff'}
					{walkPhase}
					{speed}
					{shotPulse}
					{phase}
					isBracing={player.isBracing}
				/>
			{/if}
		{:else if player.classChoice === 'tank'}
			{#if classTexture}
				<TankRig
					color={CLASS_COLORS[player.classChoice] ?? '#fff'}
					{walkPhase}
					{speed}
					{shotPulse}
					{phase}
					isBracing={player.isBracing}
					texture={classTexture}
				/>
			{:else}
				<TankRig
					color={CLASS_COLORS[player.classChoice] ?? '#fff'}
					{walkPhase}
					{speed}
					{shotPulse}
					{phase}
					isBracing={player.isBracing}
				/>
			{/if}
		{:else if player.classChoice === 'healer'}
			{#if classTexture}
				<HealerRig
					color={CLASS_COLORS[player.classChoice] ?? '#fff'}
					{walkPhase}
					{speed}
					{shotPulse}
					{phase}
					isBracing={player.isBracing}
					texture={classTexture}
				/>
			{:else}
				<HealerRig
					color={CLASS_COLORS[player.classChoice] ?? '#fff'}
					{walkPhase}
					{speed}
					{shotPulse}
					{phase}
					isBracing={player.isBracing}
				/>
			{/if}
		{/if}
	</T.Group>
	{#if isDowned}
		<T.Mesh
			position={[displayX, displayY + 1.5 + Math.sin(downedBob * 1.5) * 0.08, displayZ]}
			rotation={[Math.PI, 0, 0]}
			geometry={downedMarkerGeo}
			material={downedMarkerMat}
		/>
	{/if}

	<!-- Revive shield bubble on downed player being revived -->
	{#if isDowned && isBeingRevived}
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
		<GunnerEffects x={displayX} z={displayZ} {isLocal} />
	{/if}

<AimReticle x={aimX} z={aimZ} color={CLASS_COLORS[player.classChoice] ?? '#fff'} />
