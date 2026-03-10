# Forest Run — Game Concept

## Core Loop

Players run through an endless procedurally-generated forest. Survive as long as possible while accumulating points. No win state — just outlast everyone else.

**Score = Time Survived (seconds) + Enemies Marked/Killed + Distance Traveled**

Each completed day cycle increases the score multiplier (Day 2 = 1.5x, Day 3 = 2x, etc.).

---

## Character Classes

Each class fills a distinct niche. No class can survive long alone — coordination is required.

---

### Spotter

| Stat     | Value |
|----------|-------|
| HP       | 100   |
| Stamina  | 150   |
| Speed    | Fast  |

**Weapon:** Flashlight only
**Role:** Reconnaissance & information warfare

**Abilities:**
- **Mark:** Flashlight illuminates and marks enemies for 5 seconds — marked enemies are visible to all players through trees
- **Path Lighting:** Flashlight reveals hazards and items ahead
- **Ping:** Can tag a location (item, path fork, threat) even without line-of-sight — 10 second cooldown
- **Night Scaling:** Flashlight range increases in darker phases — becomes the most critical class at night

**Limitations:**
- Cannot mark while sprinting
- Useless offensively — entirely dependent on team to act on information

**Synergy:** Spotter marks → Gunner kills, Tank controls. Without Spotter in deep night, enemies are nearly invisible.

---

### Gunner

| Stat     | Value    |
|----------|----------|
| HP       | 100      |
| Stamina  | 80       |
| Speed    | Moderate |

**Weapon:** Akimbo pistols (infinite ammo)
**Role:** Primary damage dealer & soft crowd control

**Abilities:**
- **Rapid Fire:** High fire rate, moderate per-shot damage
- **Laser Sight:** Always-on laser beam that illuminates targets for the Gunner only — improves personal target acquisition and accuracy in low visibility. Disables automatically while sprinting, re-enables when slowing down
- **Suppression:** Sustained fire on a single target slows its movement speed by 40% — buys time for Tank to shield-bash or team to reposition

**Limitations:**
- Reduced accuracy while sprinting
- Low stamina means he can't sprint-and-gun for long
- Laser sight is personal only — doesn't share information with teammates
- Laser sight disables while sprinting — loses targeting advantage when fleeing

**Synergy:** Gunner is most effective fighting alongside Spotter — Spotter marks so the team can see threats, Gunner's laser sight helps him personally lock on and suppress them. Without Spotter, Gunner is fighting semi-blind at night. Suppression + Tank knockback = reliable crowd control chain.

---

### Tank

| Stat     | Value     |
|----------|-----------|
| HP       | 150       |
| Stamina  | 200       |
| Speed    | Very Slow |

**Weapon:** Riot shield
**Role:** Crowd control, protection & path clearing

**Abilities:**
- **Shield Bash:** Knocks enemies back, briefly dazes them (stun ~1.5s). Also breaks Debris Blockages in the path
- **Brace:** Plants feet — mandatory 2 second hold, 5 second cooldown after releasing. While braced, enemies that collide with the shield bounce off and are dazed. Tank cannot move during brace. Teammates can safely run past
- **Rearguard:** Naturally runs at the back of the group; dazed enemies give the team distance

**Limitations:**
- Cannot deal damage — only control and clearing
- Slowest class by far — team must account for Tank's pace or leave him behind
- Brace locks Tank in place for a full 2 seconds with a 5s cooldown — timing and positioning matter

**Synergy:** Tank braces at a path bottleneck, Gunner suppresses the overflow, Healer stays close. Tank clears debris so the team doesn't have to stop and shoot. Spotter's marks let Tank know which direction threats are coming from.

---

### Healer

| Stat     | Value |
|----------|-------|
| HP       | 100   |
| Stamina  | 80    |
| Speed    | Fast  |

**Weapon:** Shotgun (infinite ammo, wide spread)
**Role:** Support, resurrection & emergency lighting

