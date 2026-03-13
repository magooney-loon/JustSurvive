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
	import { T, useTask } from '@threlte/core';
	import { AdditiveBlending, Object3D, type Texture } from 'three';
	import PlayerRig from '$lib/character/PlayerRig.svelte';
	import { spotterFlash } from '$lib/stores/abilities.svelte.js';

	export type SpotterRigProps = {
		color: string;
		walkPhase: number;
		speed: number;
		shotPulse?: number;
		phase?: string;
		isBracing?: boolean;
		texture?: Texture | null;
	};

	let {
		color,
		walkPhase,
		speed,
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

	const spotlightBoost = $derived(phase === 'deep_night' ? 2.2 : phase === 'night' ? 1.6 : 1);
	const beamBoost = $derived(phase === 'deep_night' ? 1.9 : phase === 'night' ? 1.4 : 1);

	let spotTarget = $state<Object3D | undefined>(undefined);

	let flashT = $state(0);
	useTask((dt) => {
		if (spotterFlash.active && spotterFlash.until > Date.now()) {
			flashT = 1;
		} else {
			flashT = Math.max(0, flashT - dt * 4);
		}
	});
</script>

<PlayerRig
	classChoice="spotter"
	{color}
	{walkPhase}
	{speed}
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

	<T.Group position={[0.24, 1.1, armForwardZ - leanForward * 0.6]} rotation={[rightArmRotX, 0, 0]}>
		<T.Mesh position={[0, 0, -0.18]} rotation={[-Math.PI / 2, 0, 0]}>
			<T.ConeGeometry args={[0.12, 0.3, 8]} />
			<T.MeshStandardMaterial color="#bdbdbd" roughness={0.28} metalness={0.62} />
		</T.Mesh>
		<T.Mesh position={[0, 0, -0.325]}>
			<T.RingGeometry args={[0.09, 0.132, 14]} />
			<T.MeshStandardMaterial color="#606060" roughness={0.15} metalness={0.88} />
		</T.Mesh>
		<T.SpotLight
			position={[0, 0, -0.2]}
			color="#fff2c6"
			intensity={6.0 * spotlightBoost}
			distance={20}
			angle={0.22}
			penumbra={0.35}
			decay={1.8}
			castShadow={false}
			target={spotTarget}
		/>
		<T.Object3D bind:ref={spotTarget} position={[0, 0, -10]} />
		<T.Mesh position={[0, 0, -0.335]}>
			<T.SphereGeometry args={[0.048, 8, 6]} />
			<T.MeshStandardMaterial color="#ffeeaa" emissive="#ffeeaa" emissiveIntensity={3.2} />
		</T.Mesh>
		<T.Mesh position={[0, 0, -0.52]}>
			<T.SphereGeometry args={[0.3, 8, 6]} />
			<T.MeshBasicMaterial
				color="#fff8e0"
				transparent
				opacity={0.02 * beamBoost}
				side={2}
				depthWrite={false}
				blending={AdditiveBlending}
			/>
		</T.Mesh>
		<T.Mesh position={[0, 0, -0.34]}>
			<T.CircleGeometry args={[0.1, 12]} />
			<T.MeshBasicMaterial
				color="#fffcf4"
				transparent
				opacity={0.5}
				blending={AdditiveBlending}
				depthWrite={false}
			/>
		</T.Mesh>
		<T.Mesh position={[0, 0, -0.36]}>
			<T.CircleGeometry args={[0.28, 12]} />
			<T.MeshBasicMaterial
				color="#fff4cc"
				transparent
				opacity={0.12}
				blending={AdditiveBlending}
				depthWrite={false}
			/>
		</T.Mesh>
		<T.Mesh position={[0, 0, -0.39]}>
			<T.CircleGeometry args={[0.58, 12]} />
			<T.MeshBasicMaterial
				color="#ffe890"
				transparent
				opacity={0.025}
				blending={AdditiveBlending}
				depthWrite={false}
			/>
		</T.Mesh>
		<T.Mesh position={[0, 0, -5.5]} rotation={[Math.PI / 2, 0, 0]}>
			<T.ConeGeometry args={[1.3, 11.0, 32, 2, true]} />
			<T.MeshBasicMaterial
				color="#fff8e8"
				transparent
				opacity={0.006 * beamBoost}
				side={2}
				depthWrite={false}
				blending={AdditiveBlending}
			/>
		</T.Mesh>
		<T.Mesh position={[0, 0, -5.5]} rotation={[Math.PI / 2, 0, 0]}>
			<T.ConeGeometry args={[0.4, 11.0, 24, 2, true]} />
			<T.MeshBasicMaterial
				color="#fffefc"
				transparent
				opacity={0.014 * beamBoost}
				side={2}
				depthWrite={false}
				blending={AdditiveBlending}
			/>
		</T.Mesh>
	</T.Group>

	<!-- Spotter Flash Cone Effect -->
	{#if flashT > 0}
		<T.Mesh position={[0, 1.0, -5]} rotation={[Math.PI / 2 + 0.15, 0, 0]}>
			<T.ConeGeometry args={[4, 12, 16, 1, true]} />
			<T.MeshBasicMaterial
				color="#22ddff"
				transparent
				opacity={flashT * 0.5}
				side={2}
				depthWrite={false}
				blending={AdditiveBlending}
			/>
		</T.Mesh>
	{/if}
</T.Group>
