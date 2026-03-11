<script lang="ts">
	import { T } from '@threlte/core';
	import { AdditiveBlending } from 'three';
	export type StickRigProps = {
		classChoice: string;
		color: string;
		walkPhase: number;
		speed: number;
		shotPulse: number;
	};

	let { classChoice, color, walkPhase, speed, shotPulse }: StickRigProps = $props();

	const limbR = $derived(classChoice === 'tank' ? 0.085 : classChoice === 'gunner' ? 0.07 : 0.06);

	const moveIntensity = $derived(Math.min(speed / 6, 1));
	const swing = $derived(Math.sin(walkPhase) * 1.1 * moveIntensity);
	const bob = $derived(Math.abs(Math.sin(walkPhase)) * 0.07 * moveIntensity);
	const sway = $derived(Math.sin(walkPhase * 0.5) * 0.18 * moveIntensity);
	const hipShift = $derived(Math.sin(walkPhase) * 0.06 * moveIntensity);
	const torsoTwist = $derived(Math.sin(walkPhase) * 0.18 * moveIntensity);
	const headTilt = $derived(Math.sin(walkPhase * 0.5) * 0.12 * moveIntensity);
	const footRoll = $derived(Math.sin(walkPhase + Math.PI / 2) * 0.25 * moveIntensity);
	const isSprinting = $derived(speed > 6);
	const holdAim = $derived(classChoice === 'spotter' || classChoice === 'gunner');
	const armBop = $derived(isSprinting ? Math.sin(walkPhase) * 0.15 * moveIntensity : 0);
	const armPitch = $derived(holdAim ? armBop : 0);
	const armForwardZ = $derived(holdAim ? -0.35 : 0);
	const leanForward = $derived((isSprinting ? 0.18 : 0.08) * moveIntensity);
	const idleShift = $derived(Math.sin(walkPhase * 0.5) * 0.02 * (1 - moveIntensity));
	const boneTint = $derived(classChoice === 'spotter' ? '#d7ccb6' : '#d2c3a5');
	const plateTint = $derived(classChoice === 'gunner' ? '#2b2620' : '#2f271f');
	const lightFlicker = $derived(0.95 + 0.05 * Math.sin(walkPhase * 3.0 + 0.2));
	const lightPulse = $derived(0.96 + 0.04 * Math.sin(walkPhase * 1.4 - 0.2));
	const beamWarp = $derived(1 + 0.03 * Math.sin(walkPhase * 1.7 + 0.3));

	const leftArmRotX = $derived(holdAim ? armPitch : -swing);
	const rightArmRotX = $derived(holdAim ? -armPitch : swing);
</script>

