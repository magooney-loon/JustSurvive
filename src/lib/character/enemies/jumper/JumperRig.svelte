<script lang="ts">
	import MD2EnemyCharacter from '$lib/character/enemies/MD2EnemyCharacter.svelte';

	export type JumperRigProps = {
		speed: number;
		attackPhase?: number;
		isDead?: boolean;
	};

	let { speed, attackPhase = 0, isDead = false }: JumperRigProps = $props();
</script>

<MD2EnemyCharacter enemyType="jumper" {speed} {attackPhase} {isDead} />
