<script lang="ts">
	import { T } from '@threlte/core';
	import { useTable, useSpacetimeDB } from 'spacetimedb/svelte';
	import { tables } from '$bindings/index.js';
	import SpotterRig from '$lib/character/player/spotter/SpotterRig.svelte';
	import GunnerRig from '$lib/character/player/gunner/GunnerRig.svelte';
	import TankRig from '$lib/character/player/tank/TankRig.svelte';
	import HealerRig from '$lib/character/player/healer/HealerRig.svelte';
	import { lobbyState } from '$lib/stores/lobby.svelte.js';
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

	const localClass = $derived(myEntry?.classChoice ?? lobbyState.localPlayerClass);

	const CLASS_COLORS: Record<string, string> = {
		spotter: '#4af',
		gunner: '#f84',
		tank: '#8a4',
		healer: '#f4a'
	};
</script>

<!-- Player class model on left side when in lobby -->
{#if isInLobby}
	<!-- Local player in center -->
	<T.Group position={[0, -0.5, -3]} rotation.y={Math.PI}>
		{#if localClass === 'spotter'}
			<SpotterRig
				color={CLASS_COLORS.spotter}
				walkPhase={0}
				speed={0}
				facing={0}
				velX={0}
				velZ={0}
				shotPulse={0}
				phase="sunset"
				isBracing={false}
			/>
		{:else if localClass === 'gunner'}
			<GunnerRig
				color={CLASS_COLORS.gunner}
				walkPhase={0}
				speed={0}
				facing={0}
				velX={0}
				velZ={0}
				shotPulse={0}
				phase="sunset"
				isBracing={false}
			/>
		{:else if localClass === 'tank'}
			<TankRig
				color={CLASS_COLORS.tank}
				walkPhase={0}
				speed={0}
				facing={0}
				velX={0}
				velZ={0}
				shotPulse={0}
				phase="sunset"
				isBracing={false}
				isCharging={false}
			/>
		{:else if localClass === 'healer'}
			<HealerRig
				color={CLASS_COLORS.healer}
				walkPhase={0}
				speed={0}
				facing={0}
				velX={0}
				velZ={0}
				shotPulse={0}
				phase="sunset"
				isBracing={false}
			/>
		{/if}
	</T.Group>

	<!-- Other players around local player -->
	{#each otherPlayers as player, i}
		{@const positions = [
			[-1.2, 0.8],
			[1, 1.0],
			[1.2, 0.8],
			[-0.8, -0.5]
		]}
		{@const pos = positions[i] ?? [0, 0.8]}
		<T.Group position={[pos[0], -1.2 + pos[1], -3]} rotation.y={Math.PI} scale={0.85}>
			{#if player.classChoice === 'spotter'}
				<SpotterRig
					color={CLASS_COLORS.spotter}
					walkPhase={0}
					speed={0}
					facing={0}
					velX={0}
					velZ={0}
					shotPulse={0}
					phase="sunset"
					isBracing={false}
				/>
			{:else if player.classChoice === 'gunner'}
				<GunnerRig
					color={CLASS_COLORS.gunner}
					walkPhase={0}
					speed={0}
					facing={0}
					velX={0}
					velZ={0}
					shotPulse={0}
					phase="sunset"
					isBracing={false}
				/>
			{:else if player.classChoice === 'tank'}
				<TankRig
					color={CLASS_COLORS.tank}
					walkPhase={0}
					speed={0}
					facing={0}
					velX={0}
					velZ={0}
					shotPulse={0}
					phase="sunset"
					isBracing={false}
					isCharging={false}
				/>
			{:else if player.classChoice === 'healer'}
				<HealerRig
					color={CLASS_COLORS.healer}
					walkPhase={0}
					speed={0}
					facing={0}
					velX={0}
					velZ={0}
					shotPulse={0}
					phase="sunset"
					isBracing={false}
				/>
			{/if}
		</T.Group>
	{/each}
{/if}
