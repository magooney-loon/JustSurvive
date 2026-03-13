<script lang="ts">
	import { T, useTask } from '@threlte/core';

	type Props = { phase: string };
	let { phase }: Props = $props();

	const PHASE_COLORS = {
		sunset: { sky: [1.0, 0.5, 0.2] as [number, number, number], ambient: 0.8, sun: 1.2 },
		dusk: { sky: [0.6, 0.3, 0.4] as [number, number, number], ambient: 0.5, sun: 0.6 },
		twilight: { sky: [0.15, 0.1, 0.3] as [number, number, number], ambient: 0.25, sun: 0.2 },
		night: { sky: [0.02, 0.02, 0.08] as [number, number, number], ambient: 0.08, sun: 0.05 },
		deep_night: { sky: [0.01, 0.01, 0.04] as [number, number, number], ambient: 0.03, sun: 0.01 }
	};

	const target = $derived(PHASE_COLORS[phase as keyof typeof PHASE_COLORS] ?? PHASE_COLORS.sunset);

	let currentSky = $state.raw<[number, number, number]>([...PHASE_COLORS.sunset.sky]);
	let currentAmbient = $state(PHASE_COLORS.sunset.ambient);
	let currentSun = $state(PHASE_COLORS.sunset.sun);

	const TRANSITION_SPEED = 2.0;

	useTask((delta) => {
		const sky = target.sky;
		const t = Math.min(1, delta * TRANSITION_SPEED);

		currentAmbient += (target.ambient - currentAmbient) * t;
		currentSun += (target.sun - currentSun) * t;
		currentSky[0] += (sky[0] - currentSky[0]) * t;
		currentSky[1] += (sky[1] - currentSky[1]) * t;
		currentSky[2] += (sky[2] - currentSky[2]) * t;
	});
</script>

<T.AmbientLight intensity={currentAmbient} />
<T.DirectionalLight
	position={[50, 80, 50]}
	intensity={currentSun}
	color={`rgb(${Math.round(currentSky[0] * 255)},${Math.round(currentSky[1] * 255)},${Math.round(currentSky[2] * 255)})`}
/>
