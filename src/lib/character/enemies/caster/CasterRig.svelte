<script lang="ts">
	import { T } from '@threlte/core';
	import MD2EnemyCharacter from '$lib/character/enemies/MD2EnemyCharacter.svelte';
	import type { EnemyType } from '$lib/character/enemies/md2Cache.js';

	export type CasterRigProps = {
		enemyType?: EnemyType;
		speed: number;
		attackPhase?: number;
		beamTimer?: number;
		isDead?: boolean;
	};

	let {
		enemyType = 'caster',
		speed,
		attackPhase = 0,
		beamTimer = 0,
		isDead = false
	}: CasterRigProps = $props();

	type BeamVisuals = {
		color: string;
		glow: string;
		innerR: number;
		outerR: number;
		length: number;
		glowScale: number;
		endR: number;
	};

	const BEAM_VISUALS: Record<string, BeamVisuals> = {
		// Default blaster — purple, medium
		caster: {
			color: '#dd99ff', glow: '#9933ff',
			innerR: 0.04, outerR: 0.07, length: 8,
			glowScale: 2.8, endR: 0.35
		},
		// Railgun — thin cyan lance, very long
		caster_railgun: {
			color: '#44eeff', glow: '#0066ff',
			innerR: 0.02, outerR: 0.035, length: 14,
			glowScale: 5.0, endR: 0.18
		},
		// Chaingun — wide orange burst, short
		caster_chaingun: {
			color: '#ffaa22', glow: '#ff3300',
			innerR: 0.07, outerR: 0.12, length: 6,
			glowScale: 2.0, endR: 0.28
		},
		// BFG — fat radioactive green blob
		caster_bfg: {
			color: '#33ff88', glow: '#00bb44',
			innerR: 0.14, outerR: 0.22, length: 10,
			glowScale: 3.2, endR: 0.9
		},
		// Shotgun — warm yellow, medium
		caster_shotgun: {
			color: '#ffee44', glow: '#ff8800',
			innerR: 0.05, outerR: 0.09, length: 7,
			glowScale: 2.5, endR: 0.45
		}
	};

	const vis = $derived(BEAM_VISUALS[enemyType] ?? BEAM_VISUALS['caster']);
	const beamOpacity = $derived(Math.min(1, (0.65 - beamTimer) * 12) * Math.min(1, beamTimer * 6));
</script>

<MD2EnemyCharacter {enemyType} {speed} {attackPhase} {isDead} />

{#if beamTimer > 0 && !isDead}
	<T.Group position={[-0.3, 1.45, 0]}>
		<T.Mesh position={[0, 0, -vis.length / 2]} rotation={[Math.PI / 2, 0, 0]}>
			<T.CylinderGeometry args={[vis.innerR, vis.outerR, vis.length, 6]} />
			<T.MeshBasicMaterial
				color={vis.color}
				transparent
				opacity={beamOpacity * 0.9}
				depthWrite={false}
			/>
		</T.Mesh>
		<T.Mesh
			position={[0, 0, -vis.length / 2]}
			rotation={[Math.PI / 2, 0, 0]}
			scale={[vis.glowScale, 1, vis.glowScale]}
		>
			<T.CylinderGeometry args={[vis.innerR, vis.outerR, vis.length, 6]} />
			<T.MeshBasicMaterial
				color={vis.glow}
				transparent
				opacity={beamOpacity * 0.22}
				depthWrite={false}
			/>
		</T.Mesh>
		<T.Mesh
			position={[0, 0, -vis.length]}
			scale={[beamOpacity, beamOpacity, beamOpacity]}
		>
			<T.SphereGeometry args={[vis.endR, 8, 6]} />
			<T.MeshBasicMaterial
				color={vis.color}
				transparent
				opacity={beamOpacity * 0.75}
				depthWrite={false}
			/>
		</T.Mesh>
	</T.Group>
{/if}
