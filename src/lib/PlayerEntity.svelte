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
		overrideVel?: Vec2;
	};
	let {
		player,
		isLocal = false,
		overridePos,
		overrideFacing,
		overrideAim,
		overrideVel
	}: Props = $props();

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

	const limbR = $derived(
		player.classChoice === 'tank' ? 0.075 : player.classChoice === 'gunner' ? 0.06 : 0.05
	);

	let shotPulse = $state(0);
	let walkPhase = $state(0);
	let speed = $state(0);
	let prevX = $state(0);
	let prevZ = $state(0);

	useTask((dt) => {
		const lastShotMicros = (player as any).lastShotAt?.microsSinceUnixEpoch as bigint | undefined;
		if (lastShotMicros) {
			const ageMs = Date.now() - Number(lastShotMicros) / 1000;
			shotPulse = ageMs >= 0 && ageMs < 200 ? 1 - ageMs / 200 : 0;
		} else {
			shotPulse = 0;
		}

		if (isLocal && overridePos) {
			displayX = overridePos.x;
			displayY = overridePos.y;
			displayZ = overridePos.z;
			if (overrideVel) {
				speed = Math.hypot(overrideVel.x, overrideVel.z);
			}
		} else {
			const LERP = 1 - Math.pow(0.001, dt);
			displayX += (targetX - displayX) * LERP;
			displayY += (targetY - displayY) * LERP;
			displayZ += (targetZ - displayZ) * LERP;
			const vx = (displayX - prevX) / Math.max(0.0001, dt);
			const vz = (displayZ - prevZ) / Math.max(0.0001, dt);
			speed = Math.hypot(vx, vz);
		}

		prevX = displayX;
		prevZ = displayZ;

		if (speed > 0.2) {
			const stride = speed > 6 ? 10 : 7;
			walkPhase += dt * stride;
		}
	});
</script>

