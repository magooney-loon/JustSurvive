<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { AdditiveBlending, Object3D } from 'three';
	export type StickRigProps = {
		classChoice: string;
		color: string;
		walkPhase: number;
		speed: number;
		shotPulse: number;
		phase?: string;
		isEnemy?: boolean;
		isBracing?: boolean;
	};

	let {
		classChoice,
		color,
		walkPhase,
		speed,
		shotPulse,
		phase = 'sunset',
		isEnemy = false,
		isBracing = false
	}: StickRigProps = $props();

	const limbR = $derived(classChoice === 'tank' ? 0.09 : classChoice === 'gunner' ? 0.075 : 0.065);

	const moveIntensity = $derived(Math.min(speed / 6, 1));
	// sin computed once per frame, reused across all animation values
	const sinWalk = $derived(Math.sin(walkPhase));
	const sinHalf = $derived(Math.sin(walkPhase * 0.5));
	const swing = $derived(sinWalk * 1.1 * moveIntensity);
	const bob = $derived(Math.abs(sinWalk) * 0.07 * moveIntensity);
	const sway = $derived(sinHalf * 0.18 * moveIntensity);
	const hipShift = $derived(sinWalk * 0.06 * moveIntensity);
	const torsoTwist = $derived(sinWalk * 0.18 * moveIntensity);
	const headTilt = $derived(sinHalf * 0.12 * moveIntensity);
	const footRoll = $derived(Math.cos(walkPhase) * 0.3 * moveIntensity);
	const isSprinting = $derived(speed > 6);
	const holdAim = $derived(!isEnemy && (classChoice === 'spotter' || classChoice === 'gunner'));
	const armBop = $derived(isSprinting ? sinWalk * 0.2 * moveIntensity : 0);
	const armPitch = $derived(holdAim ? armBop : 0);
	const armForwardZ = $derived(holdAim ? -0.35 : 0);
	const leanForward = $derived((isSprinting ? 0.22 : 0.08) * moveIntensity);
	const boneTint = $derived(classChoice === 'spotter' ? '#d7ccb6' : '#d2c3a5');
	const plateTint = $derived(classChoice === 'gunner' ? '#2b2620' : '#2f271f');
	const spotlightBoost = $derived(phase === 'deep_night' ? 2.2 : phase === 'night' ? 1.6 : 1);
	const beamBoost = $derived(phase === 'deep_night' ? 1.9 : phase === 'night' ? 1.4 : 1);
	const enemyGlow = $derived(isEnemy ? 0.18 : 1);
	let spotTarget = $state<Object3D | undefined>(undefined);

	const leftArmRotX = $derived(holdAim ? armPitch : -swing * 0.8);
	const rightArmRotX = $derived(holdAim ? -armPitch : swing * 0.8);

	// Knee bends: leg bends at knee when it swings forward, small passive bend at rest
	const kneeBendL = $derived(0.07 + Math.max(0, sinWalk) * 0.95 * moveIntensity);
	const kneeBendR = $derived(0.07 + Math.max(0, -sinWalk) * 0.95 * moveIntensity);

	// Tank shield: smooth lerp toward brace state
	let braceT = $state(0);
	useTask((dt) => {
		const target = isBracing ? 1 : 0;
		braceT += (target - braceT) * (1 - Math.pow(0.004, dt));
	});
	const shieldGlow = $derived(braceT * 0.85);
	const shieldGlowVis = $derived(shieldGlow * enemyGlow);
	const shieldPosX = $derived(-0.22 * (1 - braceT));
	const shieldPosY = $derived(0.88 + 0.12 * braceT);
	const shieldPosZ = $derived(-0.42 - 0.18 * braceT);
	const shieldS = $derived(0.58 + 0.42 * braceT);

	// Class visor/goggle color — constant glow (no per-frame oscillation)
	const visorColor = $derived(
		classChoice === 'spotter'
			? '#22d4ff'
			: classChoice === 'gunner'
				? '#ff8822'
				: classChoice === 'tank'
					? '#66ff44'
					: '#ff88cc'
	);
	const visorGlow = $derived(0.75 * enemyGlow);
	const emblemGlow = $derived(0.55 * enemyGlow);
