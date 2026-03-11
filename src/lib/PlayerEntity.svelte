<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import type { PlayerState } from '../module_bindings/types.js';
	import AimReticle from './AimReticle.svelte';
	import StickRig from './StickRig.svelte';

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
	const isDowned = $derived(player.status === 'downed');
	const downedTilt = $derived(isDowned ? -Math.PI / 2 : 0);
	const downedYOffset = $derived(isDowned ? -0.35 : 0);

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
	<T.Group
		position={[displayX, displayY + downedYOffset, displayZ]}
		rotation={[downedTilt, facing, 0]}
	>
		<StickRig
			classChoice={player.classChoice}
			color={CLASS_COLORS[player.classChoice] ?? '#fff'}
			{walkPhase}
			{speed}
			{shotPulse}
		/>
	</T.Group>
	<AimReticle x={aimX} z={aimZ} color={CLASS_COLORS[player.classChoice] ?? '#fff'} />
{/if}
