// Local player HP ratio [0..1] — written by GameStage, read by Renderer
export const localHealthState = $state({ ratio: 1 });

// Dev override — set by SkyExtension in studio mode, null = use session phase
export const devSky = $state({ forcedPhase: null as string | null });

// Sky state — written by GameStage (lerped per phase), read by Skybox
export const skyState = $state({
	elevation: -3,
	azimuth: 250,
	turbidity: 8,
	rayleigh: 0.5,
	mieCoefficient: 0.004,
	mieDirectionalG: 0.7,
	ambientIntensity: 0.18,
	sunIntensity: 0.12,
	sunR: 0.4,
	sunG: 0.25,
	sunB: 0.5,
	stormIntensity: 0.3
});

// Reset local health state after game ends
export function resetLocalHealth() {
	localHealthState.ratio = 1;
}