</script>

<T.Group position={[hipShift, bob, 0]} rotation={[sway * 0.08, torsoTwist, sway * 0.12]}>
	<!-- SPINE -->
	<T.Mesh position={[0, 0.93, -leanForward * 0.45]} rotation={[leanForward, 0, 0]}>
		<T.CylinderGeometry args={[0.14, 0.18, 0.65, 6]} />
		<T.MeshStandardMaterial {color} roughness={0.88} />
	</T.Mesh>
	<T.Mesh position={[0, 1.18, -leanForward * 0.55]} rotation={[leanForward * 0.9, 0, 0]}>
		<T.CylinderGeometry args={[0.1, 0.15, 0.55, 6]} />
		<T.MeshStandardMaterial {color} roughness={0.88} />
	</T.Mesh>
	<T.Mesh position={[0, 1.32, -leanForward * 0.6]} rotation={[leanForward * 0.9, 0, 0]}>
		<T.CylinderGeometry args={[0.08, 0.12, 0.4, 6]} />
		<T.MeshStandardMaterial {color} roughness={0.88} />
	</T.Mesh>
	<!-- Neck -->
	<T.Mesh position={[0, 1.44, -leanForward * 0.65]} rotation={[leanForward * 0.8, 0, 0]}>
		<T.CylinderGeometry args={[0.075, 0.11, 0.2, 8]} />
		<T.MeshStandardMaterial color="#d0bb9a" roughness={0.85} />
	</T.Mesh>

	<!-- HIPS & PELVIS -->
	<T.Mesh position={[0, 0.75, 0]}>
		<T.SphereGeometry args={[0.12, 8, 6]} />
		<T.MeshStandardMaterial {color} roughness={0.88} />
	</T.Mesh>
	<T.Mesh position={[0, 0.78, 0]}>
		<T.CapsuleGeometry args={[0.16, 0.22, 6, 10]} />
		<T.MeshStandardMaterial {color} roughness={0.88} />
	</T.Mesh>
	<T.Mesh position={[-0.2, 0.78, 0.04]} rotation={[0, 0, Math.PI / 2]}>
		<T.CapsuleGeometry args={[0.065, 0.19, 4, 8]} />
		<T.MeshStandardMaterial color={plateTint} roughness={0.38} metalness={0.3} />
	</T.Mesh>
	<T.Mesh position={[0.2, 0.78, 0.04]} rotation={[0, 0, Math.PI / 2]}>
		<T.CapsuleGeometry args={[0.065, 0.19, 4, 8]} />
		<T.MeshStandardMaterial color={plateTint} roughness={0.38} metalness={0.3} />
	</T.Mesh>
	<T.Mesh position={[0, 0.68, 0.08]}>
		<T.CylinderGeometry args={[0.08, 0.12, 0.12, 6]} />
		<T.MeshStandardMaterial color={plateTint} roughness={0.38} metalness={0.3} />
	</T.Mesh>

	<!-- SHOULDERS -->
	<T.Mesh position={[0, 1.35, 0]}>
		<T.SphereGeometry args={[0.1, 8, 6]} />
		<T.MeshStandardMaterial {color} roughness={0.88} />
	</T.Mesh>
	<T.Mesh position={[-0.28, 1.34, -0.02]}>
		<T.CapsuleGeometry args={[0.068, 0.22, 4, 8]} />
		<T.MeshStandardMaterial color={plateTint} roughness={0.35} metalness={0.35} />
	</T.Mesh>
	<T.Mesh position={[0.28, 1.34, -0.02]}>
		<T.CapsuleGeometry args={[0.068, 0.22, 4, 8]} />
		<T.MeshStandardMaterial color={plateTint} roughness={0.35} metalness={0.35} />
	</T.Mesh>
	<T.Mesh position={[-0.36, 1.32, 0.02]} rotation={[0, 0, 0.3]}>
		<T.BoxGeometry args={[0.15, 0.09, 0.17]} />
		<T.MeshStandardMaterial color={plateTint} roughness={0.35} metalness={0.35} />
	</T.Mesh>
	<T.Mesh position={[0.36, 1.32, 0.02]} rotation={[0, 0, -0.3]}>
		<T.BoxGeometry args={[0.15, 0.09, 0.17]} />
		<T.MeshStandardMaterial color={plateTint} roughness={0.35} metalness={0.35} />
	</T.Mesh>

	<!-- RIBCAGE / CHEST (breathes) -->
	<T.Mesh position={[0, 1.25, -leanForward * 0.4]}>
		<T.CapsuleGeometry args={[0.18, 0.3, 6, 10]} />
		<T.MeshStandardMaterial {color} roughness={0.88} />
	</T.Mesh>
	<T.Mesh position={[-0.27, 1.25, -leanForward * 0.35]}>
		<T.CapsuleGeometry args={[0.062, 0.25, 4, 8]} />
		<T.MeshStandardMaterial color={plateTint} roughness={0.35} metalness={0.35} />
	</T.Mesh>
	<T.Mesh position={[0.27, 1.25, -leanForward * 0.35]}>
		<T.CapsuleGeometry args={[0.062, 0.25, 4, 8]} />
		<T.MeshStandardMaterial color={plateTint} roughness={0.35} metalness={0.35} />
	</T.Mesh>
	<!-- Sternum plate -->
	<T.Mesh position={[0, 1.16, -leanForward * 0.3]}>
		<T.CylinderGeometry args={[0.2, 0.22, 0.15, 6]} />
		<T.MeshStandardMaterial color={plateTint} roughness={0.35} metalness={0.35} />
	</T.Mesh>
	<!-- Class emblem glow on chest -->
	<T.Mesh position={[0, 1.27, -leanForward * 0.38 - 0.17]} rotation={[0, Math.PI, 0]}>
		<T.CircleGeometry args={[0.052, 8]} />
		<T.MeshBasicMaterial color={visorColor} transparent opacity={emblemGlow} />
	</T.Mesh>

	<!-- HEAD GROUP — all parts share one rotation so we only compute it once -->
	<T.Group
		position={[0, 1.63, -leanForward * 0.75]}
		rotation={[headTilt + leanForward * 0.4, 0, 0]}
	>
		<!-- Skull base -->
		<T.Mesh position={[0, 0.02, 0]}>
			<T.SphereGeometry args={[0.185, 10, 7]} />
			<T.MeshStandardMaterial color="#d9c5a7" roughness={0.85} />
		</T.Mesh>
		<!-- Face box -->
		<T.Mesh>
			<T.BoxGeometry args={[0.32, 0.26, 0.24]} />
			<T.MeshStandardMaterial color="#cdbb9c" roughness={0.85} />
		</T.Mesh>
		<!-- Helmet ring -->
		<T.Mesh position={[0, -0.01, 0]}>
			<T.CylinderGeometry args={[0.205, 0.248, 0.13, 8]} />
			<T.MeshStandardMaterial color={boneTint} roughness={0.5} metalness={0.18} />
		</T.Mesh>
		<!-- Brow ridge -->
		<T.Mesh position={[0, 0.075, -0.17]}>
			<T.BoxGeometry args={[0.28, 0.055, 0.065]} />
			<T.MeshStandardMaterial color="#bfa98c" roughness={0.75} />
		</T.Mesh>
		<!-- Visor band (dark lens strip) -->
		<T.Mesh position={[0, 0.028, -0.163]}>
			<T.BoxGeometry args={[0.305, 0.092, 0.052]} />
			<T.MeshStandardMaterial color="#0d0d0d" roughness={0.22} metalness={0.55} />
		</T.Mesh>
		<!-- Left eye glow -->
		<T.Mesh position={[-0.072, 0.028, -0.192]} rotation={[0, Math.PI, 0]}>
			<T.CircleGeometry args={[0.033, 8]} />
			<T.MeshBasicMaterial color={visorColor} transparent opacity={visorGlow} />
		</T.Mesh>
		<!-- Right eye glow -->
		<T.Mesh position={[0.072, 0.028, -0.192]} rotation={[0, Math.PI, 0]}>
			<T.CircleGeometry args={[0.033, 8]} />
			<T.MeshBasicMaterial color={visorColor} transparent opacity={visorGlow} />
		</T.Mesh>
		<!-- Chin strap / jaw -->
		<T.Mesh position={[0, -0.09, -0.17]}>
			<T.CapsuleGeometry args={[0.036, 0.1, 4, 8]} />
			<T.MeshStandardMaterial color="#bfa98c" roughness={0.8} />
		</T.Mesh>
		<!-- Top crest -->
		<T.Mesh position={[0, 0.17, -0.06]}>
			<T.BoxGeometry args={[0.18, 0.065, 0.1]} />
			<T.MeshStandardMaterial color="#bfa98c" roughness={0.65} />
		</T.Mesh>
	</T.Group>

	<!-- LEFT LEG — thigh + knee pivot + shin + ankle + boot -->
	<T.Group position={[-0.14, 0.75, 0]} rotation={[swing, 0, 0]}>
		<!-- Thigh -->
		<T.Mesh position={[0, -0.21, 0]}>
			<T.CylinderGeometry args={[limbR * 1.1, limbR * 0.9, 0.42, 6]} />
			<T.MeshStandardMaterial color="#3a2f25" roughness={0.9} />
		</T.Mesh>
		<!-- Thigh armor -->
		<T.Mesh position={[0, -0.17, 0.075]}>
			<T.BoxGeometry args={[limbR * 2.1, limbR * 2.5, limbR * 1.15]} />
			<T.MeshStandardMaterial color={plateTint} roughness={0.4} metalness={0.25} />
		</T.Mesh>
		<!-- Knee sphere -->
		<T.Mesh position={[0, -0.42, 0]}>
			<T.SphereGeometry args={[limbR * 1.05, 7, 5]} />
			<T.MeshStandardMaterial color="#2a1d12" roughness={0.65} metalness={0.12} />
		</T.Mesh>
		<!-- Knee cap plate -->
		<T.Mesh position={[0, -0.42, 0.09]}>
			<T.BoxGeometry args={[limbR * 1.9, limbR * 1.1, limbR * 0.9]} />
			<T.MeshStandardMaterial color={plateTint} roughness={0.35} metalness={0.35} />
		</T.Mesh>
		<!-- Lower leg — pivots at knee -->
		<T.Group position={[0, -0.42, 0]} rotation={[-kneeBendL, 0, 0]}>
			<T.Mesh position={[0, -0.26, 0]}>
				<T.CylinderGeometry args={[limbR * 0.88, limbR * 0.72, 0.52, 6]} />
				<T.MeshStandardMaterial color="#3a2f25" roughness={0.9} />
			</T.Mesh>
			<!-- Shin plate -->
			<T.Mesh position={[0, -0.24, 0.075]}>
				<T.CapsuleGeometry args={[limbR * 0.42, limbR * 2.1, 4, 8]} />
				<T.MeshStandardMaterial color={plateTint} roughness={0.4} metalness={0.25} />
			</T.Mesh>
			<!-- Ankle sphere -->
			<T.Mesh position={[0, -0.54, 0]}>
				<T.SphereGeometry args={[limbR * 0.78, 6, 4]} />
				<T.MeshStandardMaterial color="#221710" roughness={0.75} />
			</T.Mesh>
			<!-- Ankle pivot + boot -->
			<T.Group position={[0, -0.54, 0]} rotation={[footRoll, 0, 0]}>
				<T.Mesh position={[0, -0.065, -0.03]}>
					<T.BoxGeometry args={[limbR * 2.25, limbR * 1.05, limbR * 3.5]} />
					<T.MeshStandardMaterial color="#141414" roughness={0.82} />
				</T.Mesh>
				<T.Mesh position={[0, -0.1, 0.09]}>
					<T.CapsuleGeometry args={[limbR * 0.52, limbR * 1.9, 4, 8]} />
					<T.MeshStandardMaterial color="#1c1c1c" roughness={0.82} />
				</T.Mesh>
				<!-- Sole -->
				<T.Mesh position={[0, -0.122, -0.025]}>
					<T.BoxGeometry args={[limbR * 2.15, limbR * 0.32, limbR * 3.1]} />
					<T.MeshStandardMaterial color="#090909" roughness={0.95} />
				</T.Mesh>
			</T.Group>
		</T.Group>
	</T.Group>

	<!-- RIGHT LEG — mirror of left -->
	<T.Group position={[0.14, 0.75, 0]} rotation={[-swing, 0, 0]}>
		<T.Mesh position={[0, -0.21, 0]}>
			<T.CylinderGeometry args={[limbR * 1.1, limbR * 0.9, 0.42, 6]} />
			<T.MeshStandardMaterial color="#3a2f25" roughness={0.9} />
		</T.Mesh>
		<T.Mesh position={[0, -0.17, 0.075]}>
			<T.BoxGeometry args={[limbR * 2.1, limbR * 2.5, limbR * 1.15]} />
			<T.MeshStandardMaterial color={plateTint} roughness={0.4} metalness={0.25} />
		</T.Mesh>
		<T.Mesh position={[0, -0.42, 0]}>
			<T.SphereGeometry args={[limbR * 1.05, 7, 5]} />
			<T.MeshStandardMaterial color="#2a1d12" roughness={0.65} metalness={0.12} />
		</T.Mesh>
		<T.Mesh position={[0, -0.42, 0.09]}>
			<T.BoxGeometry args={[limbR * 1.9, limbR * 1.1, limbR * 0.9]} />
			<T.MeshStandardMaterial color={plateTint} roughness={0.35} metalness={0.35} />
		</T.Mesh>
		<T.Group position={[0, -0.42, 0]} rotation={[-kneeBendR, 0, 0]}>
			<T.Mesh position={[0, -0.26, 0]}>
				<T.CylinderGeometry args={[limbR * 0.88, limbR * 0.72, 0.52, 6]} />
				<T.MeshStandardMaterial color="#3a2f25" roughness={0.9} />
			</T.Mesh>
			<T.Mesh position={[0, -0.24, 0.075]}>
				<T.CapsuleGeometry args={[limbR * 0.42, limbR * 2.1, 4, 8]} />
				<T.MeshStandardMaterial color={plateTint} roughness={0.4} metalness={0.25} />
			</T.Mesh>
			<T.Mesh position={[0, -0.54, 0]}>
				<T.SphereGeometry args={[limbR * 0.78, 6, 4]} />
				<T.MeshStandardMaterial color="#221710" roughness={0.75} />
			</T.Mesh>
			<T.Group position={[0, -0.54, 0]} rotation={[-footRoll, 0, 0]}>
				<T.Mesh position={[0, -0.065, -0.03]}>
					<T.BoxGeometry args={[limbR * 2.25, limbR * 1.05, limbR * 3.5]} />
					<T.MeshStandardMaterial color="#141414" roughness={0.82} />
				</T.Mesh>
				<T.Mesh position={[0, -0.1, 0.09]}>
					<T.CapsuleGeometry args={[limbR * 0.52, limbR * 1.9, 4, 8]} />
					<T.MeshStandardMaterial color="#1c1c1c" roughness={0.82} />
				</T.Mesh>
				<T.Mesh position={[0, -0.122, -0.025]}>
					<T.BoxGeometry args={[limbR * 2.15, limbR * 0.32, limbR * 3.1]} />
					<T.MeshStandardMaterial color="#090909" roughness={0.95} />
				</T.Mesh>
			</T.Group>
		</T.Group>
	</T.Group>

	<!-- LEFT ARM -->
	<T.Group position={[-0.24, 1.1, armForwardZ - leanForward * 0.6]} rotation={[leftArmRotX, 0, 0]}>
		<T.Mesh position={[0, 0, -0.35]}>
			<T.CapsuleGeometry args={[limbR * 0.5, limbR * 1.8, 4, 8]} />
			<T.MeshStandardMaterial color="#d9c5a7" roughness={0.85} />
		</T.Mesh>
		<T.Mesh position={[0, 0.02, -0.45]}>
			<T.SphereGeometry args={[limbR * 0.75, 7, 5]} />
			<T.MeshStandardMaterial color="#c9b499" roughness={0.85} />
		</T.Mesh>
		<T.Mesh position={[0, -0.04, -0.22]}>
			<T.BoxGeometry args={[limbR * 2.0, limbR * 0.5, limbR * 1.2]} />
			<T.MeshStandardMaterial color={plateTint} roughness={0.38} metalness={0.28} />
		</T.Mesh>
		{#if !isEnemy && classChoice === 'spotter'}
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
		{/if}
		{#if !isEnemy && classChoice === 'gunner'}
			{@const recoil = shotPulse * 0.18}
			<T.Mesh position={[0, 0, -0.6 - recoil]} rotation={[Math.PI / 2, 0, 0]}>
				<T.CylinderGeometry args={[0.05, 0.06, 0.4, 6]} />
				<T.MeshStandardMaterial color="#2b2b2b" roughness={0.38} metalness={0.42} />
			</T.Mesh>
			{#if shotPulse > 0}
				<T.Mesh position={[0, 0, -0.95 - recoil]} scale={[shotPulse, shotPulse, shotPulse]}>
					<T.ConeGeometry args={[0.12, 0.3, 6]} />
					<T.MeshBasicMaterial color="#ffcc55" transparent opacity={shotPulse} />
				</T.Mesh>
			{/if}
		{/if}
	</T.Group>

	<!-- RIGHT ARM -->
	<T.Group position={[0.24, 1.1, armForwardZ - leanForward * 0.6]} rotation={[rightArmRotX, 0, 0]}>
		<T.Mesh position={[0, 0, -0.35]}>
			<T.CapsuleGeometry args={[limbR * 0.5, limbR * 1.8, 4, 8]} />
			<T.MeshStandardMaterial color="#d9c5a7" roughness={0.85} />
		</T.Mesh>
		<T.Mesh position={[0, 0.02, -0.45]}>
			<T.SphereGeometry args={[limbR * 0.75, 7, 5]} />
			<T.MeshStandardMaterial color="#c9b499" roughness={0.85} />
		</T.Mesh>
		<T.Mesh position={[0, -0.04, -0.22]}>
			<T.BoxGeometry args={[limbR * 2.0, limbR * 0.5, limbR * 1.2]} />
			<T.MeshStandardMaterial color={plateTint} roughness={0.38} metalness={0.28} />
		</T.Mesh>
		{#if !isEnemy && classChoice === 'spotter'}
			<!-- Flashlight housing -->
			<T.Mesh position={[0, 0, -0.18]} rotation={[-Math.PI / 2, 0, 0]}>
				<T.ConeGeometry args={[0.12, 0.3, 8]} />
				<T.MeshStandardMaterial color="#bdbdbd" roughness={0.28} metalness={0.62} />
			</T.Mesh>
			<!-- Lens bezel ring -->
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
			<!-- Emissive filament -->
			<T.Mesh position={[0, 0, -0.335]}>
				<T.SphereGeometry args={[0.048, 8, 6]} />
				<T.MeshStandardMaterial
					color="#ffeeaa"
					emissive="#ffeeaa"
					emissiveIntensity={3.2}
				/>
			</T.Mesh>
			<!-- Near-source glow sphere (very transparent) -->
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
			<!-- Lens aperture — center -->
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
			<!-- Lens aperture — mid -->
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
			<!-- Lens aperture — outer corona -->
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
			<!-- Main beam (simplified) -->
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
			<!-- Inner core -->
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
		{:else if !isEnemy && classChoice === 'gunner'}
			{@const recoil = shotPulse * 0.18}
			<T.Mesh position={[0, 0, -0.6 - recoil]} rotation={[Math.PI / 2, 0, 0]}>
				<T.CylinderGeometry args={[0.05, 0.06, 0.4, 6]} />
				<T.MeshStandardMaterial color="#2b2b2b" roughness={0.38} metalness={0.42} />
			</T.Mesh>
			{#if shotPulse > 0}
				<T.Mesh position={[0, 0, -0.95 - recoil]} scale={[shotPulse, shotPulse, shotPulse]}>
					<T.ConeGeometry args={[0.12, 0.3, 6]} />
					<T.MeshBasicMaterial color="#ffcc55" transparent opacity={shotPulse} />
				</T.Mesh>
			{/if}
		{:else if !isEnemy && classChoice === 'healer'}
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
		{/if}
	</T.Group>

	<!-- TANK SHIELD (always present for tank, grows when bracing) -->
	{#if classChoice === 'tank'}
		<T.Group
			position={[shieldPosX, shieldPosY, shieldPosZ]}
			rotation={[-Math.PI / 2, 0, 0]}
			scale={[shieldS, shieldS, shieldS]}
		>
			<!-- Hex plate body (cylinder flat = hex disc from above) -->
			<T.Mesh>
				<T.CylinderGeometry args={[0.44, 0.44, 0.065, 6]} />
				<T.MeshStandardMaterial color="#162416" roughness={0.28} metalness={0.6} />
			</T.Mesh>
			<!-- Outer rim with emissive green glow -->
			<T.Mesh>
				<T.CylinderGeometry args={[0.47, 0.44, 0.02, 6]} />
				<T.MeshStandardMaterial
					color="#2a6e2a"
					emissive="#44ff44"
					emissiveIntensity={0.12 + shieldGlowVis * 2.2}
					roughness={0.28}
					metalness={0.7}
				/>
			</T.Mesh>
			<!-- Cross detail on face (visible from above) -->
			<T.Mesh position={[0, 0.04, 0]}>
				<T.BoxGeometry args={[0.07, 0.01, 0.38]} />
				<T.MeshBasicMaterial color="#55ee55" transparent opacity={0.2 + shieldGlowVis * 0.5} />
			</T.Mesh>
			<T.Mesh position={[0, 0.04, 0]}>
				<T.BoxGeometry args={[0.38, 0.01, 0.07]} />
				<T.MeshBasicMaterial color="#55ee55" transparent opacity={0.2 + shieldGlowVis * 0.5} />
			</T.Mesh>
			<!-- Center stud -->
			<T.Mesh position={[0, 0.04, 0]}>
				<T.CylinderGeometry args={[0.06, 0.06, 0.012, 6]} />
				<T.MeshStandardMaterial
					color="#55ee55"
					emissive="#44ff44"
					emissiveIntensity={0.2 + shieldGlowVis * 1.8}
					roughness={0.3}
					metalness={0.6}
				/>
			</T.Mesh>
			<!-- Brace active: energy disc + outer ring -->
			{#if braceT > 0.05}
				<T.Mesh position={[0, 0.038, 0]}>
					<T.CylinderGeometry args={[0.43, 0.43, 0.001, 16]} />
					<T.MeshBasicMaterial
						color="#44ff44"
						transparent
						opacity={shieldGlowVis * 0.15}
						blending={AdditiveBlending}
						depthWrite={false}
					/>
				</T.Mesh>
				<T.Mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
					<T.RingGeometry args={[0.44, 0.62, 14]} />
					<T.MeshBasicMaterial
						color="#88ff88"
						transparent
						opacity={shieldGlowVis * 0.65}
						blending={AdditiveBlending}
						depthWrite={false}
					/>
				</T.Mesh>
			{/if}
		</T.Group>
	{/if}
</T.Group>
