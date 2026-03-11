<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core';
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
		localAim
	} from '../localGameState.svelte.js';
	import { onMount } from 'svelte';
	import PlayerEntity from './PlayerEntity.svelte';
	import EnemyEntity from './EnemyEntity.svelte';
	import AcidPoolEntity from './AcidPoolEntity.svelte';
	import MarkOverlay from './MarkOverlay.svelte';
	import DayNightSky from './DayNightSky.svelte';

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
	const liveEnemies = $derived(
		$enemies.filter((e) => e.sessionId === gameState.currentSessionId && e.isAlive)
	);
	const livePools = $derived($acidPools.filter((p) => p.sessionId === gameState.currentSessionId));

	const CLASS_RANGE: Record<string, number> = {
		spotter: 15,
		gunner: 10,
		healer: 10,
		tank: 5
	};

	onMount(() => {
		resetLocalState();
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
	const SEND_INTERVAL = 1 / 45;

	useTask((dt) => {
		if (!myState || myState.status !== 'alive') return;

		if (hasMouse) {
			const LERP = 1 - Math.pow(0.001, dt);
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
		updateLocalMovement(dt, myState.classChoice, hasStamina, camYaw);

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

<svelte:window onmousemove={onMouseMove} />

<DayNightSky phase={session?.dayPhase ?? 'sunset'} />

<!-- Ground plane -->
<T.Mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
	<T.PlaneGeometry args={[500, 500]} />
	<T.MeshStandardMaterial color="#1a3a10" />
</T.Mesh>

<!-- Local player (predicted position, rotated toward aim) -->
{#if myState}
	<PlayerEntity
		player={myState}
		isLocal={true}
		overridePos={{ x: localPos.x, y: localPos.y, z: localPos.z }}
		overrideFacing={aimAngle}
		overrideAim={{ x: localAim.x, z: localAim.z }}
		overrideVel={{ x: localVelocity.x, z: localVelocity.z }}
	/>
{/if}

<!-- Remote players (server position, interpolated) -->
{#each otherPlayers as player (player.id)}
	<PlayerEntity {player} />
{/each}

<!-- Enemies (interpolated) -->
{#each liveEnemies as enemy (enemy.id)}
	<EnemyEntity {enemy} />
{/each}

<!-- Acid pools -->
{#each livePools as pool (pool.id)}
	<AcidPoolEntity {pool} />
{/each}

<!-- Mark / ping overlays -->
<MarkOverlay />
