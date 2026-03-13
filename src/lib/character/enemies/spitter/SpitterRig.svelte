<script lang="ts">
	import MD2EnemyCharacter from '$lib/character/enemies/MD2EnemyCharacter.svelte';

	export type SpitterRigProps = {
		speed: number;
		attackPhase?: number;
		isDead?: boolean;
	};

	let { speed, attackPhase = 0, isDead = false }: SpitterRigProps = $props();
</script>

<MD2EnemyCharacter enemyType="spitter" {speed} {attackPhase} {isDead} />
