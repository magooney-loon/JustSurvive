<script lang="ts">
	import MD2EnemyCharacter from '$lib/character/enemies/MD2EnemyCharacter.svelte';

	export type FastRigProps = {
		speed: number;
		attackPhase?: number;
		isDead?: boolean;
	};

	let { speed, attackPhase = 0, isDead = false }: FastRigProps = $props();
</script>

<MD2EnemyCharacter enemyType="fast" {speed} {attackPhase} {isDead} />