<T.Group position={[hipShift, bob, 0]} rotation={[sway * 0.08, torsoTwist, sway * 0.12]}>
	<!-- Spine -->
	<T.Mesh position={[0, 0.93, -leanForward * 0.45]} rotation={[leanForward, 0, 0]}>
		<T.CylinderGeometry args={[0.14, 0.18, 0.65, 6]} />
		<T.MeshStandardMaterial {color} />
	</T.Mesh>
	<T.Mesh position={[0, 1.18, -leanForward * 0.55]} rotation={[leanForward * 0.9, 0, 0]}>
		<T.CylinderGeometry args={[0.1, 0.15, 0.55, 6]} />
		<T.MeshStandardMaterial {color} />
	</T.Mesh>
	<T.Mesh position={[0, 1.32, -leanForward * 0.6]} rotation={[leanForward * 0.9, 0, 0]}>
		<T.CylinderGeometry args={[0.08, 0.12, 0.4, 6]} />
		<T.MeshStandardMaterial {color} />
	</T.Mesh>
	<T.Mesh position={[0, 1.42, -leanForward * 0.65]} rotation={[leanForward * 0.8, 0, 0]}>
		<T.BoxGeometry args={[0.24, 0.12, 0.18]} />
		<T.MeshStandardMaterial {color} />
	</T.Mesh>
	<!-- Hips -->
	<T.Mesh position={[0, 0.75, 0]}>
		<T.SphereGeometry args={[0.12, 8, 6]} />
		<T.MeshStandardMaterial {color} />
	</T.Mesh>
	<!-- Pelvis block -->
	<T.Mesh position={[idleShift, 0.78, 0]}>
		<T.BoxGeometry args={[0.4, 0.22, 0.26]} />
		<T.MeshStandardMaterial {color} />
	</T.Mesh>
	<T.Mesh position={[-0.2, 0.78, 0.04]}>
		<T.BoxGeometry args={[0.14, 0.18, 0.2]} />
		<T.MeshStandardMaterial color={plateTint} />
	</T.Mesh>
	<T.Mesh position={[0.2, 0.78, 0.04]}>
		<T.BoxGeometry args={[0.14, 0.18, 0.2]} />
		<T.MeshStandardMaterial color={plateTint} />
	</T.Mesh>
	<T.Mesh position={[0, 0.68, 0.08]}>
		<T.CylinderGeometry args={[0.08, 0.12, 0.12, 6]} />
		<T.MeshStandardMaterial color={plateTint} />
	</T.Mesh>
	<!-- Shoulders -->
	<T.Mesh position={[0, 1.35, 0]}>
		<T.SphereGeometry args={[0.1, 8, 6]} />
		<T.MeshStandardMaterial {color} />
	</T.Mesh>
	<T.Mesh position={[-0.26, 1.34, -0.02]}>
		<T.BoxGeometry args={[0.18, 0.12, 0.2]} />
		<T.MeshStandardMaterial color={plateTint} />
	</T.Mesh>
	<T.Mesh position={[0.26, 1.34, -0.02]}>
		<T.BoxGeometry args={[0.18, 0.12, 0.2]} />
		<T.MeshStandardMaterial color={plateTint} />
	</T.Mesh>
	<T.Mesh position={[-0.34, 1.32, 0.02]} rotation={[0, 0, 0.3]}>
		<T.BoxGeometry args={[0.14, 0.08, 0.16]} />
		<T.MeshStandardMaterial color={plateTint} />
	</T.Mesh>
	<T.Mesh position={[0.34, 1.32, 0.02]} rotation={[0, 0, -0.3]}>
		<T.BoxGeometry args={[0.14, 0.08, 0.16]} />
		<T.MeshStandardMaterial color={plateTint} />
	</T.Mesh>
	<!-- Ribcage block -->
	<T.Mesh position={[0, 1.25, -leanForward * 0.4]}>
		<T.BoxGeometry args={[0.42, 0.36, 0.26]} />
		<T.MeshStandardMaterial {color} />
	</T.Mesh>
	<T.Mesh position={[-0.26, 1.25, -leanForward * 0.35]}>
		<T.BoxGeometry args={[0.16, 0.28, 0.22]} />
		<T.MeshStandardMaterial color={plateTint} />
	</T.Mesh>
	<T.Mesh position={[0.26, 1.25, -leanForward * 0.35]}>
		<T.BoxGeometry args={[0.16, 0.28, 0.22]} />
		<T.MeshStandardMaterial color={plateTint} />
	</T.Mesh>
	<T.Mesh position={[0, 1.15, -leanForward * 0.3]}>
		<T.CylinderGeometry args={[0.2, 0.22, 0.14, 6]} />
		<T.MeshStandardMaterial color={plateTint} />
	</T.Mesh>
	<!-- Head -->
	<T.Mesh position={[0, 1.65, -leanForward * 0.8]} rotation={[headTilt + leanForward * 0.4, 0, 0]}>
		<T.SphereGeometry args={[0.18, 8, 6]} />
		<T.MeshStandardMaterial color="#d9c5a7" />
	</T.Mesh>
	<T.Mesh position={[0, 1.63, -leanForward * 0.75]} rotation={[headTilt + leanForward * 0.4, 0, 0]}>
		<T.BoxGeometry args={[0.32, 0.26, 0.24]} />
		<T.MeshStandardMaterial color="#cdbb9c" />
	</T.Mesh>
	<T.Mesh position={[0, 1.56, -0.22]} rotation={[headTilt + leanForward * 0.4, 0, 0]}>
		<T.BoxGeometry args={[0.16, 0.08, 0.12]} />
		<T.MeshStandardMaterial color="#bfa98c" />
	</T.Mesh>
	<T.Mesh position={[0, 1.62, -leanForward * 0.75]} rotation={[headTilt + leanForward * 0.4, 0, 0]}>
		<T.CylinderGeometry args={[0.2, 0.24, 0.12, 6]} />
		<T.MeshStandardMaterial color={boneTint} />
	</T.Mesh>
	<T.Mesh position={[0, 1.71, -leanForward * 0.85]} rotation={[headTilt + leanForward * 0.4, 0, 0]}>
		<T.BoxGeometry args={[0.18, 0.06, 0.1]} />
		<T.MeshStandardMaterial color="#bfa98c" />
	</T.Mesh>

	<!-- Legs -->
	<T.Group position={[-0.14, 0.75, 0]} rotation={[swing, 0, 0]}>
		<T.Mesh position={[0, -0.2, 0]}>
			<T.CylinderGeometry args={[limbR * 1.15, limbR * 0.85, 0.42, 6]} />
			<T.MeshStandardMaterial color="#3a2f25" />
		</T.Mesh>
		<T.Mesh position={[0, -0.2, 0.05]}>
			<T.BoxGeometry args={[limbR * 2.2, limbR * 1.4, limbR * 2]} />
			<T.MeshStandardMaterial color={plateTint} />
		</T.Mesh>
		<T.Mesh position={[0, -0.28, 0.12]} rotation={[0.2, 0, 0]}>
			<T.BoxGeometry args={[limbR * 2.0, limbR * 0.7, limbR * 1.6]} />
			<T.MeshStandardMaterial color={plateTint} />
		</T.Mesh>
		<T.Mesh position={[0, -0.4, 0]}>
			<T.SphereGeometry args={[limbR * 0.95, 6, 4]} />
			<T.MeshStandardMaterial color="#3a2f25" />
		</T.Mesh>
		<T.Mesh position={[0, -0.65, 0]}>
			<T.CylinderGeometry args={[limbR * 0.95, limbR * 0.75, 0.5, 6]} />
			<T.MeshStandardMaterial color="#3a2f25" />
		</T.Mesh>
		<T.Mesh position={[0, -0.65, 0.04]}>
			<T.BoxGeometry args={[limbR * 2.0, limbR * 1.3, limbR * 1.8]} />
			<T.MeshStandardMaterial color={plateTint} />
		</T.Mesh>
		<T.Mesh position={[0, -0.75, 0.1]} rotation={[0.25, 0, 0]}>
			<T.BoxGeometry args={[limbR * 1.8, limbR * 0.6, limbR * 1.4]} />
			<T.MeshStandardMaterial color={plateTint} />
		</T.Mesh>
		<T.Mesh position={[0, -0.95, -0.1]} rotation={[footRoll, 0, 0]}>
			<T.BoxGeometry args={[limbR * 3.3, limbR * 1.3, limbR * 4.4]} />
			<T.MeshStandardMaterial color="#222" />
		</T.Mesh>
		<T.Mesh position={[0, -0.98, 0.08]} rotation={[footRoll * 0.6, 0, 0]}>
			<T.BoxGeometry args={[limbR * 2.6, limbR * 1.1, limbR * 2.2]} />
			<T.MeshStandardMaterial color="#1a1a1a" />
		</T.Mesh>
		<T.Mesh position={[0, -1.02, -0.26]} rotation={[footRoll * 0.9, 0, 0]}>
			<T.BoxGeometry args={[limbR * 2.0, limbR * 0.8, limbR * 1.2]} />
			<T.MeshStandardMaterial color="#111" />
		</T.Mesh>
	</T.Group>
	<T.Group position={[0.14, 0.75, 0]} rotation={[-swing, 0, 0]}>
		<T.Mesh position={[0, -0.2, 0]}>
			<T.CylinderGeometry args={[limbR * 1.15, limbR * 0.85, 0.42, 6]} />
			<T.MeshStandardMaterial color="#3a2f25" />
		</T.Mesh>
		<T.Mesh position={[0, -0.2, 0.05]}>
			<T.BoxGeometry args={[limbR * 2.2, limbR * 1.4, limbR * 2]} />
			<T.MeshStandardMaterial color={plateTint} />
		</T.Mesh>
		<T.Mesh position={[0, -0.28, 0.12]} rotation={[0.2, 0, 0]}>
			<T.BoxGeometry args={[limbR * 2.0, limbR * 0.7, limbR * 1.6]} />
			<T.MeshStandardMaterial color={plateTint} />
		</T.Mesh>
		<T.Mesh position={[0, -0.4, 0]}>
			<T.SphereGeometry args={[limbR * 0.95, 6, 4]} />
			<T.MeshStandardMaterial color="#3a2f25" />
		</T.Mesh>
		<T.Mesh position={[0, -0.65, 0]}>
			<T.CylinderGeometry args={[limbR * 0.95, limbR * 0.75, 0.5, 6]} />
			<T.MeshStandardMaterial color="#3a2f25" />
		</T.Mesh>
		<T.Mesh position={[0, -0.65, 0.04]}>
			<T.BoxGeometry args={[limbR * 2.0, limbR * 1.3, limbR * 1.8]} />
			<T.MeshStandardMaterial color={plateTint} />
		</T.Mesh>
		<T.Mesh position={[0, -0.75, 0.1]} rotation={[0.25, 0, 0]}>
			<T.BoxGeometry args={[limbR * 1.8, limbR * 0.6, limbR * 1.4]} />
			<T.MeshStandardMaterial color={plateTint} />
		</T.Mesh>
		<T.Mesh position={[0, -0.95, -0.1]} rotation={[-footRoll, 0, 0]}>
			<T.BoxGeometry args={[limbR * 3.3, limbR * 1.3, limbR * 4.4]} />
			<T.MeshStandardMaterial color="#222" />
		</T.Mesh>
		<T.Mesh position={[0, -0.98, 0.08]} rotation={[-footRoll * 0.6, 0, 0]}>
			<T.BoxGeometry args={[limbR * 2.6, limbR * 1.1, limbR * 2.2]} />
			<T.MeshStandardMaterial color="#1a1a1a" />
		</T.Mesh>
		<T.Mesh position={[0, -1.02, -0.26]} rotation={[-footRoll * 0.9, 0, 0]}>
			<T.BoxGeometry args={[limbR * 2.0, limbR * 0.8, limbR * 1.2]} />
			<T.MeshStandardMaterial color="#111" />
		</T.Mesh>
	</T.Group>

	<!-- Hands (floating) -->
	<T.Group position={[-0.24, 1.1, armForwardZ - leanForward * 0.6]} rotation={[leftArmRotX, 0, 0]}>
		<T.Mesh position={[0, 0, -0.35]}>
			<T.BoxGeometry args={[limbR * 2.2, limbR * 1.4, limbR * 2.6]} />
			<T.MeshStandardMaterial color="#d9c5a7" />
		</T.Mesh>
		<T.Mesh position={[0, 0.02, -0.44]}>
			<T.SphereGeometry args={[limbR * 0.7, 6, 4]} />
			<T.MeshStandardMaterial color="#c9b499" />
		</T.Mesh>
		<T.Mesh position={[0, -0.04, -0.22]}>
			<T.BoxGeometry args={[limbR * 2.0, limbR * 0.5, limbR * 1.2]} />
			<T.MeshStandardMaterial color={plateTint} />
		</T.Mesh>
		{#if classChoice === 'spotter'}
			<T.Group position={[0.02, 0.02, -0.55]} rotation={[0.1, 0.2, 0]}>
				<T.Mesh>
					<T.BoxGeometry args={[0.18, 0.1, 0.22]} />
					<T.MeshStandardMaterial color="#2b2b2b" />
				</T.Mesh>
				<T.Mesh position={[0, 0.03, 0.02]}>
					<T.BoxGeometry args={[0.14, 0.02, 0.12]} />
					<T.MeshStandardMaterial color="#1f6f9a" emissive="#1f6f9a" emissiveIntensity={1.8} />
				</T.Mesh>
				<T.Mesh position={[0.06, -0.02, -0.02]}>
					<T.CylinderGeometry args={[0.02, 0.02, 0.08, 6]} />
					<T.MeshStandardMaterial color="#4a4a4a" />
				</T.Mesh>
			</T.Group>
		{/if}
		{#if classChoice === 'gunner'}
			{@const recoil = shotPulse * 0.18}
			<T.Mesh position={[0, 0, -0.6 - recoil]} rotation={[Math.PI / 2, 0, 0]}>
				<T.CylinderGeometry args={[0.05, 0.06, 0.4, 6]} />
				<T.MeshStandardMaterial color="#2b2b2b" />
			</T.Mesh>
			{#if shotPulse > 0}
				<T.Mesh position={[0, 0, -0.95 - recoil]} scale={[shotPulse, shotPulse, shotPulse]}>
					<T.ConeGeometry args={[0.12, 0.3, 6]} />
					<T.MeshBasicMaterial color="#ffcc55" transparent opacity={shotPulse} />
				</T.Mesh>
			{/if}
		{/if}
	</T.Group>
	<T.Group position={[0.24, 1.1, armForwardZ - leanForward * 0.6]} rotation={[rightArmRotX, 0, 0]}>
		<T.Mesh position={[0, 0, -0.35]}>
			<T.BoxGeometry args={[limbR * 2.2, limbR * 1.4, limbR * 2.6]} />
			<T.MeshStandardMaterial color="#d9c5a7" />
		</T.Mesh>
		<T.Mesh position={[0, 0.02, -0.44]}>
			<T.SphereGeometry args={[limbR * 0.7, 6, 4]} />
			<T.MeshStandardMaterial color="#c9b499" />
		</T.Mesh>
		<T.Mesh position={[0, -0.04, -0.22]}>
			<T.BoxGeometry args={[limbR * 2.0, limbR * 0.5, limbR * 1.2]} />
			<T.MeshStandardMaterial color={plateTint} />
		</T.Mesh>
		{#if classChoice === 'spotter'}
			<T.Mesh position={[0, 0, -0.18]} rotation={[-Math.PI / 2, 0, 0]}>
				<T.ConeGeometry args={[0.12, 0.3, 8]} />
				<T.MeshStandardMaterial color="#bdbdbd" />
			</T.Mesh>
			<T.SpotLight
				position={[0, 0, -0.2]}
				color="#fff2c6"
				intensity={5.2 * lightPulse}
				distance={18}
				angle={0.2}
				penumbra={0.2}
				decay={2}
				castShadow={false}
			/>
			<T.Mesh position={[0, 0, -0.34]}>
				<T.SphereGeometry args={[0.05, 6, 4]} />
				<T.MeshStandardMaterial
					color="#ffe7a1"
					emissive="#ffe7a1"
					emissiveIntensity={2.4 * lightFlicker}
				/>
			</T.Mesh>
			<T.Mesh
				position={[0, 0, -6]}
				rotation={[Math.PI / 2, 0.18, 0]}
				scale={[beamWarp, 1, 1 / beamWarp]}
			>
				<T.MeshBasicMaterial
					color="#fff6da"
					transparent
					opacity={0.009 * lightPulse}
					side={2}
					depthWrite={false}
					blending={AdditiveBlending}
				/>
				<T.ConeGeometry args={[1.6, 12.5, 64, 4, true]} />
			</T.Mesh>
			<T.Mesh
				position={[0, 0, -5.6]}
				rotation={[Math.PI / 2, -0.12, 0.05]}
				scale={[1 / beamWarp, 1, beamWarp]}
			>
				<T.MeshBasicMaterial
					color="#fff9ef"
					transparent
					opacity={0.012 * lightPulse}
					side={2}
					depthWrite={false}
					blending={AdditiveBlending}
				/>
				<T.ConeGeometry args={[0.7, 9.2, 64, 4, true]} />
			</T.Mesh>
			<T.Mesh position={[0, 0, -6.8]} rotation={[Math.PI / 2, 0.05, -0.04]} scale={[1.06, 1, 0.96]}>
				<T.MeshBasicMaterial
					color="#fff1c8"
					transparent
					opacity={0.006 * lightPulse}
					side={2}
					depthWrite={false}
					blending={AdditiveBlending}
				/>
				<T.ConeGeometry args={[2.0, 13.5, 64, 4, true]} />
			</T.Mesh>
			<T.Mesh position={[0, 0, -6]} rotation={[Math.PI / 2, 0, 0]}>
				<T.ConeGeometry args={[0.9, 9, 32, 2, true]} />
				<T.MeshBasicMaterial color="#fff8cc" transparent opacity={0.12 * lightPulse} side={2} />
			</T.Mesh>
			<T.Mesh position={[0, 0, -15]} rotation={[-Math.PI / 2, 0, 0]}>
				<T.CircleGeometry args={[0.28, 12]} />
				<T.MeshBasicMaterial color="#fff6c8" transparent opacity={0.7 * lightPulse} />
			</T.Mesh>
			<T.Mesh position={[0, 0, -0.52]}>
				<T.CircleGeometry args={[0.16, 12]} />
				<T.MeshBasicMaterial color="#fff7d6" transparent opacity={0.5 * lightFlicker} />
			</T.Mesh>
			<T.Mesh position={[0, 0, -0.58]}>
				<T.CircleGeometry args={[0.28, 12]} />
				<T.MeshBasicMaterial color="#fff0b8" transparent opacity={0.18 * lightFlicker} />
			</T.Mesh>
		{:else if classChoice === 'gunner'}
			{@const recoil = shotPulse * 0.18}
			<T.Mesh position={[0, 0, -0.6 - recoil]} rotation={[Math.PI / 2, 0, 0]}>
				<T.CylinderGeometry args={[0.05, 0.06, 0.4, 6]} />
				<T.MeshStandardMaterial color="#2b2b2b" />
			</T.Mesh>
			{#if shotPulse > 0}
				<T.Mesh position={[0, 0, -0.95 - recoil]} scale={[shotPulse, shotPulse, shotPulse]}>
					<T.ConeGeometry args={[0.12, 0.3, 6]} />
					<T.MeshBasicMaterial color="#ffcc55" transparent opacity={shotPulse} />
				</T.Mesh>
			{/if}
		{:else if classChoice === 'healer'}
			{@const recoil = shotPulse * 0.12}
			<T.Mesh position={[0, 0, -0.6 - recoil]} rotation={[Math.PI / 2, 0, 0]}>
				<T.CylinderGeometry args={[0.05, 0.06, 0.45, 6]} />
				<T.MeshStandardMaterial color="#2b2b2b" />
			</T.Mesh>
			{#if shotPulse > 0}
				<T.Mesh position={[0, 0, -0.95 - recoil]} scale={[shotPulse, shotPulse, shotPulse]}>
					<T.ConeGeometry args={[0.12, 0.3, 6]} />
					<T.MeshBasicMaterial color="#ffcc55" transparent opacity={shotPulse} />
				</T.Mesh>
			{/if}
		{/if}
	</T.Group>

	<!-- Facing nub -->
	<T.Mesh position={[0, 0.1, -0.35]}>
		<T.SphereGeometry args={[0.08, 6, 4]} />
		<T.MeshBasicMaterial {color} />
	</T.Mesh>
</T.Group>
