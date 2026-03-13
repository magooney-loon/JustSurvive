<script lang="ts">
	import { T } from '@threlte/core';
	import MD2EnemyCharacter from '$lib/character/enemies/MD2EnemyCharacter.svelte';

	export type CasterRigProps = {
		speed: number;
		attackPhase?: number;
		beamTimer?: number;
		isDead?: boolean;
	};

	let { speed, attackPhase = 0, beamTimer = 0, isDead = false }: CasterRigProps = $props();

	const beamOpacity = $derived(Math.min(1, (0.65 - beamTimer) * 12) * Math.min(1, beamTimer * 6));
</script>

<MD2EnemyCharacter enemyType="caster" {speed} {attackPhase} {isDead} />

{#if beamTimer > 0 && !isDead}
	<T.Group position={[0.3, 1.45, 0]}>
		<T.Mesh position={[0, 0, -4]} rotation={[Math.PI / 2, 0, 0]}>
			<T.CylinderGeometry args={[0.04, 0.07, 8, 6]} />
			<T.MeshBasicMaterial
				color="#dd99ff"
				transparent
				opacity={beamOpacity * 0.9}
				depthWrite={false}
			/>
		</T.Mesh>
		<T.Mesh position={[0, 0, -4]} rotation={[Math.PI / 2, 0, 0]} scale={[2.8, 1, 2.8]}>
			<T.CylinderGeometry args={[0.04, 0.07, 8, 6]} />
			<T.MeshBasicMaterial
				color="#9933ff"
				transparent
				opacity={beamOpacity * 0.22}
				depthWrite={false}
			/>
		</T.Mesh>
		<T.Mesh position={[0, 0, -8]} scale={[beamOpacity, beamOpacity, beamOpacity]}>
			<T.SphereGeometry args={[0.35, 8, 6]} />
			<T.MeshBasicMaterial
				color="#ffffff"
				transparent
				opacity={beamOpacity * 0.6}
				depthWrite={false}
			/>
		</T.Mesh>
	</T.Group>
{/if}
