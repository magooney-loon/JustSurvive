<script lang="ts">
	import MD2EnemyCharacter from '$lib/character/enemies/MD2EnemyCharacter.svelte';

	export type BasicRigProps = {
		speed: number;
		attackPhase?: number;
		isDead?: boolean;
	};

	let { speed, attackPhase = 0, isDead = false }: BasicRigProps = $props();
</script>

<MD2EnemyCharacter enemyType="basic" {speed} {attackPhase} {isDead} />
