<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import type { PlayerState } from '../module_bindings/types.js';

	type Props = { player: PlayerState };
	let { player }: Props = $props();

	let displayX = $state(0);
	let displayY = $state(0);
	let displayZ = $state(0);

	const targetX = $derived(Number(player.posX) / 1000);
	const targetY = $derived(Number(player.posY) / 1000);
	const targetZ = $derived(Number(player.posZ) / 1000);

	const CLASS_COLORS: Record<string, string> = {
		spotter: '#4af',
		gunner:  '#f84',
		tank:    '#8a4',
		healer:  '#f4a',
	};

	useTask((dt) => {
		const LERP = 1 - Math.pow(0.001, dt);
		displayX += (targetX - displayX) * LERP;
		displayY += (targetY - displayY) * LERP;
		displayZ += (targetZ - displayZ) * LERP;
	});
</script>

{#if player.status !== 'eliminated'}
	<T.Group position={[displayX, displayY, displayZ]} rotation={[0, Number(player.facingAngle) / 1000, 0]}>
		<T.Mesh>
			<T.CapsuleGeometry args={[0.4, 1.2]} />
			<T.MeshStandardMaterial
				color={player.status === 'downed' ? '#555' : CLASS_COLORS[player.classChoice] ?? '#fff'}
				opacity={player.status === 'downed' ? 0.5 : 1}
				transparent={player.status === 'downed'}
			/>
		</T.Mesh>
		<!-- Facing nub -->
		<T.Mesh position={[0, 0, -0.45]}>
			<T.SphereGeometry args={[0.12, 6, 4]} />
			<T.MeshBasicMaterial color={CLASS_COLORS[player.classChoice] ?? '#fff'} />
		</T.Mesh>
		<!-- Spotter flashlight cone -->
		{#if player.classChoice === 'spotter'}
			<T.Mesh position={[0, 0.3, -7.5]} rotation={[-Math.PI / 2, 0, 0]}>
				<T.ConeGeometry args={[3, 15, 12, 1, true]} />
				<T.MeshBasicMaterial color="#ffff88" transparent opacity={0.12} side={2} />
			</T.Mesh>
			<T.Mesh position={[0, 0.3, -0.5]} rotation={[-Math.PI / 2, 0, 0]}>
				<T.CircleGeometry args={[0.15, 8]} />
				<T.MeshBasicMaterial color="#ffffcc" />
			</T.Mesh>
		{/if}
	</T.Group>
{/if}
