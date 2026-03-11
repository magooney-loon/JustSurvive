<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import type { PlayerState } from '../module_bindings/types.js';
	import AimReticle from './AimReticle.svelte';

	type Vec3 = { x: number; y: number; z: number };
	type Vec2 = { x: number; z: number };
	type Props = {
		player: PlayerState;
		isLocal?: boolean;
		overridePos?: Vec3;
		overrideFacing?: number;
		overrideAim?: Vec2;
	};
	let { player, isLocal = false, overridePos, overrideFacing, overrideAim }: Props = $props();

	let displayX = $state(0);
	let displayY = $state(0);
	let displayZ = $state(0);

	const targetX = $derived(Number(player.posX) / 1000);
	const targetY = $derived(Number(player.posY) / 1000);
	const targetZ = $derived(Number(player.posZ) / 1000);

	const CLASS_COLORS: Record<string, string> = {
		spotter: '#4af',
		gunner: '#f84',
		tank: '#8a4',
		healer: '#f4a'
	};

	const CLASS_RANGE: Record<string, number> = {
		spotter: 15,
		gunner: 10,
		healer: 10,
		tank: 5
	};

	const aimRange = $derived(CLASS_RANGE[player.classChoice] ?? 10);
	const facing = $derived(overrideFacing ?? Number(player.facingAngle) / 1000);
	const aimX = $derived(overrideAim?.x ?? displayX + -Math.sin(facing) * aimRange);
	const aimZ = $derived(overrideAim?.z ?? displayZ + -Math.cos(facing) * aimRange);

	let shotPulse = $state(0);

	useTask((dt) => {
		const lastShotMicros = (player as any).lastShotAt?.microsSinceUnixEpoch as bigint | undefined;
		if (lastShotMicros) {
			const ageMs = Date.now() - Number(lastShotMicros) / 1000;
			shotPulse = ageMs >= 0 && ageMs < 220 ? 1 - ageMs / 220 : 0;
		} else {
			shotPulse = 0;
		}

		if (isLocal && overridePos) {
			displayX = overridePos.x;
			displayY = overridePos.y;
			displayZ = overridePos.z;
			return;
		}
		const LERP = 1 - Math.pow(0.001, dt);
		displayX += (targetX - displayX) * LERP;
		displayY += (targetY - displayY) * LERP;
		displayZ += (targetZ - displayZ) * LERP;
	});
</script>

