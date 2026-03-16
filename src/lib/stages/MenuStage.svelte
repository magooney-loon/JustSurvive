<script lang="ts">
	import { T } from '@threlte/core';
	import { useTable, useSpacetimeDB } from 'spacetimedb/svelte';
	import { tables } from '$bindings/index.js';
	import LegsModel from '$lib/character/player/LegsModel.svelte';
	import TorsoModel from '$lib/character/player/TorsoModel.svelte';
	import { stageState } from '$root/stage.svelte.js';

	const conn = useSpacetimeDB();
	const [lobbyPlayers] = useTable(tables.lobbyPlayer);

	const myEntry = $derived(
		$lobbyPlayers?.find((p) => p.playerIdentity.toHexString() === $conn.identity?.toHexString())
	);
	const currentLobbyId = $derived(myEntry?.lobbyId);
	const players = $derived(
		currentLobbyId ? ($lobbyPlayers?.filter((p) => p.lobbyId === currentLobbyId) ?? []) : []
	);

	const otherPlayers = $derived(
		players
			.filter(
				(p) => p.playerIdentity.toHexString() !== $conn.identity?.toHexString() && p.classChoice
			)
			.slice(0, 3)
	);

	const isInLobby = $derived(stageState.currentStage === 'lobby' && myEntry?.classChoice);
</script>

<!-- Player class model on left side when in lobby -->
{#if isInLobby}
	<!-- Local player in center -->
	<T.Group position={[0, -0.5, -3]} rotation.y={Math.PI}>
		<LegsModel speed={0} />
		<TorsoModel speed={0} isShooting={0} />
	</T.Group>

	<!-- Other players around local player -->
	{#each otherPlayers as _, i}
		{@const positions = [
			[-1.2, 0.8],
			[1, 1.0],
			[1.2, 0.8],
			[-0.8, -0.5]
		]}
		{@const pos = positions[i] ?? [0, 0.8]}
		<T.Group position={[pos[0], -1.2 + pos[1], -3]} rotation.y={Math.PI} scale={0.85}>
			<LegsModel speed={0} />
			<TorsoModel speed={0} isShooting={0} />
		</T.Group>
	{/each}
{/if}
