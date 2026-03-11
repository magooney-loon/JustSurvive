<script lang="ts">
	import { useTable, useSpacetimeDB } from 'spacetimedb/svelte';
	import { tables } from '../module_bindings/index.js';
	import { gameState } from '../game.svelte.js';

	const conn = useSpacetimeDB();
	const [channels] = useTable(tables.reviveChannel);

	const myChannel = $derived($channels.find(c =>
		c.sessionId === gameState.currentSessionId &&
		c.healerIdentity.toHexString() === $conn.identity?.toHexString()
	));

	let elapsed = $state(0);

	$effect(() => {
		if (myChannel) {
			const startedAt = myChannel.channelStartedAt.microsSinceUnixEpoch;
			elapsed = 0;
			const interval = setInterval(() => {
				elapsed = Number((BigInt(Date.now()) * 1000n - startedAt) / 2_000_000n);
				if (elapsed >= 1) clearInterval(interval);
			}, 50);
			return () => clearInterval(interval);
		}
	});
</script>

{#if myChannel}
	<div style="position: absolute; bottom: 6rem; left: 50%; transform: translateX(-50%);
	            background: rgba(0,0,0,0.7); padding: 0.5rem 1.5rem; border-radius: 8px; text-align: center;">
		<div style="font-size: 0.85rem; color: #f4a; margin-bottom: 0.3rem;">REVIVING...</div>
		<div style="background: #333; border-radius: 4px; height: 8px; width: 160px;">
			<div style="background: #f4a; border-radius: 4px; height: 100%; width: {Math.min(elapsed * 100, 100)}%;
			            transition: width 0.05s;"></div>
		</div>
	</div>
{/if}
