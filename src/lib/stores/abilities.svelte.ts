// Shared ability state — written by AbilityInput, read by GameHud
export const abilityState = $state({
	markCooldownUntil: 0, // ms timestamp (spotter mark, 5s)
	suppressHits: 0, // gunner suppress counter (resets on enemy change)
	lastSuppressedEnemyId: null as bigint | null,
	bashCooldownUntil: 0, // ms timestamp (tank bash, 1.5s)
	healCooldownUntil: 0, // ms timestamp (healer heal shot, 2s)
	braceCooldownUntil: 0, // ms timestamp (tank brace, 1s between activations)
	pingCooldownUntil: 0, // ms timestamp (spotter flash stun, 1.5s)
	adrenalineCooldownUntil: 0, // ms timestamp (gunner adrenaline, 5s)
	adrenalineUntil: 0 // ms timestamp — visual effect active during adrenaline
});

// Heal beam — written by AbilityInput, read by HealBeam (3D scene)
export const healBeam = $state({ active: false, toX: 0, toZ: 0, until: 0 });
export const HEAL_BEAM_MS = 350;

// Muzzle flash — written by AbilityInput (gunner shot), read by PlayerEntity
// Uses optimistic local state to avoid latency issues in production
export const shotFlash = $state({ until: 0 });
export const SHOT_FLASH_MS = 200;

// Spotter flash stun cone — written by AbilityInput, read by SpotterFlashEffect
export const spotterFlash = $state({ active: false, yaw: 0, until: 0 });
export const SPOTTER_FLASH_MS = 500;

export function resetAbilities() {
	abilityState.markCooldownUntil = 0;
	abilityState.suppressHits = 0;
	abilityState.lastSuppressedEnemyId = null;
	abilityState.bashCooldownUntil = 0;
	abilityState.healCooldownUntil = 0;
	abilityState.braceCooldownUntil = 0;
	abilityState.pingCooldownUntil = 0;
	abilityState.adrenalineCooldownUntil = 0;
	abilityState.adrenalineUntil = 0;
	shotFlash.until = 0;
	healBeam.active = false;
	healBeam.toX = 0;
	healBeam.toZ = 0;
	healBeam.until = 0;
}
