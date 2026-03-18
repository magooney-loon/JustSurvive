<script lang="ts">
	import { T } from '@threlte/core';
	import { useTable, useSpacetimeDB } from 'spacetimedb/svelte';
	import { tables } from '$bindings/index.js';
	import GunnerLegsModel from '$lib/character/player/gunner/GunnerLegsModel.svelte';
	import GunnerTorsoModel from '$lib/character/player/gunner/GunnerTorsoModel.svelte';
	import SpotterLegsModel from '$lib/character/player/spotter/SpotterLegsModel.svelte';
	import SpotterTorsoModel from '$lib/character/player/spotter/SpotterTorsoModel.svelte';
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

	const isInLobby = $derived(stageState.currentStage === 'lobby' && myEntry);
	const hasClass = $derived(!!myEntry?.classChoice);

	function getLegsModel(classChoice: string) {
		if (classChoice === 'spotter') return SpotterLegsModel;
		return GunnerLegsModel;
	}

	function getTorsoModel(classChoice: string) {
		if (classChoice === 'spotter') return SpotterTorsoModel;
		return GunnerTorsoModel;
	}
</script>

<!-- Player class model on left side when in lobby -->
{#if isInLobby}
	<!-- Local player in center (only shown if class is selected) -->
	{#if hasClass && myEntry}
		{@const LegsModel = getLegsModel(myEntry.classChoice)}
		{@const TorsoModel = getTorsoModel(myEntry.classChoice)}
		<T.Group position={[0, -0.5, -3]} rotation.y={Math.PI}>
			<LegsModel speed={0} />
			<TorsoModel speed={0} isShooting={0} isUsingAbility={0} />
		</T.Group>
	{/if}

	<!-- Other players around local player -->
	{#each otherPlayers as p, i}
		{@const positions = [
			[-1.2, 0.8],
			[1, 1.0],
			[1.2, 0.8],
			[-0.8, -0.5]
		]}
		{@const pos = positions[i] ?? [0, 0.8]}
		{@const OtherLegsModel = getLegsModel(p.classChoice)}
		{@const OtherTorsoModel = getTorsoModel(p.classChoice)}
		<T.Group position={[pos[0], -1.2 + pos[1], -3]} rotation.y={Math.PI} scale={0.85}>
			<OtherLegsModel speed={0} />
			<OtherTorsoModel speed={0} isShooting={0} isUsingAbility={0} />
		</T.Group>
	{/each}
{/if}