**Abilities:**
- **Revive:** Resurrects fallen players — infinite uses, 15 second cooldown between each. Healer must stand near the downed player and channel for 2 seconds. Any damage taken by the Healer during the channel cancels and resets the revive. Resurrected player returns with 50 HP
- **Adrenaline Shot:** On successful revive, the resurrected player gets a 5-second sprint speed burst — lets them immediately escape danger
- **Headlamp:** Always-on head-mounted light. Short range, narrow cone, low brightness — not a replacement for Spotter, but lets Healer navigate and find downed teammates in the dark without being blind

**Limitations:**
- Low stamina — must manage when to sprint
- Shotgun is close-range only; not reliable for covering distances
- Revive requires 2 uninterrupted seconds — needs protection from Tank or Gunner
- Headlamp doesn't mark enemies, only weakly illuminates the immediate area

**Synergy:** Healer's headlamp means they can find downed teammates in the dark without Spotter. Revive channel creates a high-stakes protection window — Tank bracing nearby is ideal.

---

## Health & Stamina System

### Health

| Source                | Effect                     |
|-----------------------|----------------------------|
| Enemy melee hit       | -15 HP                     |
| Falling into pit      | -25 HP + brief stun        |
| Acid pool (Spitter)   | -5 HP/sec while standing in it |
| Revived by Healer     | Restored to 50 HP          |

### Stamina

| Class   | Pool |
|---------|------|
| Spotter | 150  |
| Gunner  | 80   |
| Tank    | 200  |
| Healer  | 80   |

- Drains while sprinting; recharges while walking
- Running out of stamina forces a walk — dangerous if enemies are close

---

## Collectible Items

Items spawn randomly along the path. Collected by running over them.

| Item              | Effect                                                            |
|-------------------|-------------------------------------------------------------------|
| ⚡ Energy Drink   | +50% sprint speed for 10 seconds                                  |
| 💪 Stamina Boost  | Instantly refills stamina + 25% bonus max stamina for 30 seconds  |
| ❤️ Medkit         | Restores 50 HP                                                    |
| 🛡️ Armor Plate    | +25 max HP (stacks up to 50 bonus HP)                             |
| 🔦 Flare          | Throwable. Illuminates a large area AND marks all enemies within radius for 8 seconds — visible to the whole team. Useful for clearings or when Spotter is down |

---

## Enemy Behavior

### Chase Mechanics

- Enemies spawn from forest edges and pursue the nearest player
- Enemies chase at their base speed — if they do not get killed, they gain a flat +10% speed bonus on top of their base (persistent, stacks per unkilled enemy)
- Melee attack on reach: -15 HP per hit
- Can be killed by Gunner or Healer's shotgun
- Can be marked (Spotter flashlight, Gunner laser sight, Flare)
- Can be knocked back / dazed by Tank shield bash

### Enemy Types

| Type    | Speed    | HP  | Notes                                                                 |
|---------|----------|-----|-----------------------------------------------------------------------|
| Basic   | Moderate | 50  | Standard chase + melee                                                |
| Fast    | High     | 25  | Skirmisher — hard to track                                            |
| Brute   | Slow     | 150 | Hits for 30 HP, harder to knock back                                  |
| Spitter | Slow     | 60  | Ranged — spits corrosive acid onto the ground. Acid pool persists for 8 seconds, slowing any player who walks through it and dealing -5 HP/sec. Doesn't melee |

---

## Map Hazards

### Environmental Obstacles

| Hazard            | Effect                                                                                          |
|-------------------|-------------------------------------------------------------------------------------------------|
| Dense Bushes      | Thick overgrowth blocking or flanking the path — walking through slows players significantly. Unavoidable but passable |
| Stumps            | Low obstacles requiring a jump                                                                  |
| Pits              | Fall in → -25 HP + stamina drain + climb delay                                                  |
| Debris Blockage   | Fallen logs or rubble fully blocking the path. Must be shot down by Gunner/Healer, or bashed by Tank's shield. Creates a forced stop-or-clear decision |

### Procedural Generation

