<script lang="ts">
	import { useStudio, ToolbarItem, HorizontalButtonGroup, ToolbarButton } from '@threlte/studio/extend';
	import { devSky } from '../localGameState.svelte.js';

	const { createExtension } = useStudio();
	createExtension({ scope: 'sky', state() { return {}; }, actions: {} });

	const PHASES = [
		{ id: 'sunset',     label: 'Sunset',     icon: 'mdiWeatherSunny' },
		{ id: 'dusk',       label: 'Dusk',        icon: 'mdiWeatherSunsetDown' },
		{ id: 'twilight',   label: 'Twilight',    icon: 'mdiWeatherPartlyCloudy' },
		{ id: 'night',      label: 'Night',       icon: 'mdiWeatherNight' },
		{ id: 'deep_night', label: 'Deep Night',  icon: 'mdiMoonFull' },
	] as const;
</script>

<ToolbarItem position="left">
	<HorizontalButtonGroup>
		{#each PHASES as phase}
			<ToolbarButton
				label={phase.label}
				icon={phase.icon as any}
				active={devSky.forcedPhase === phase.id}
				tooltip="Force sky: {phase.label}{devSky.forcedPhase === phase.id ? ' (click to clear)' : ''}"
				onclick={() => {
					devSky.forcedPhase = devSky.forcedPhase === phase.id ? null : phase.id;
				}}
			/>
		{/each}
	</HorizontalButtonGroup>
</ToolbarItem>

<slot />
