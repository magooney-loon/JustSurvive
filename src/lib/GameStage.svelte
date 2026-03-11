<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { useSpacetimeDB, useTable } from 'spacetimedb/svelte';
	import { tables } from '../module_bindings/index.js';
	import { gameState, gameActions } from '../game.svelte.js';
	import { localPos, input, updateLocalMovement, resetLocalState } from '../localGameState.svelte.js';
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
			});
		}
	});
</script>

<DayNightSky phase={session?.dayPhase ?? 'sunset'} />

<!-- Ground plane -->
<T.Mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
	<T.PlaneGeometry args={[500, 500]} />
	<T.MeshStandardMaterial color="#1a3a10" />
</T.Mesh>

<!-- Local player (predicted position) -->
{#if myState}
	<T.Group position={[localPos.x, localPos.y, localPos.z]}>
		<T.Mesh>
			<T.CapsuleGeometry args={[0.4, 1.2]} />
			<T.MeshStandardMaterial color={CLASS_COLORS[myState.classChoice] ?? '#4a8'} />
		</T.Mesh>
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