- Forest density and obstacle frequency scale with distance/score
- **Branching Paths:** Forest occasionally splits into 2–3 routes
  - Paths diverge briefly then merge back ahead
  - Tactical choice: stay together or split to cover more item spawns?
  - **Dead End chance:** One path may dead-end — players who took it must turn around and backtrack to the merge point, running against the flow of enemies they may have passed. Spotter's Ping is critical here to warn teammates before they commit to a dead end
- **Clearings:** Periodic open fields
  - High visibility, less cover
  - More item spawns
  - Enemies visible from further away — Flares and laser tags shine here

---

## World Events

Random events that trigger unpredictably and last for a limited duration, layering additional pressure on top of normal gameplay.

### Fog

- A dense fog rolls across the entire map — visibility drops sharply for all players regardless of phase
- Duration: **30–60 seconds** (randomized each occurrence)
- Stacks with night darkness — fog during Deep Night is near-total blackout
- Spotter's flashlight cuts through fog better than other light sources (headlamp barely helps)
- Enemies do not slow down in fog — they navigate by sound, not sight
- Fog recedes gradually rather than snapping off — players get a few seconds of warning as it lifts

---

## Day/Night Cycle

Game begins at **golden hour** — warm sunset lighting, long shadows, good visibility.

Every 60 seconds the sky shifts one phase:

```
Sunset → Dusk → Twilight → Night → Deep Night → (loop back to Sunset)
```

Each completed cycle = "one day" survived. Score multiplier increases per day.

| Phase      | Visibility | Notes                                               |
|------------|------------|-----------------------------------------------------|
| Sunset     | Full       | Beautiful, calm — false sense of security           |
| Dusk       | High       | Shadows lengthen, color cools                       |
| Twilight   | Medium     | Edges of screen darken                              |
| Night      | Low        | Flashlight becomes essential                        |
| Deep Night | Very Low   | Enemy silhouettes nearly invisible without marks    |

**Visual Feedback:**
- UI indicator shows current phase + time until next shift
- Screen edge vignette intensifies with darkness
- Color palette shifts warm → cold (orange sunset → blue/black night)

**Class scaling at night:**
- Spotter's flashlight range grows — becomes irreplaceable
- Healer's headlamp keeps them functional solo
- Gunner's laser sight cuts through dark (short range but precise)
- Tank relies entirely on teammates for threat awareness

---

## Revive System

- Player at 0 HP goes down — visible to teammates
- Healer must stand near the downed player and channel for 2 seconds — any damage during the channel cancels and resets it
- 15 second cooldown between each successful revive
- Revived player returns at 50 HP + 5s speed burst (Adrenaline Shot)
- If not revived within 30 seconds, player is eliminated for the run

---

## Lobby & Player Count

- Minimum **2 players** required to start
- Maximum **4 players**
- Lobby modes: host public, host private, join by code, quickplay (auto-join open public lobby)
- Class must be selected before ready-up; host starts the countdown when all players are ready

### Player Count Score Bonus

Smaller teams are rewarded for the increased difficulty:

| Players | Bonus Multiplier |
|---------|-----------------|
| 4       | 1.0x            |
| 3       | 1.25x           |
| 2       | 1.5x            |

The bonus is applied to the final score alongside the day cycle multiplier.

**Final Score = (Time + Kills + Distance) × Day Multiplier × Player Count Bonus**

---

## Win Condition

**Endless survival.** No victory screen — just a final score when the last player goes down.

Leaderboard: highest score wins. Compete across runs.

---

## Game Feel Targets

- **High tempo** — always moving, constant decisions
- **Constant pressure** — enemies, hazards, stamina drain, darkness
- **Escalating dread** — starts beautiful, gets progressively scarier
- **Information = survival** — marks, tags, headlamps and flares are as important as damage
- **Class interdependence** — no class is self-sufficient in the late game
- **Risk/reward decisions** — clear the debris or go around? Brace the bottleneck or keep pace?
- **Darkness punishes fragmentation** — split up at night and the team goes blind
- **Unkilled enemies compound** — ignoring threats early makes them a faster, harder problem later