{#if player.status !== 'eliminated'}
	{@const moveIntensity = Math.min(speed / 6, 1)}
	{@const swing = Math.sin(walkPhase) * 0.9 * moveIntensity}
	{@const bob = Math.abs(Math.sin(walkPhase)) * 0.05 * moveIntensity}
	{@const isSprinting = speed > 6}
	{@const holdAim = player.classChoice === 'spotter' || player.classChoice === 'gunner'}
	{@const sway = Math.sin(walkPhase * 0.5) * 0.12 * moveIntensity}
	{@const armBop = isSprinting ? Math.sin(walkPhase) * 0.15 * moveIntensity : 0}
	{@const leftArmRotX = holdAim ? armBop : -swing}
	{@const rightArmRotX = holdAim ? -armBop : swing}
	{@const leftArmYaw = holdAim ? 0 : 0}
	{@const rightArmYaw = holdAim ? 0 : 0}
	{@const armForwardZ = holdAim ? -0.12 : 0}
	<T.Group
		position={[displayX, displayY + bob, displayZ]}
		rotation={[sway * 0.05, facing, sway * 0.08]}
	>
		<!-- Stick torso -->
		<T.Mesh position={[0, 1.05, 0]}>
			<T.CylinderGeometry args={[0.08, 0.08, 1.0, 6]} />
			<T.MeshStandardMaterial color={CLASS_COLORS[player.classChoice] ?? '#fff'} />
		</T.Mesh>
		<!-- Head -->
		<T.Mesh position={[0, 1.65, 0]}>
			<T.SphereGeometry args={[0.18, 8, 6]} />
			<T.MeshStandardMaterial color="#d9c5a7" />
		</T.Mesh>
		<!-- Legs with knees -->
		<T.Group position={[-0.12, 0.75, 0]} rotation={[swing, 0, 0]}>
			<T.Mesh position={[0, -0.2, 0]}>
				<T.CylinderGeometry args={[limbR, limbR, 0.4, 6]} />
				<T.MeshStandardMaterial color="#3a2f25" />
			</T.Mesh>
			<T.Mesh position={[0, -0.4, 0]}>
				<T.SphereGeometry args={[limbR * 0.95, 6, 4]} />
				<T.MeshStandardMaterial color="#3a2f25" />
			</T.Mesh>
			<T.Mesh position={[0, -0.65, 0]}>
				<T.CylinderGeometry args={[limbR, limbR, 0.5, 6]} />
				<T.MeshStandardMaterial color="#3a2f25" />
			</T.Mesh>
		</T.Group>
		<T.Group position={[0.12, 0.75, 0]} rotation={[-swing, 0, 0]}>
			<T.Mesh position={[0, -0.2, 0]}>
				<T.CylinderGeometry args={[limbR, limbR, 0.4, 6]} />
				<T.MeshStandardMaterial color="#3a2f25" />
			</T.Mesh>
			<T.Mesh position={[0, -0.4, 0]}>
				<T.SphereGeometry args={[limbR * 0.95, 6, 4]} />
				<T.MeshStandardMaterial color="#3a2f25" />
			</T.Mesh>
			<T.Mesh position={[0, -0.65, 0]}>
				<T.CylinderGeometry args={[limbR, limbR, 0.5, 6]} />
				<T.MeshStandardMaterial color="#3a2f25" />
			</T.Mesh>
		</T.Group>
		<!-- Arms with elbows -->
		<T.Group position={[-0.25, 1.25, armForwardZ]} rotation={[leftArmRotX, leftArmYaw, 0]}>
			<T.Mesh position={[0, -0.18, 0]}>
				<T.CylinderGeometry args={[limbR * 0.9, limbR * 0.9, 0.36, 6]} />
				<T.MeshStandardMaterial color="#3a2f25" />
			</T.Mesh>
			<T.Mesh position={[0, -0.36, 0]}>
				<T.SphereGeometry args={[limbR * 0.9, 6, 4]} />
				<T.MeshStandardMaterial color="#3a2f25" />
			</T.Mesh>
			<T.Mesh position={[0, -0.58, 0]}>
				<T.CylinderGeometry args={[limbR * 0.9, limbR * 0.9, 0.44, 6]} />
				<T.MeshStandardMaterial color="#3a2f25" />
			</T.Mesh>
			<!-- Left hand attachment -->
			<T.Group position={[0, -0.78, -0.1]}>
				{#if player.classChoice === 'gunner'}
					{@const recoil = shotPulse * 0.18}
					<T.Mesh position={[0, 0, -0.25 - recoil]} rotation={[Math.PI / 2, 0, 0]}>
						<T.CylinderGeometry args={[0.05, 0.06, 0.4, 6]} />
						<T.MeshStandardMaterial color="#2b2b2b" />
					</T.Mesh>
					{#if shotPulse > 0}
						<T.Mesh position={[0, 0, -0.65 - recoil]} scale={[shotPulse, shotPulse, shotPulse]}>
							<T.ConeGeometry args={[0.12, 0.3, 6]} />
							<T.MeshBasicMaterial color="#ffcc55" transparent opacity={shotPulse} />
						</T.Mesh>
					{/if}
				{/if}
			</T.Group>
		</T.Group>
		<T.Group position={[0.25, 1.25, armForwardZ]} rotation={[rightArmRotX, rightArmYaw, 0]}>
			<T.Mesh position={[0, -0.18, 0]}>
				<T.CylinderGeometry args={[limbR * 0.9, limbR * 0.9, 0.36, 6]} />
				<T.MeshStandardMaterial color="#3a2f25" />
			</T.Mesh>
			<T.Mesh position={[0, -0.36, 0]}>
				<T.SphereGeometry args={[limbR * 0.9, 6, 4]} />
				<T.MeshStandardMaterial color="#3a2f25" />
			</T.Mesh>
			<T.Mesh position={[0, -0.58, 0]}>
				<T.CylinderGeometry args={[limbR * 0.9, limbR * 0.9, 0.44, 6]} />
				<T.MeshStandardMaterial color="#3a2f25" />
			</T.Mesh>
			<!-- Right hand attachment -->
			<T.Group position={[0, -0.78, -0.1]}>
				{#if player.classChoice === 'spotter'}
					<T.Mesh position={[0, 0, -0.18]} rotation={[-Math.PI / 2, 0, 0]}>
						<T.ConeGeometry args={[0.12, 0.3, 8]} />
						<T.MeshStandardMaterial color="#bdbdbd" />
					</T.Mesh>
					<T.Mesh position={[0, 0, -7.6]} rotation={[Math.PI / 2, 0, 0]}>
						<T.ConeGeometry args={[3, 15, 12, 1, true]} />
						<T.MeshBasicMaterial color="#ffff88" transparent opacity={0.12} side={2} />
					</T.Mesh>
					<T.Mesh position={[0, 0, -15]} rotation={[-Math.PI / 2, 0, 0]}>
						<T.CircleGeometry args={[0.18, 8]} />
						<T.MeshBasicMaterial color="#ffffcc" />
					</T.Mesh>
				{:else if player.classChoice === 'gunner'}
					{@const recoil = shotPulse * 0.18}
					<T.Mesh position={[0, 0, -0.25 - recoil]} rotation={[Math.PI / 2, 0, 0]}>
						<T.CylinderGeometry args={[0.05, 0.06, 0.4, 6]} />
						<T.MeshStandardMaterial color="#2b2b2b" />
					</T.Mesh>
					{#if shotPulse > 0}
						<T.Mesh position={[0, 0, -0.65 - recoil]} scale={[shotPulse, shotPulse, shotPulse]}>
							<T.ConeGeometry args={[0.12, 0.3, 6]} />
							<T.MeshBasicMaterial color="#ffcc55" transparent opacity={shotPulse} />
						</T.Mesh>
					{/if}
				{:else if player.classChoice === 'healer'}
					{@const recoil = shotPulse * 0.12}
					<T.Mesh position={[0, 0, -0.25 - recoil]} rotation={[Math.PI / 2, 0, 0]}>
						<T.CylinderGeometry args={[0.05, 0.06, 0.45, 6]} />
						<T.MeshStandardMaterial color="#2b2b2b" />
					</T.Mesh>
					{#if shotPulse > 0}
						<T.Mesh position={[0, 0, -0.65 - recoil]} scale={[shotPulse, shotPulse, shotPulse]}>
							<T.ConeGeometry args={[0.12, 0.3, 6]} />
							<T.MeshBasicMaterial color="#ffcc55" transparent opacity={shotPulse} />
						</T.Mesh>
					{/if}
				{/if}
			</T.Group>
		</T.Group>
		<!-- Facing nub -->
		<T.Mesh position={[0, 0.1, -0.35]}>
			<T.SphereGeometry args={[0.08, 6, 4]} />
			<T.MeshBasicMaterial color={CLASS_COLORS[player.classChoice] ?? '#fff'} />
		</T.Mesh>
	</T.Group>
	<AimReticle x={aimX} z={aimZ} color={CLASS_COLORS[player.classChoice] ?? '#fff'} />
{/if}
