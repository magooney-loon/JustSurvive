<script lang="ts">
	import { useTask, useThrelte } from '@threlte/core';
	import * as THREE from 'three';
	import { useSpacetimeDB, useTable } from 'spacetimedb/svelte';
	import { tables } from '../module_bindings/index.js';
	import { gameState, gameActions } from '../game.svelte.js';
	import {
		localPos,
		localVelocity,
		input,
		updateLocalMovement,
		resetLocalState,
		localAim,
		cameraFollow,
		localHealthState,
		skyState
	} from '../localGameState.svelte.js';
	import { settingsState } from '../settings.svelte.js';
	import { onMount } from 'svelte';
	import PlayerEntity from './PlayerEntity.svelte';
	import EnemyEntity from './EnemyEntity.svelte';
	import EnemyProxyInstances from './EnemyProxyInstances.svelte';
	import AcidPoolEntity from './AcidPoolEntity.svelte';
	import MarkOverlay from './MarkOverlay.svelte';
	import GameGround from './GameGround.svelte';
	import HealBeam from './HealBeam.svelte';
	import GameSounds from './GameSounds.svelte';

	const conn = useSpacetimeDB();
	const [players] = useTable(tables.playerState);
	const [enemies] = useTable(tables.enemy);
	const [sessions] = useTable(tables.gameSession);
	const [acidPools] = useTable(tables.acidPool);

	const session = $derived($sessions.find((s) => s.id === gameState.currentSessionId));
	const myState = $derived(
		$players.find(
			(p) =>
				p.playerIdentity.toHexString() === $conn.identity?.toHexString() &&
				p.sessionId === gameState.currentSessionId
		)
	);
	const otherPlayers = $derived(
		$players.filter(
			(p) =>
				p.playerIdentity.toHexString() !== $conn.identity?.toHexString() &&
				p.sessionId === gameState.currentSessionId
		)
	);
	const MAX_RENDER_DIST = 70; // world units
	const NEAR_RENDER_DIST = 20; // world units
	const NEAR_DIST_SQ = NEAR_RENDER_DIST * NEAR_RENDER_DIST;
	const MAX_DIST_SQ = MAX_RENDER_DIST * MAX_RENDER_DIST;

	// Single pass over $enemies — avoids two O(n) scans and duplicate BigInt conversions
	const enemyGroups = $derived.by(() => {
		const near: (typeof $enemies)[number][] = [];
		const far: (typeof $enemies)[number][] = [];
		for (const e of $enemies) {
			if (e.sessionId !== gameState.currentSessionId) continue;
			if (!myState) {
				// No local player yet — show all as near (EnemyEntity handles death anim)
				near.push(e);
				continue;
			}
			const dx = Number(e.posX) / 1000 - localPos.x;
			const dz = Number(e.posZ) / 1000 - localPos.z;
			const d2 = dx * dx + dz * dz;
			if (d2 <= NEAR_DIST_SQ) {
				near.push(e);
			} else if (e.isAlive && d2 <= MAX_DIST_SQ) {
				far.push(e);
			}
		}
		return { near, far };
	});

	const livePools = $derived(
		myState
			? $acidPools.filter((p) => {
					if (p.sessionId !== gameState.currentSessionId) return false;
					const dx = Number(p.posX) / 1000 - localPos.x;
					const dz = Number(p.posZ) / 1000 - localPos.z;
					return dx * dx + dz * dz <= MAX_DIST_SQ;
				})
			: $acidPools.filter((p) => p.sessionId === gameState.currentSessionId)
	);
	const alivePlayers = $derived(
		$players.filter((p) => p.sessionId === gameState.currentSessionId && p.status === 'alive')
	);
	const phase = $derived(session?.dayPhase ?? 'sunset');

	const PHASE_SKY = {
		sunset:     { elevation: 3,   azimuth: 260, turbidity: 12, rayleigh: 2.5,  mieC: 0.007, mieG: 0.80, ambient: 0.60, sun: 1.00, sunR: 1.0,  sunG: 0.75, sunB: 0.45 },
		dusk:       { elevation: 0,   azimuth: 255, turbidity: 10, rayleigh: 1.5,  mieC: 0.005, mieG: 0.75, ambient: 0.35, sun: 0.50, sunR: 0.85, sunG: 0.55, sunB: 0.30 },
		twilight:   { elevation: -3,  azimuth: 250, turbidity: 8,  rayleigh: 0.5,  mieC: 0.004, mieG: 0.70, ambient: 0.18, sun: 0.12, sunR: 0.45, sunG: 0.45, sunB: 0.65 },
		night:      { elevation: -8,  azimuth: 180, turbidity: 6,  rayleigh: 0.2,  mieC: 0.003, mieG: 0.70, ambient: 0.07, sun: 0.04, sunR: 0.30, sunG: 0.35, sunB: 0.55 },
		deep_night: { elevation: -15, azimuth: 180, turbidity: 4,  rayleigh: 0.08, mieC: 0.002, mieG: 0.70, ambient: 0.03, sun: 0.01, sunR: 0.20, sunG: 0.25, sunB: 0.40 },
	} as const;

	const CLASS_RANGE: Record<string, number> = {
		spotter: 15,
		gunner: 10,
		healer: 10,
		tank: 5
	};

	onMount(() => {
		resetLocalState();
	});

	$effect(() => {
		const hp = myState?.hp ?? null;
		const max = myState?.maxHp ?? null;
		localHealthState.ratio = hp !== null && max && max > 0n
			? Math.max(0, Math.min(1, Number(hp) / Number(max)))
			: 1;
	});

	// Mouse → screen-space aim direction
	const { camera, renderer } = useThrelte();
	const mouse = new THREE.Vector2();
	const cameraDir = new THREE.Vector3();
	const playerScreen = new THREE.Vector3();
	const cameraRight = new THREE.Vector3();
	const worldUp = new THREE.Vector3(0, 1, 0);
	let hasMouse = false;
	const lastAimDir = new THREE.Vector2(0, -1);
	const targetAimDir = new THREE.Vector2(0, -1);
	let spectateIndex = $state(0);

	function onMouseDownSpectate(e: MouseEvent) {
		if (!myState || myState.status !== 'eliminated') return;
		if (e.button !== 0) return;
		if (alivePlayers.length === 0) return;
		spectateIndex = (spectateIndex + 1) % alivePlayers.length;
	}

	function onMouseMove(e: MouseEvent) {
		const canvas = renderer.domElement;
		const rect = canvas.getBoundingClientRect();
		const px = e.clientX - rect.left;
		const py = e.clientY - rect.top;
		mouse.x = (px / rect.width) * 2 - 1;
		mouse.y = -(py / rect.height) * 2 + 1;
		hasMouse = true;
		if (camera.current) {
			playerScreen.set(localPos.x, localPos.y + 1, localPos.z).project(camera.current);
			const dx = mouse.x - playerScreen.x;
			const dy = mouse.y - playerScreen.y;
			const len = Math.hypot(dx, dy);
			if (len < 0.02) return;

			camera.current.getWorldDirection(cameraDir);
			cameraDir.y = 0;
			const fLen = Math.hypot(cameraDir.x, cameraDir.z);
			if (fLen === 0) return;
			cameraDir.x /= fLen;
			cameraDir.z /= fLen;
			cameraRight.crossVectors(cameraDir, worldUp).normalize();

			// Use screen offset as yaw around the player; ignore vertical for stability
			const dirX = cameraRight.x * dx + cameraDir.x;
			const dirZ = cameraRight.z * dx + cameraDir.z;
			const dLen = Math.hypot(dirX, dirZ);
			if (dLen < 0.001) return;
			targetAimDir.set(dirX / dLen, dirZ / dLen);
		}
	}

	// Angle to rotate player group so its -Z faces the aim point
	const aimAngle = $derived(Math.atan2(localPos.x - localAim.x, localPos.z - localAim.z));

	let sendTimer = 0;
	const SEND_INTERVAL = 1 / 60;

	useTask((dt) => {
		// ── Sky lerp (always runs) ──────────────────────────────────────────
		const skyTarget = PHASE_SKY[phase as keyof typeof PHASE_SKY] ?? PHASE_SKY.sunset;
		const t = Math.min(1, dt * 1.5);
		skyState.elevation        += (skyTarget.elevation - skyState.elevation) * t;
		skyState.azimuth          += (skyTarget.azimuth   - skyState.azimuth)   * t;
		skyState.turbidity        += (skyTarget.turbidity - skyState.turbidity) * t;
		skyState.rayleigh         += (skyTarget.rayleigh  - skyState.rayleigh)  * t;
		skyState.mieCoefficient   += (skyTarget.mieC      - skyState.mieCoefficient)  * t;
		skyState.mieDirectionalG  += (skyTarget.mieG      - skyState.mieDirectionalG) * t;
		skyState.ambientIntensity += (skyTarget.ambient   - skyState.ambientIntensity) * t;
		skyState.sunIntensity     += (skyTarget.sun       - skyState.sunIntensity)     * t;
		skyState.sunR += (skyTarget.sunR - skyState.sunR) * t;
		skyState.sunG += (skyTarget.sunG - skyState.sunG) * t;
		skyState.sunB += (skyTarget.sunB - skyState.sunB) * t;

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

		if (hasMouse) {
			const aimBase = Math.pow(0.001, settingsState.controls.mouseSensitivity);
		const LERP = 1 - Math.pow(aimBase, dt);
			lastAimDir.x += (targetAimDir.x - lastAimDir.x) * LERP;
			lastAimDir.y += (targetAimDir.y - lastAimDir.y) * LERP;
			const len = Math.hypot(lastAimDir.x, lastAimDir.y);
			if (len > 0.0001) {
				lastAimDir.x /= len;
				lastAimDir.y /= len;
			}
			const range = CLASS_RANGE[myState?.classChoice ?? 'gunner'] ?? 10;
			localAim.x = localPos.x + lastAimDir.x * range;
			localAim.z = localPos.z + lastAimDir.y * range;
		}

		const hasStamina = myState.stamina > 0n;
		let camYaw = 0;
		if (camera.current) {
			camera.current.getWorldDirection(cameraDir);
			cameraDir.y = 0;
			const len = Math.hypot(cameraDir.x, cameraDir.z);
			if (len > 0) {
				cameraDir.x /= len;
				cameraDir.z /= len;
				camYaw = Math.atan2(cameraDir.x, cameraDir.z);
			}
		}
		updateLocalMovement(dt, myState.classChoice, hasStamina, camYaw, myState.isBracing);

		sendTimer += dt;
		if (sendTimer >= SEND_INTERVAL) {
			sendTimer = 0;
			const px = BigInt(Math.round(localPos.x * 1000));
			const pz = BigInt(Math.round(localPos.z * 1000));
			gameActions.movePlayer({
				sessionId: gameState.currentSessionId!,
				posX: px,
				posY: BigInt(Math.round(localPos.y * 1000)),
				posZ: pz,
				isSprinting: input.sprint && hasStamina,
				facingAngle: BigInt(Math.round(aimAngle * 1000))
			});
		}
	});
</script>

<svelte:window onmousemove={onMouseMove} onmousedown={onMouseDownSpectate} />

<GameGround />

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
{#each enemyGroups.near as enemy (enemy.id)}
	<EnemyEntity {enemy} />
{/each}
{#if enemyGroups.far.length > 0}
	<EnemyProxyInstances enemies={enemyGroups.far} />
{/if}

<!-- Acid pools -->
{#each livePools as pool (pool.id)}
	<AcidPoolEntity {pool} />
{/each}

<!-- Mark / ping overlays -->
<HealBeam />
<GameSounds />
<MarkOverlay />
