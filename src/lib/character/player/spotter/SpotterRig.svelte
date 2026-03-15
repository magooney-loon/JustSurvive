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
	import { type Texture } from 'three';
	import PlayerRig from '$lib/character/PlayerRig.svelte';

	export type SpotterRigProps = {
		color: string;
		walkPhase: number;
		speed: number;
		facing: number;
		velX: number;
		velZ: number;
		shotPulse?: number;
		phase?: string;
		isBracing?: boolean;
		texture?: Texture | null;
	};

	let {
		color,
		walkPhase,
		speed,
		facing,
		velX,
		velZ,
		shotPulse = 0,
		phase = 'sunset',
		isBracing = false,
		texture = null
	}: SpotterRigProps = $props();

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
	const leftArmRotX = $derived(-swing * 0.8);
	const rightArmRotX = $derived(swing * 0.8);


</script>

<PlayerRig
	classChoice="spotter"
	{color}
	{walkPhase}
	{speed}
	{facing}
	{velX}
	{velZ}
	{shotPulse}
	{phase}
	{isBracing}
	{texture}
/>

<T.Group position={[hipShift, bob, 0]} rotation={[sway * 0.08, torsoTwist, sway * 0.12]}>
	<T.Group position={[-0.24, 1.1, armForwardZ - leanForward * 0.6]} rotation={[leftArmRotX, 0, 0]}>
		<T.Group position={[0.02, 0.02, -0.56]} rotation={[0.1, 0.2, 0]}>
			<T.Mesh>
				<T.BoxGeometry args={[0.18, 0.1, 0.22]} />
				<T.MeshStandardMaterial color="#2b2b2b" roughness={0.4} metalness={0.3} />
			</T.Mesh>
			<T.Mesh position={[0, 0.03, 0.02]}>
				<T.BoxGeometry args={[0.14, 0.02, 0.12]} />
				<T.MeshStandardMaterial color="#1f6f9a" emissive="#1f6f9a" emissiveIntensity={1.8} />
			</T.Mesh>
			<T.Mesh position={[0.06, -0.02, -0.02]}>
				<T.CylinderGeometry args={[0.02, 0.02, 0.08, 6]} />
				<T.MeshStandardMaterial color="#4a4a4a" roughness={0.45} metalness={0.4} />
			</T.Mesh>
		</T.Group>
	</T.Group>

	<!-- Sniper rifle on right arm -->
	<T.Group position={[0.24, 1.1, armForwardZ - leanForward * 0.6]} rotation={[rightArmRotX, 0, 0]}>
		<!-- Stock -->
		<T.Mesh position={[0, 0, 0.05]}>
			<T.BoxGeometry args={[0.06, 0.08, 0.16]} />
			<T.MeshStandardMaterial color="#2a1a0a" roughness={0.7} metalness={0.1} />
		</T.Mesh>
		<!-- Receiver / body -->
		<T.Mesh position={[0, 0.01, -0.12]}>
			<T.BoxGeometry args={[0.055, 0.075, 0.22]} />
			<T.MeshStandardMaterial color="#1e1e1e" roughness={0.35} metalness={0.55} />
		</T.Mesh>
		<!-- Barrel — long and thin -->
		<T.Mesh position={[0, 0.015, -0.54]} rotation={[Math.PI / 2, 0, 0]}>
			<T.CylinderGeometry args={[0.012, 0.012, 0.62, 8]} />
			<T.MeshStandardMaterial color="#3a3a3a" roughness={0.2} metalness={0.85} />
		</T.Mesh>
		<!-- Muzzle tip -->
		<T.Mesh position={[0, 0.015, -0.86]} rotation={[Math.PI / 2, 0, 0]}>
			<T.CylinderGeometry args={[0.018, 0.012, 0.06, 8]} />
			<T.MeshStandardMaterial color="#555" roughness={0.2} metalness={0.9} />
		</T.Mesh>
		<!-- Scope body -->
		<T.Mesh position={[0, 0.065, -0.14]} rotation={[Math.PI / 2, 0, 0]}>
			<T.CylinderGeometry args={[0.022, 0.022, 0.24, 10]} />
			<T.MeshStandardMaterial color="#111" roughness={0.3} metalness={0.7} />
		</T.Mesh>
		<!-- Scope lens (blue tint) -->
		<T.Mesh position={[0, 0.065, -0.255]}>
			<T.CircleGeometry args={[0.018, 10]} />
			<T.MeshStandardMaterial color="#2255aa" emissive="#112244" emissiveIntensity={0.6} roughness={0.1} metalness={0.5} />
		</T.Mesh>
	</T.Group>
</T.Group>
