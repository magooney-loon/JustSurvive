<script lang="ts">
	import MD2EnemyCharacter from '$lib/character/enemies/MD2EnemyCharacter.svelte';

	export type BruteRigProps = {
		speed: number;
		attackPhase?: number;
		isDead?: boolean;
	};

	let { speed, attackPhase = 0, isDead = false }: BruteRigProps = $props();
</script>

<MD2EnemyCharacter enemyType="brute" {speed} {attackPhase} {isDead} />
