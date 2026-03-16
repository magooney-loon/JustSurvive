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
		tpsCamera,
		cameraFollow,
		spectateState
	} from '$lib/stores/movement.svelte.js';
	import { resetAbilities, abilityState } from '$lib/stores/abilities.svelte.js';
	import {
		localHealthState,
		resetLocalHealth,
		skyState,
		devSky,
		PHASE_SKY
	} from '$lib/stores/sky.svelte.js';
	import { onMount } from 'svelte';
	import PlayerEntity from '$lib/character/PlayerEntity.svelte';
	import EnemyEntity from '$lib/character/EnemyEntity.svelte';
	import BossEntity from '$lib/character/enemies/boss/BossEntity.svelte';
	import AcidPoolEntity from '$lib/character/enemies/AcidPoolEntity.svelte';
	import DroppedItemEntity from '$lib/character/DroppedItemEntity.svelte';

	import GameSounds from '$lib/stages/GameSounds.svelte';

	const conn = useSpacetimeDB();
	const [players] = useTable(tables.playerState);
	const [enemies] = useTable(tables.enemy);
	const [bosses] = useTable(tables.boss);
	const [tankStates] = useTable(tables.tankState);
	const [sessions] = useTable(tables.gameSession);
	const [acidPools] = useTable(tables.acidPool);
	const [droppedItems] = useTable(tables.droppedItem);

	const session = $derived($sessions.find((s) => s.id === lobbyState.currentSessionId));
	const myTankState = $derived(
		$tankStates.find(
			(t) =>
				t.playerIdentity.toHexString() === $conn.identity?.toHexString() &&
				t.sessionId === lobbyState.currentSessionId
		)
	);
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
			if (d2 <= MAX_DIST_SQ) {
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
	const phase = $derived(devSky.forcedPhase ?? session?.dayPhase ?? 'sunset');

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

	// Reset health state when game session ends
	$effect(() => {
		if (session?.status === 'finished') {
			resetLocalHealth();
		}
	});

	// Angle to rotate player group so its -Z faces the aim point
	const aimAngle = $derived(Math.atan2(localPos.x - localAim.x, localPos.z - localAim.z));

	let sendTimer = 0;
	const SEND_INTERVAL = 1 / 60;

	useTask((dt) => {
		// ── Sky lerp (always runs) ──────────────────────────────────────────
		const skyTarget = PHASE_SKY[phase as keyof typeof PHASE_SKY] ?? PHASE_SKY.sunset;
		const t = Math.min(1, dt * 1.5);
		skyState.phase = phase;
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

		cameraFollow.active = false;
		if (!myState || myState.status !== 'alive') {
			// Spectate alive teammates when downed — move localPos to target so TPS camera follows them
			if (myState?.status === 'downed') {
				const alivePeers = otherPlayers.filter((p) => p.status === 'alive');
				if (alivePeers.length > 0) {
					const target = alivePeers[spectateState.index % alivePeers.length];
					localPos.x = Number(target.posX) / 1000;
					localPos.z = Number(target.posZ) / 1000;
				}
			}
			return;
		}

		// TPS aim: project camera forward onto the ground plane
		const range = CLASS_RANGE[myState?.classChoice ?? 'gunner'] ?? 10;
		localAim.x = localPos.x + -Math.sin(tpsCamera.yaw) * range;
		localAim.z = localPos.z + -Math.cos(tpsCamera.yaw) * range;

		const hasStamina = myState.stamina > 0n;
		// camYaw for movement: camera forward is (-sin(yaw), -cos(yaw)), so pass yaw+π
		const camYaw = tpsCamera.yaw + Math.PI;
		const nowMs = Date.now();
		const isStunned = myState.stunUntil
			? Number(myState.stunUntil.microsSinceUnixEpoch) / 1000 > nowMs
			: false;
		const slowMultiplier = myState.slowedUntil
			? Number(myState.slowedUntil.microsSinceUnixEpoch) / 1000 > nowMs
				? 0.45
				: 1.0
			: 1.0;
		updateLocalMovement(
			dt,
			myState.classChoice,
			hasStamina,
			camYaw,
			myTankState?.isCharging ?? false,
			isStunned,
			slowMultiplier,
			abilityState.chargeYaw
		);

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

<!-- Local player (predicted position when alive, server position when downed) -->
{#if myState}
	{#if myState.status === 'alive'}
		<PlayerEntity
			player={myState}
			isLocal={true}
			overridePos={{ x: localPos.x, y: localPos.y, z: localPos.z }}
			overrideFacing={aimAngle}
			overrideAim={{ x: localAim.x, z: localAim.z }}
			overrideVel={{ x: localVelocity.x, z: localVelocity.z }}
		/>
	{:else}
		<PlayerEntity player={myState} isLocal={true} />
	{/if}
{/if}

<!-- Remote players (server position, interpolated) -->
{#each otherPlayers as player (player.id)}
	<PlayerEntity {player} />
{/each}

<!-- Enemies (interpolated) -->
{#each visibleEnemies as enemy (enemy.id)}
	<EnemyEntity {enemy} alivePlayers={$players.filter((p: any) => p.status === 'alive')} />
{/each}

<!-- Bosses -->
{#each $bosses.filter((b) => b.sessionId === lobbyState.currentSessionId) as boss (boss.id)}
	<BossEntity {boss} />
{/each}

<!-- Item drops -->
{#each $droppedItems.filter((i) => i.sessionId === lobbyState.currentSessionId) as item (item.id)}
	<DroppedItemEntity
		posX={item.posX}
		posZ={item.posZ}
		itemType={item.itemType}
		spawnedAt={item.spawnedAt as any}
	/>
{/each}

<!-- Acid pools -->
{#each livePools as pool (pool.id)}
	<AcidPoolEntity {pool} />
{/each}

<GameSounds />
