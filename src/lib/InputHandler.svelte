<script lang="ts">
	import { input } from '../localGameState.svelte.js';

	const keyMap: Record<string, keyof typeof input> = {
		'KeyW': 'forward', 'ArrowUp': 'forward',
		'KeyS': 'back',    'ArrowDown': 'back',
		'KeyA': 'left',    'ArrowLeft': 'left',
		'KeyD': 'right',   'ArrowRight': 'right',
		'ShiftLeft': 'sprint', 'ShiftRight': 'sprint',
	};

	function onKeyDown(e: KeyboardEvent) {
		const key = keyMap[e.code];
		if (key) input[key] = true;
	}

	function onKeyUp(e: KeyboardEvent) {
		const key = keyMap[e.code];
		if (key) input[key] = false;
	}
</script>

<svelte:window onkeydown={onKeyDown} onkeyup={onKeyUp} />
