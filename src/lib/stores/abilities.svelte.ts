// Shared ability state — written by AbilityInput, read by GameHud
export const abilityState = $state({
	markCooldownUntil: 0,      // ms (spotter steady shot, 1.5s)
	suppressHits: 0,           // gunner suppress counter (resets on enemy change)
	lastSuppressedEnemyId: null as bigint | null,
	bashCooldownUntil: 0,      // ms (tank axe swing, 0.5s)
	healCooldownUntil: 0,      // ms (healer chain heal, 3s)
	chargeCooldownUntil: 0,    // ms (tank charge, 8s cooldown)
	chargeYaw: 0,              // camera yaw locked at charge activation
	pingCooldownUntil: 0,      // ms (spotter flash, 3s)
	adrenalineCooldownUntil: 0,// ms (gunner adrenaline, 5s)
	ultimateCooldownUntil: 0,  // ms (all classes, 35s)
	adrenalineUntil: 0         // ms — visual effect active during adrenaline
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

// Steady shot flash — optimistic local effect for the shooter
export const steadyShotFlash = $state({ until: 0, yaw: 0 });
export const STEADY_SHOT_FLASH_MS = 250;

// Axe swing cone — optimistic local effect for the tank
export const axeSwingFlash = $state({ active: false, yaw: 0, until: 0 });
export const AXE_SWING_FLASH_MS = 350;

export function resetAbilities() {
	abilityState.markCooldownUntil = 0;
	abilityState.suppressHits = 0;
	abilityState.lastSuppressedEnemyId = null;
	abilityState.bashCooldownUntil = 0;
	abilityState.healCooldownUntil = 0;
	abilityState.chargeCooldownUntil = 0;
	abilityState.pingCooldownUntil = 0;
	abilityState.adrenalineCooldownUntil = 0;
	abilityState.ultimateCooldownUntil = 0;
	abilityState.adrenalineUntil = 0;
	shotFlash.until = 0;
	healBeam.active = false;
	healBeam.toX = 0;
	healBeam.toZ = 0;
	healBeam.until = 0;
	steadyShotFlash.until = 0;
	steadyShotFlash.yaw = 0;
	axeSwingFlash.active = false;
	axeSwingFlash.yaw = 0;
	axeSwingFlash.until = 0;
}
