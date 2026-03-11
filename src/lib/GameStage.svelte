<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core';
	import * as THREE from 'three';
	import { useSpacetimeDB, useTable } from 'spacetimedb/svelte';
	import { tables } from '../module_bindings/index.js';
	import { gameState, gameActions } from '../game.svelte.js';
	import { localPos, input, updateLocalMovement, resetLocalState, localAim } from '../localGameState.svelte.js';
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

	const session = $derived($sessions.find(s => s.id === gameState.currentSessionId));
	const myState = $derived($players.find(
		p => p.playerIdentity.toHexString() === $conn.identity?.toHexString() &&
		     p.sessionId === gameState.currentSessionId
	));
	const otherPlayers = $derived($players.filter(
		p => p.playerIdentity.toHexString() !== $conn.identity?.toHexString() &&
		     p.sessionId === gameState.currentSessionId
	));
	const liveEnemies = $derived($enemies.filter(
		e => e.sessionId === gameState.currentSessionId && e.isAlive
	));
	const livePools = $derived($acidPools.filter(
		p => p.sessionId === gameState.currentSessionId
	));

	const CLASS_COLORS: Record<string, string> = {
		spotter: '#4af',
		gunner:  '#f84',
		tank:    '#8a4',
		healer:  '#f4a',
	};

	onMount(() => { resetLocalState(); });

	// Mouse → ground plane raycasting
	const { camera, renderer } = useThrelte();
	const raycaster = new THREE.Raycaster();
	const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
	const aimTarget = new THREE.Vector3();
	const mouse = new THREE.Vector2();

	function onMouseMove(e: MouseEvent) {
		const canvas = renderer.domElement;
		const rect = canvas.getBoundingClientRect();
		mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
		mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
		raycaster.setFromCamera(mouse, camera.current);
		if (raycaster.ray.intersectPlane(groundPlane, aimTarget)) {
			localAim.x = aimTarget.x;
			localAim.z = aimTarget.z;
		}
	}

	// Angle to rotate player group so its -Z faces the aim point
	const aimAngle = $derived(
		Math.atan2(localPos.x - localAim.x, localPos.z - localAim.z)
	);

	let sendTimer = 0;
	const SEND_INTERVAL = 1 / 15;

	useTask((dt) => {
		if (!myState || myState.status !== 'alive') return;

		const hasStamina = myState.stamina > 0n;
		updateLocalMovement(dt, myState.classChoice, hasStamina);

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
				facingAngle: BigInt(Math.round(aimAngle * 1000)),
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
	<T.Group position={[localPos.x, localPos.y, localPos.z]} rotation={[0, aimAngle, 0]}>
		<T.Mesh>
			<T.CapsuleGeometry args={[0.4, 1.2]} />
			<T.MeshStandardMaterial color={CLASS_COLORS[myState.classChoice] ?? '#4a8'} />
		</T.Mesh>
		<!-- Facing nub -->
		<T.Mesh position={[0, 0, -0.45]}>
			<T.SphereGeometry args={[0.12, 6, 4]} />
			<T.MeshBasicMaterial color={CLASS_COLORS[myState.classChoice] ?? '#4a8'} />
		</T.Mesh>
		<!-- Spotter flashlight cone -->
		{#if myState.classChoice === 'spotter'}
			<T.Mesh position={[0, 0.3, -7.5]} rotation={[-Math.PI / 2, 0, 0]}>
				<T.ConeGeometry args={[3, 15, 12, 1, true]} />
				<T.MeshBasicMaterial color="#ffff88" transparent opacity={0.12} side={2} />
			</T.Mesh>
			<!-- Small bright disc at torch end -->
			<T.Mesh position={[0, 0.3, -0.5]} rotation={[-Math.PI / 2, 0, 0]}>
				<T.CircleGeometry args={[0.15, 8]} />
				<T.MeshBasicMaterial color="#ffffcc" />
			</T.Mesh>
		{/if}
	</T.Group>
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
