# Class Ability Rework

Documenting proposed changes to class abilities for future implementation.

---

## Spotter

### LMB - Steady Shot

- **Type:** Single-target sniper shot
- **Behavior:** Slow firing, high damage
- **Mark:** Marks target for 5 seconds
- **Damage Bonus:** Marked targets take increased damage from all sources

### RMB - Flash Stun

- **Status:** Keep as is
- **Behavior:** 90° cone stun, 2s daze, 5 unit range

---

## Gunner

### LMB - Shoot

- **Status:** Keep as is
- **Behavior:** 15 damage per shot, 10 unit range
- **Special:** Every 3rd consecutive shot on same target suppresses (1s daze)

### RMB - Adrenaline

- **Status:** Keep as is
- **Behavior:** Instantly restores all stamina, 5s cooldown

---

## Tank

### LMB - Axe Swing

- **Type:** Cone AOE attack
- **Behavior:** Swings axe in cone in front of player
- **Effects:**
  - AOE damage to all enemies in cone
  - Knocks enemies back
  - Dazes enemies (1.5s)
- **Cooldown:** 1.5s

### RMB - Brace

- **Status:** Keep as is
- **Behavior:** Defensive stance, enemies bounce off instead of dealing damage
- **Duration:** Up to 5s, auto-releases at max

---

## Healer

### LMB - Heal

- **Status:** Keep as is
- **Behavior:** Heal ally within 10 units for 30 HP, self-heal for 8 HP
- **Cooldown:** 2s

### RMB - Revive

- **Changes:** Replace damage interruption with defensive shield
- **New Behavior:**
  - Channel for 2s to revive downed ally within 3 units
  - **Shield:** While channeling, apply a defensive shield to the downed ally that absorbs 50 damage
  - Shield protects the ally from taking damage while being revived
  - If shield breaks (50 dmg absorbed), revive is interrupted
- **Cooldown:** 15s after completion
- **Reward:** Revived ally gets 50 HP + 5s speed boost, +20 score

---

## Backend Changes Required

### Spotter

- Remove `markEnemy` reducer (replaced by Steady Shot)
- Add new `steadyShot` reducer with:
  - High damage value (e.g., 40-50)
  - Mark logic (5s duration, damage bonus)
  - Longer cooldown than current mark (e.g., 3s)

### Tank

- Modify `shieldBash` reducer to:
  - Apply AOE damage in cone (calculate enemies within angle/distance)
  - Apply knockback + daze to all in cone
- Or add new `axeSwing` reducer

### Healer

- Modify `reviveStart` reducer to:
  - Add shield effect to target (50 HP shield)
  - Check shield on damage (if shield absorbs, don't interrupt)
  - Only interrupt on actual HP damage after shield breaks
- Add shield tracking in player state or as separate table

---

## Testing Notes

- Spotter steady shot damage vs current mark+gunner combo
- Tank axe swing AOE radius and damage values
- Healer revive shield interaction with enemy damage
- Cooldown balancing for new abilities

---

## Timeline

- Phase 1: Backend reducers
- Phase 2: Frontend Input.svelte updates
- Phase 3: Visual effects (axe swing arc, shield glow)
- Phase 4: Balance tuning
