<script lang="ts">
	import MD2EnemyCharacter from '$lib/character/enemies/MD2EnemyCharacter.svelte';

	export type OgreRigProps = {
		enemyType: 'ogre' | 'ogre_berserker' | 'ogre_stalker';
		speed: number;
		attackPhase?: number;
		isDead?: boolean;
	};

	let { enemyType, speed, attackPhase = 0, isDead = false }: OgreRigProps = $props();
</script>

<MD2EnemyCharacter {enemyType} {speed} {attackPhase} {isDead} />
