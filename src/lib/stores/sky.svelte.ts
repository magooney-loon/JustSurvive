// Local player HP ratio [0..1] — written by GameStage, read by Renderer
export const localHealthState = $state({ ratio: 1 });

// Dev override — set by SkyExtension in studio mode, null = use session phase
export const devSky = $state({ forcedPhase: null as string | null });

// Phase sky configs — used by GameStage to lerp skyState
export const PHASE_SKY = {
	sunset: {
		elevation: 0,
		azimuth: 260,
		turbidity: 4,
		rayleigh: 1,
		mieC: 0.004,
		mieG: 0.7,
		ambient: 0.25,
		sun: 0.3,
		sunR: 1.0,
		sunG: 0.75,
		sunB: 0.45,
		storm: 0.0
	},
	dusk: {
		elevation: -0.5,
		azimuth: 255,
		turbidity: 3,
		rayleigh: 0.8,
		mieC: 0.003,
		mieG: 0.65,
		ambient: 0.2,
		sun: 0.25,
		sunR: 0.85,
		sunG: 0.55,
		sunB: 0.3,
		storm: 0.0
	},
	twilight: {
		elevation: -1.5,
		azimuth: 250,
		turbidity: 2,
		rayleigh: 0.3,
		mieC: 0.002,
		mieG: 0.6,
		ambient: 0.1,
		sun: 0.08,
		sunR: 0.45,
		sunG: 0.45,
		sunB: 0.65,
		storm: 0.2
	},
	night: {
		elevation: -2.25,
		azimuth: 250,
		turbidity: 6,
		rayleigh: 0.2,
		mieC: 0.003,
		mieG: 0.7,
		ambient: 0.07,
		sun: 0.04,
		sunR: 0.3,
		sunG: 0.35,
		sunB: 0.55,
		storm: 0.75
	},
	deep_night: {
		elevation: -2.7,
		azimuth: 250,
		turbidity: 6,
		rayleigh: 0.1,
		mieC: 0.002,
		mieG: 0.7,
		ambient: 0.03,
		sun: 0.01,
		sunR: 0.2,
		sunG: 0.25,
		sunB: 0.4,
		storm: 1.0
	}
} as const;

// Sky state — written by GameStage (lerped per phase), read by Skybox and Renderer
export const skyState = $state({
	phase: 'sunset' as string,
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