{#if player.status !== 'eliminated'}
	<T.Group position={[displayX, displayY, displayZ]} rotation={[0, facing, 0]}>
		<T.Group>
			<T.Mesh position={[0, 0.9, 0]}>
				<T.BoxGeometry args={[0.55, 0.8, 0.3]} />
				<T.MeshStandardMaterial
					color={player.status === 'downed' ? '#555' : (CLASS_COLORS[player.classChoice] ?? '#fff')}
					opacity={player.status === 'downed' ? 0.5 : 1}
					transparent={player.status === 'downed'}
				/>
			</T.Mesh>
			<T.Mesh position={[0, 1.5, 0]}>
				<T.SphereGeometry args={[0.22, 10, 8]} />
				<T.MeshStandardMaterial color="#d9c5a7" />
			</T.Mesh>
			<T.Mesh position={[-0.18, 0.3, 0]}>
				<T.CylinderGeometry args={[0.12, 0.12, 0.6, 6]} />
				<T.MeshStandardMaterial color="#3a2f25" />
			</T.Mesh>
			<T.Mesh position={[0.18, 0.3, 0]}>
				<T.CylinderGeometry args={[0.12, 0.12, 0.6, 6]} />
				<T.MeshStandardMaterial color="#3a2f25" />
			</T.Mesh>
		</T.Group>
		<!-- Facing nub -->
		<T.Mesh position={[0, 0, -0.45]}>
			<T.SphereGeometry args={[0.12, 6, 4]} />
			<T.MeshBasicMaterial color={CLASS_COLORS[player.classChoice] ?? '#fff'} />
		</T.Mesh>
		<!-- Spotter flashlight cone -->
		{#if player.classChoice === 'spotter'}
			<T.Mesh position={[0, 0.3, -7.5]} rotation={[Math.PI / 2, 0, 0]}>
				<T.ConeGeometry args={[3, 15, 12, 1, true]} />
				<T.MeshBasicMaterial color="#ffff88" transparent opacity={0.12} side={2} />
			</T.Mesh>
			<T.Mesh position={[0, 0.3, -15]} rotation={[-Math.PI / 2, 0, 0]}>
				<T.CircleGeometry args={[0.15, 8]} />
				<T.MeshBasicMaterial color="#ffffcc" />
			</T.Mesh>
		{/if}
		{#if player.classChoice === 'gunner'}
			{@const recoil = shotPulse * 0.18}
			<T.Group position={[0, 0.6, -0.25]}>
				<T.Mesh position={[-0.35, 0, -0.2 - recoil]} rotation={[0.2, 0, 0.1]}>
					<T.CylinderGeometry args={[0.06, 0.07, 0.5, 6]} />
					<T.MeshStandardMaterial color="#2b2b2b" />
				</T.Mesh>
				<T.Mesh position={[0.35, 0, -0.2 - recoil]} rotation={[0.2, 0, -0.1]}>
					<T.CylinderGeometry args={[0.06, 0.07, 0.5, 6]} />
					<T.MeshStandardMaterial color="#2b2b2b" />
				</T.Mesh>
				<T.Mesh position={[-0.35, 0.05, -0.55 - recoil]}>
					<T.BoxGeometry args={[0.14, 0.1, 0.28]} />
					<T.MeshStandardMaterial color="#1a1a1a" />
				</T.Mesh>
				<T.Mesh position={[0.35, 0.05, -0.55 - recoil]}>
					<T.BoxGeometry args={[0.14, 0.1, 0.28]} />
					<T.MeshStandardMaterial color="#1a1a1a" />
				</T.Mesh>
				{#if shotPulse > 0}
					<T.Mesh
						position={[-0.35, 0.05, -0.95 - recoil]}
						scale={[shotPulse, shotPulse, shotPulse]}
					>
						<T.ConeGeometry args={[0.16, 0.45, 6]} />
						<T.MeshBasicMaterial color="#ffcc55" transparent opacity={shotPulse} />
					</T.Mesh>
					<T.Mesh position={[0.35, 0.05, -0.95 - recoil]} scale={[shotPulse, shotPulse, shotPulse]}>
						<T.ConeGeometry args={[0.16, 0.45, 6]} />
						<T.MeshBasicMaterial color="#ffcc55" transparent opacity={shotPulse} />
					</T.Mesh>
				{/if}
			</T.Group>
		{:else if player.classChoice === 'healer'}
			{@const recoil = shotPulse * 0.12}
			<T.Group position={[0, 0.85, -0.15]}>
				<T.Mesh position={[-0.4, 0, -0.1 - recoil]} rotation={[0.15, 0, 0.2]}>
					<T.CylinderGeometry args={[0.05, 0.06, 0.5, 6]} />
					<T.MeshStandardMaterial color="#2b2b2b" />
				</T.Mesh>
				<T.Mesh position={[0.4, 0, -0.1 - recoil]} rotation={[0.15, 0, -0.2]}>
					<T.CylinderGeometry args={[0.05, 0.06, 0.5, 6]} />
					<T.MeshStandardMaterial color="#2b2b2b" />
				</T.Mesh>
				{#if shotPulse > 0}
					<T.Mesh position={[-0.4, 0, -0.5 - recoil]} scale={[shotPulse, shotPulse, shotPulse]}>
						<T.ConeGeometry args={[0.12, 0.35, 6]} />
						<T.MeshBasicMaterial color="#ffcc55" transparent opacity={shotPulse} />
					</T.Mesh>
					<T.Mesh position={[0.4, 0, -0.5 - recoil]} scale={[shotPulse, shotPulse, shotPulse]}>
						<T.ConeGeometry args={[0.12, 0.35, 6]} />
						<T.MeshBasicMaterial color="#ffcc55" transparent opacity={shotPulse} />
					</T.Mesh>
				{/if}
			</T.Group>
		{/if}
	</T.Group>
	<AimReticle x={aimX} z={aimZ} color={CLASS_COLORS[player.classChoice] ?? '#fff'} />
{/if}
