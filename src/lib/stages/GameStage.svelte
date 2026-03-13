<script lang="ts">
	import { useTask } from '@threlte/core';
	import { useSpacetimeDB, useTable } from 'spacetimedb/svelte';
	import { tables } from '$bindings/index.js';
	import { lobbyState } from '$lib/stores/lobby.svelte.js';
	import { combatActions } from '$lib/stores/combat.svelte.js';
	import {
		localPos,
		localVelocity,
		input,
		updateLocalMovement,
		resetMovement,
		localAim,
		fpsCamera,
		cameraFollow
	} from '$lib/stores/movement.svelte.js';
	import { resetAbilities } from '$lib/stores/abilities.svelte.js';
	import { localHealthState, skyState, devSky } from '$lib/stores/sky.svelte.js';
	import { onMount } from 'svelte';
	import PlayerEntity from '$lib/character/PlayerEntity.svelte';
	import EnemyEntity from '$lib/character/EnemyEntity.svelte';
	import AcidPoolEntity from '$lib/character/enemies/AcidPoolEntity.svelte';
	import MarkOverlay from '$lib/character/ui/MarkOverlay.svelte';
	import GameGround from '$lib/map/GameGround.svelte';
	import HealBeam from '$lib/character/healer/HealBeam.svelte';
	import GameSounds from '$lib/stages/GameSounds.svelte';
	import RainEffect from '$lib/map/RainEffect.svelte';
	import SpotterFlashEffect from '$lib/character/enemies/spotter/SpotterFlashEffect.svelte';

	const conn = useSpacetimeDB();
	const [players] = useTable(tables.playerState);
	const [enemies] = useTable(tables.enemy);
	const [sessions] = useTable(tables.gameSession);
	const [acidPools] = useTable(tables.acidPool);

	const session = $derived($sessions.find((s) => s.id === lobbyState.currentSessionId));
	const myState = $derived(
		$players.find(
			(p) =>
				p.playerIdentity.toHexString() === $conn.identity?.toHexString() &&
				p.sessionId === lobbyState.currentSessionId
		)
	);
	const otherPlayers = $derived(
		$players.filter(
			(p) =>
				p.playerIdentity.toHexString() !== $conn.identity?.toHexString() &&
				p.sessionId === lobbyState.currentSessionId
		)
	);
	const MAX_RENDER_DIST = 80; // world units
	const MAX_DIST_SQ = MAX_RENDER_DIST * MAX_RENDER_DIST;

	const visibleEnemies = $derived.by(() => {
		const result: (typeof $enemies)[number][] = [];
		for (const e of $enemies) {
			if (e.sessionId !== lobbyState.currentSessionId) continue;
			if (!myState) {
				result.push(e);
				continue;
			}
			const dx = Number(e.posX) / 1000 - localPos.x;
			const dz = Number(e.posZ) / 1000 - localPos.z;
			const d2 = dx * dx + dz * dz;
			if (e.isAlive && d2 <= MAX_DIST_SQ) {
				result.push(e);
			}
		}
		return result;
	});

	const livePools = $derived(
		myState
			? $acidPools.filter((p) => {
					if (p.sessionId !== lobbyState.currentSessionId) return false;
					const dx = Number(p.posX) / 1000 - localPos.x;
					const dz = Number(p.posZ) / 1000 - localPos.z;
					return dx * dx + dz * dz <= MAX_DIST_SQ;
				})
			: $acidPools.filter((p) => p.sessionId === lobbyState.currentSessionId)
	);
	const alivePlayers = $derived(
		$players.filter((p) => p.sessionId === lobbyState.currentSessionId && p.status === 'alive')
	);
	const phase = $derived(devSky.forcedPhase ?? session?.dayPhase ?? 'sunset');

	const PHASE_SKY = {
		sunset: {
			elevation: 3,
			azimuth: 260,
			turbidity: 12,
			rayleigh: 2.5,
			mieC: 0.007,
			mieG: 0.8,
			ambient: 0.6,
			sun: 1.0,
			sunR: 1.0,
			sunG: 0.75,
			sunB: 0.45,
			storm: 0.0
		},
		dusk: {
			elevation: 0,
			azimuth: 255,
			turbidity: 10,
			rayleigh: 1.5,
			mieC: 0.005,
			mieG: 0.75,
			ambient: 0.35,
			sun: 0.5,
			sunR: 0.85,
			sunG: 0.55,
			sunB: 0.3,
			storm: 0.0
		},
		twilight: {
			elevation: -3,
			azimuth: 250,
			turbidity: 8,
			rayleigh: 0.5,
			mieC: 0.004,
			mieG: 0.7,
			ambient: 0.18,
			sun: 0.12,
			sunR: 0.45,
			sunG: 0.45,
			sunB: 0.65,
			storm: 0.2
		},
		night: {
			elevation: -8,
			azimuth: 180,
			turbidity: 6,
			rayleigh: 0.2,
			mieC: 0.003,
			mieG: 0.7,
			ambient: 0.07,
			sun: 0.04,
			sunR: 0.3,
			sunG: 0.35,
			sunB: 0.55,
			storm: 0.75
		},
		deep_night: {
			elevation: -15,
			azimuth: 180,
			turbidity: 4,
			rayleigh: 0.08,
			mieC: 0.002,
			mieG: 0.7,
			ambient: 0.03,
			sun: 0.01,
			sunR: 0.2,
			sunG: 0.25,
			sunB: 0.4,
			storm: 1.0
		}
	} as const;

	const CLASS_RANGE: Record<string, number> = {
		spotter: 15,
		gunner: 10,
		healer: 10,
		tank: 5
	};

	onMount(() => {
		resetMovement();
		resetAbilities();
	});

	$effect(() => {
		const hp = myState?.hp ?? null;
		const max = myState?.maxHp ?? null;
		localHealthState.ratio =
			hp !== null && max && max > 0n ? Math.max(0, Math.min(1, Number(hp) / Number(max))) : 1;
	});

	let spectateIndex = $state(0);

	function onMouseDownSpectate(e: MouseEvent) {
		if (!myState || myState.status !== 'eliminated') return;
		if (e.button !== 0) return;
		if (alivePlayers.length === 0) return;
		spectateIndex = (spectateIndex + 1) % alivePlayers.length;
	}

	// Angle to rotate player group so its -Z faces the aim point
	const aimAngle = $derived(Math.atan2(localPos.x - localAim.x, localPos.z - localAim.z));

	let sendTimer = 0;
	const SEND_INTERVAL = 1 / 60;

	useTask((dt) => {
		// ── Sky lerp (always runs) ──────────────────────────────────────────
		const skyTarget = PHASE_SKY[phase as keyof typeof PHASE_SKY] ?? PHASE_SKY.sunset;
		const t = Math.min(1, dt * 1.5);
		skyState.elevation += (skyTarget.elevation - skyState.elevation) * t;
		skyState.azimuth += (skyTarget.azimuth - skyState.azimuth) * t;
		skyState.turbidity += (skyTarget.turbidity - skyState.turbidity) * t;
		skyState.rayleigh += (skyTarget.rayleigh - skyState.rayleigh) * t;
		skyState.mieCoefficient += (skyTarget.mieC - skyState.mieCoefficient) * t;
		skyState.mieDirectionalG += (skyTarget.mieG - skyState.mieDirectionalG) * t;
		skyState.ambientIntensity += (skyTarget.ambient - skyState.ambientIntensity) * t;
		skyState.sunIntensity += (skyTarget.sun - skyState.sunIntensity) * t;
		skyState.sunR += (skyTarget.sunR - skyState.sunR) * t;
		skyState.sunG += (skyTarget.sunG - skyState.sunG) * t;
		skyState.sunB += (skyTarget.sunB - skyState.sunB) * t;
		skyState.stormIntensity += (skyTarget.storm - skyState.stormIntensity) * t;

		if (myState?.status === 'eliminated') {
			if (alivePlayers.length > 0) {
				if (spectateIndex >= alivePlayers.length) spectateIndex = 0;
				const target = alivePlayers[spectateIndex];
				const tx = Number(target.posX) / 1000;
				const ty = Number(target.posY) / 1000;
				const tz = Number(target.posZ) / 1000;
				const facing = Number(target.facingAngle) / 1000;
				cameraFollow.active = true;
				cameraFollow.x = tx;
				cameraFollow.y = ty;
				cameraFollow.z = tz;
				cameraFollow.aimX = tx + -Math.sin(facing);
				cameraFollow.aimZ = tz + -Math.cos(facing);
			} else {
				cameraFollow.active = false;
			}
			return;
		}

		cameraFollow.active = false;
		if (!myState || myState.status !== 'alive') return;

		// FPS aim: project camera forward ray onto the ground plane
		const range = CLASS_RANGE[myState?.classChoice ?? 'gunner'] ?? 10;
		localAim.x = localPos.x + -Math.sin(fpsCamera.yaw) * range;
		localAim.z = localPos.z + -Math.cos(fpsCamera.yaw) * range;

		const hasStamina = myState.stamina > 0n;
		// camYaw for movement: camera forward is (-sin(yaw), -cos(yaw)), so pass yaw+π
		const camYaw = fpsCamera.yaw + Math.PI;
		updateLocalMovement(dt, myState.classChoice, hasStamina, camYaw, myState.isBracing);

		sendTimer += dt;
		if (sendTimer >= SEND_INTERVAL) {
			sendTimer = 0;
			const px = BigInt(Math.round(localPos.x * 1000));
			const pz = BigInt(Math.round(localPos.z * 1000));
			combatActions.movePlayer({
				sessionId: lobbyState.currentSessionId!,
				posX: px,
				posY: BigInt(Math.round(localPos.y * 1000)),
				posZ: pz,
				isSprinting: input.sprint && hasStamina,
				facingAngle: BigInt(Math.round(aimAngle * 1000))
			});
		}
	});
</script>

<svelte:window onmousedown={onMouseDownSpectate} />

<GameGround />
<RainEffect />

<!-- Local player (predicted position, rotated toward aim) -->
{#if myState}
	<PlayerEntity
		player={myState}
		isLocal={true}
		{phase}
		overridePos={{ x: localPos.x, y: localPos.y, z: localPos.z }}
		overrideFacing={aimAngle}
		overrideAim={{ x: localAim.x, z: localAim.z }}
		overrideVel={{ x: localVelocity.x, z: localVelocity.z }}
	/>
{/if}

<!-- Remote players (server position, interpolated) -->
{#each otherPlayers as player (player.id)}
	<PlayerEntity {player} {phase} />
{/each}

<!-- Enemies (interpolated) -->
{#each visibleEnemies as enemy (enemy.id)}
	<EnemyEntity {enemy} />
{/each}

<!-- Acid pools -->
{#each livePools as pool (pool.id)}
	<AcidPoolEntity {pool} />
{/each}

<!-- Mark / ping overlays -->
<HealBeam />
<SpotterFlashEffect />
<GameSounds />
<MarkOverlay />
