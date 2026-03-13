<script module lang="ts">
	import { MeshLambertMaterial } from 'three';
	const _lc = new Map<string, MeshLambertMaterial>();
	export function eL(hex: string): MeshLambertMaterial {
		let m = _lc.get(hex);
		if (!m) _lc.set(hex, (m = new MeshLambertMaterial({ color: hex })));
		return m;
	}
</script>

<script lang="ts">
	import { T } from '@threlte/core';
	import type { Texture } from 'three';
	import PlayerRig from '$lib/character/PlayerRig.svelte';

	export type HealerRigProps = {
		color: string;
		walkPhase: number;
		speed: number;
		shotPulse: number;
		phase?: string;
		isBracing?: boolean;
		texture?: Texture | null;
	};

	let {
		color,
		walkPhase,
		speed,
		shotPulse,
		phase = 'sunset',
		isBracing = false,
		texture = null
	}: HealerRigProps = $props();

	const moveIntensity = $derived(Math.min(speed / 6, 1));
	const sinWalk = $derived(Math.sin(walkPhase));
	const sinHalf = $derived(Math.sin(walkPhase * 0.5));
	const swing = $derived(sinWalk * 1.1 * moveIntensity);
	const bob = $derived(Math.abs(sinWalk) * 0.07 * moveIntensity);
	const sway = $derived(sinHalf * 0.18 * moveIntensity);
	const hipShift = $derived(sinWalk * 0.06 * moveIntensity);
	const torsoTwist = $derived(sinWalk * 0.18 * moveIntensity);
	const isSprinting = $derived(speed > 6);
	const leanForward = $derived((isSprinting ? 0.22 : 0.08) * moveIntensity);

	const armForwardZ = -0.2;
	const rightArmRotX = $derived(swing * 0.8);
</script>

<PlayerRig
	classChoice="healer"
	{color}
	{walkPhase}
	{speed}
	{shotPulse}
	{phase}
	{isBracing}
	{texture}
/>

<T.Group position={[hipShift, bob, 0]} rotation={[sway * 0.08, torsoTwist, sway * 0.12]}>
	<T.Group position={[0.24, 1.1, armForwardZ - leanForward * 0.6]} rotation={[rightArmRotX, 0, 0]}>
		{@const recoil = shotPulse * 0.12}
		<T.Mesh position={[0, 0, -0.6 - recoil]} rotation={[Math.PI / 2, 0, 0]}>
			<T.CylinderGeometry args={[0.045, 0.055, 0.45, 6]} />
			<T.MeshStandardMaterial color="#2b2b2b" roughness={0.38} metalness={0.42} />
		</T.Mesh>
		{#if shotPulse > 0}
			<T.Mesh position={[0, 0, -0.95 - recoil]} scale={[shotPulse, shotPulse, shotPulse]}>
				<T.ConeGeometry args={[0.12, 0.3, 6]} />
				<T.MeshBasicMaterial color="#ff88cc" transparent opacity={shotPulse} />
			</T.Mesh>
		{/if}
	</T.Group>
</T.Group>
