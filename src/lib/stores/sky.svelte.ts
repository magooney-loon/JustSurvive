// Local player HP ratio [0..1] — written by GameStage, read by Renderer
export const localHealthState = $state({ ratio: 1 });

// Dev override — set by SkyExtension in studio mode, null = use session phase
export const devSky = $state({ forcedPhase: null as string | null });

// Sky state — written by GameStage (lerped per phase), read by Skybox
export const skyState = $state({
	elevation: 3,
	azimuth: 260,
	turbidity: 12,
	rayleigh: 2.5,
	mieCoefficient: 0.007,
	mieDirectionalG: 0.8,
	ambientIntensity: 0.6,
	sunIntensity: 1.0,
	sunR: 1.0,
	sunG: 0.75,
	sunB: 0.45,
	stormIntensity: 0 // 0 = clear, 1 = full storm — drives rain audio + lightning
});
