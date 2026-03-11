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
			const startedAt = Number(myChannel.channelStartedAt.microsSinceUnixEpoch);
			elapsed = 0;
			const interval = setInterval(() => {
				elapsed = Math.min(1, Math.max(0, (Date.now() * 1000 - startedAt) / 2_000_000));
				if (elapsed >= 1) clearInterval(interval);
			}, 50);
			return () => clearInterval(interval);
		}
	});
</script>

{#if myChannel}
	<div style="
		position: absolute; bottom: 9rem; left: 50%; transform: translateX(-50%);
		background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
		padding: 0.65rem 1.75rem; border-radius: 0.75rem; text-align: center;
		backdrop-filter: blur(6px);
	">
		<div style="font-size: 0.8rem; color: #f4a; margin-bottom: 0.4rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;">Reviving...</div>
		<div style="background: rgba(0,0,0,0.4); border-radius: 4px; height: 8px; width: 180px; overflow: hidden;">
			<div style="background: #f4a; border-radius: 4px; height: 100%; width: {elapsed * 100}%; transition: width 0.05s;"></div>
		</div>
	</div>
{/if}
