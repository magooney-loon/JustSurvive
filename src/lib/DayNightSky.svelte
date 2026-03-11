<script lang="ts">
	import { T } from '@threlte/core';

	type Props = { phase: string };
	let { phase }: Props = $props();

	const PHASE_COLORS = {
		sunset:     { sky: [1.0, 0.5, 0.2] as [number, number, number], ambient: 0.8, sun: 1.2 },
		dusk:       { sky: [0.6, 0.3, 0.4] as [number, number, number], ambient: 0.5, sun: 0.6 },
		twilight:   { sky: [0.15, 0.1, 0.3] as [number, number, number], ambient: 0.25, sun: 0.2 },
		night:      { sky: [0.02, 0.02, 0.08] as [number, number, number], ambient: 0.08, sun: 0.05 },
		deep_night: { sky: [0.01, 0.01, 0.04] as [number, number, number], ambient: 0.03, sun: 0.01 },
	};

	const current = $derived(PHASE_COLORS[phase as keyof typeof PHASE_COLORS] ?? PHASE_COLORS.sunset);
</script>

<T.AmbientLight intensity={current.ambient} />
<T.DirectionalLight
	position={[50, 80, 50]}
	intensity={current.sun}
	color={`rgb(${Math.round(current.sky[0] * 255)},${Math.round(current.sky[1] * 255)},${Math.round(current.sky[2] * 255)})`}
/>
