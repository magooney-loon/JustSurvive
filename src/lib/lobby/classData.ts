export type ClassId = 'spotter' | 'gunner' | 'tank' | 'healer';

export interface ClassStats {
	id: ClassId;
	name: string;
	role: string;
	hp: number;
	stamina: number;
	walkSpeed: number;
	sprintSpeed: number;
	color: string;
	icon: string;
}

export interface ClassAbility {
	name: string;
	hudLabel: string;
	input: string;
	cooldown: string;
	cooldownMs: number;
	desc: string;
	isUltimate?: boolean;
}

export interface ClassData {
	stats: ClassStats;
	abilities: ClassAbility[];
	tips: string[];
}

export const CLASSES: Record<ClassId, ClassData> = {
	spotter: {
		stats: {
			id: 'spotter',
			name: 'Spotter',
			role: 'Scout',
			hp: 100,
			stamina: 600,
			walkSpeed: 5.0,
			sprintSpeed: 9.0,
			color: '#4af',
			icon: 'sword'
		},
		abilities: [
			{
				name: 'Steady Shot',
				hudLabel: 'Steady Shot',
				input: 'LMB',
				cooldown: '1.5s',
				cooldownMs: 1500,
				desc: 'Fire a piercing sniper shot. Primary target takes 45 damage (55 if already marked) and is always marked. Subsequent enemies on the shot line take 75%→50%→25% falloff damage — only the last pierced enemy gets marked. Score: +1 per kill, +3 on a fresh mark, +1 per pierce.'
			},
			{
				name: 'Flash',
				hudLabel: 'Flash',
				input: 'RMB',
				cooldown: '3s',
				cooldownMs: 3000,
				desc: 'Fire a 90° flash cone up to 9 units. Deals 10 damage and dazes all enemies in range for 3.5s. +5 score per stunned enemy.'
			},
			{
				name: 'Barrage',
				hudLabel: 'BARRAGE',
				input: 'Space',
				cooldown: '35s',
				cooldownMs: 35000,
				isUltimate: true,
				desc: 'Instantly fire on every enemy within 23 units — marks them all and deals 20 damage each. Score per kill or mark scales with targets hit.'
			}
		],
		tips: [
			'Steady Shot now pierces — line up shots through packs to hit multiple enemies. Only the last target in the chain gets marked.',
			'Shoot an already-marked target for 55 damage. With 1.5s cooldown, chain two shots on tough enemies like Brutes.',
			'Flash reaches 9 units and dazes for 3.5s — use it to lock down a charging pack before teammates engage.',
			'Barrage marks and chips all enemies in range simultaneously — devastating at the start of a boss fight or dense wave.',
			'Your high stamina and fast regen make you the best kiter — stay mobile and keep tagging targets for your team.'
		]
	},
	gunner: {
		stats: {
			id: 'gunner',
			name: 'Gunner',
			role: 'DPS',
			hp: 100,
			stamina: 80,
			walkSpeed: 4.5,
			sprintSpeed: 7.5,
			color: '#f84',
			icon: 'weapon-slot'
		},
		abilities: [
			{
				name: 'Shoot',
				hudLabel: 'Fire',
				input: 'LMB',
				cooldown: 'None',
				cooldownMs: 0,
				desc: 'Fire at an enemy within 10 units. Deals 15 damage (25 vs marked targets). Every 3rd consecutive shot on the same target suppresses it — dazing for 1s. +1 score per hit, +2 on kill.'
			},
			{
				name: 'Adrenaline',
				hudLabel: 'Adrenaline',
				input: 'RMB',
				cooldown: '5s',
				cooldownMs: 5000,
				desc: 'Instantly restore all stamina. Essential for maintaining suppression chains or escaping danger.'
			},
			{
				name: 'Frenzy',
				hudLabel: 'FRENZY',
				input: 'Space',
				cooldown: '35s',
				cooldownMs: 35000,
				isUltimate: true,
				desc: 'Unleash a burst that hits every enemy within 15 units — deals 15 damage and dazes each for 2s. Score: +2 per kill, +1 per hit.'
			}
		],
		tips: [
			'Every 3rd shot suppresses the target. Chain bursts to keep Brutes and bosses permanently staggered.',
			'Adrenaline is essential when you need to sprint or maintain fire — time it before engagements, not after.',
			'You have low stamina — Adrenaline is your lifeline, not a panic button. Use it strategically.',
			'Frenzy clears melee crowds instantly — use it when enemies close in, not just for DPS.',
			'Suppressed enemies deal no damage. Prioritize high-threat targets like Brutes and Casters.'
		]
	},
	tank: {
		stats: {
			id: 'tank',
			name: 'Tank',
			role: 'Frontline',
			hp: 200,
			stamina: 300,
			walkSpeed: 2.5,
			sprintSpeed: 3.5,
			color: '#8a4',
			icon: 'shield'
		},
		abilities: [
			{
				name: 'Axe Swing',
				hudLabel: 'Axe Swing',
				input: 'LMB',
				cooldown: '0.5s',
				cooldownMs: 500,
				desc: 'Swing your axe in a 90° cone up to 4 units. Deals 25 damage to all enemies in range, knocks them back, and dazes them for 1.5s. Score: +1 per hit, +2 per kill, +25/+50 vs boss.'
			},
			{
				name: 'Charge',
				hudLabel: 'CHARGE',
				input: 'RMB',
				cooldown: '8s',
				cooldownMs: 8000,
				desc: 'Rush forward in your facing direction for 0.7s. Enemies in your path take 35 damage and are knocked sideways. On completion you get a 3s speed boost. 8s cooldown.'
			},
			{
				name: 'Ground Slam',
				hudLabel: 'SLAM',
				input: 'Space',
				cooldown: '35s',
				cooldownMs: 35000,
				isUltimate: true,
				desc: 'Slam the ground in a full 360° — deals 50 damage to all enemies within 4 units, massive knockback, and dazes them for 2s. Score: +3 per kill, +2 per hit.'
			}
		],
		tips: [
			'Axe Swing hits every enemy in the cone at 0.5s cooldown — spam into packs for constant knockback and daze chains.',
			'Daze from axe swing lasts 1.5s and cooldown is 0.5s — chain swings to keep enemies permanently staggered.',
			'Charge locks your direction at click time — aim before activating. The 3s speed boost after charge lets you reposition.',
			'Ground Slam is 360° with double damage and double knockback — use it when surrounded or opening a boss fight.',
			'Your slow speed means you cannot escape — use Charge to blow through packs and Axe Swing to keep them staggered.'
		]
	},
	healer: {
		stats: {
			id: 'healer',
			name: 'Healer',
			role: 'Support',
			hp: 100,
			stamina: 80,
			walkSpeed: 5.0,
			sprintSpeed: 8.5,
			color: '#f4a',
			icon: 'potion-red'
		},
		abilities: [
			{
				name: 'Chain Heal',
				hudLabel: 'Heal',
				input: 'LMB',
				cooldown: '3s',
				cooldownMs: 3000,
				desc: 'Auto-targets the lowest HP alive teammate within 10 units and heals them for 30 HP. If a second teammate is also in range, they receive a 30% chain heal (9 HP). Score: +5 if target was damaged.'
			},
			{
				name: 'Revive',
				hudLabel: 'Revive',
				input: 'RMB',
				cooldown: '15s after completion',
				cooldownMs: 15000,
				desc: 'Channel for 2s to revive a downed ally within 3 units. While channeling, an 80 HP shield protects you — enemies that melee you are knocked back. If the shield breaks, the revive is interrupted. On success: ally gets 50 HP + 5s speed boost, healer is fully healed. +20 score.'
			},
			{
				name: 'Revitalize',
				hudLabel: 'REVITALIZE',
				input: 'Space',
				cooldown: '35s',
				cooldownMs: 35000,
				isUltimate: true,
				desc: 'Surge healing energy to all alive teammates within 10 units — heals each for 30 HP and grants them a 3s speed boost. Score: +3 per teammate healed.'
			}
		],
		tips: [
			'You passively regen HP: 2 HP/s normally, ramping to 10 HP/s after 5s without taking damage — stay out of melee.',
			'Chain Heal auto-targets the lowest HP teammate — no need to aim. Stay mobile and keep your position between your team.',
			'The chain heal bounces 30% (9 HP) to a second ally in range — position yourself between two players to double the value.',
			'Reviving fully heals you on success — risky channel, huge payoff. The 80 HP shield lets you tank incoming hits while channeling.',
			'Revitalize gives everyone a 3s speed boost — powerful during boss fights or when the team is getting swarmed.'
		]
	}
};

export type SynergyKey = string;

export interface SynergyData {
	label: string;
	desc: string;
	color: string;
}

export const SYNERGIES: Record<SynergyKey, SynergyData> = {
	spotter: {
		label: 'Lone Scout',
		desc: 'Mark targets and flash stun threats solo. Fast, fragile, flying blind on support.',
		color: '#4af'
	},
	gunner: {
		label: 'One-Man Army',
		desc: 'Pure DPS with nobody watching your back. Suppression or die.',
		color: '#f84'
	},
	tank: {
		label: 'One-Man Wall',
		desc: 'Incredible durability, zero intel. Brace and hope for the best.',
		color: '#8a4'
	},
	healer: {
		label: 'Field Medic Alone',
		desc: 'No frontline to heal. Survive on skill alone.',
		color: '#f4a'
	},
	spotterx2: {
		label: 'Twin Eyes',
		desc: 'Double marks, double flash stuns — crowd control everywhere. Zero sustain though.',
		color: '#4af'
	},
	gunnerx2: {
		label: 'Twin Barrels',
		desc: 'Maximum suppression. Enemies barely move. Pray nothing reaches you.',
		color: '#f84'
	},
	tankx2: {
		label: 'Iron Wall',
		desc: 'Nothing gets through. Slam and brace forever — but who marks the kills?',
		color: '#8a4'
	},
	healerx2: {
		label: 'Eternal Life',
		desc: 'You will never die. You will also never do meaningful damage.',
		color: '#f4a'
	},
	'gunner+spotter': {
		label: 'Marked for Death',
		desc: 'Spotter reveals, gunner suppresses. Enemies are tagged before they know you exist.',
		color: '#fa6'
	},
	'spotter+tank': {
		label: 'Scout & Shield',
		desc: 'Intel meets armor. Spotter calls threats, tank absorbs them.',
		color: '#6cf'
	},
	'healer+spotter': {
		label: 'Ghost Protocol',
		desc: 'Eyes and sustain. Spotter scouts ahead, healer keeps the squad breathing.',
		color: '#adf'
	},
	'gunner+tank': {
		label: 'Shock & Awe',
		desc: 'Tank slams to stagger, gunner unloads. Brutal CC chain.',
		color: '#fa4'
	},
	'gunner+healer': {
		label: 'Fire & Life',
		desc: 'Healer keeps the gunner fed. Constant suppression with a safety net.',
		color: '#faf'
	},
	'healer+tank': {
		label: 'Ironclad',
		desc: 'Tank braces, healer patches. Nearly unkillable duo — just missing a trigger finger.',
		color: '#8f8'
	},
	'gunner+spotterx2': {
		label: 'Eagle Eye Overwatch',
		desc: 'Two spotters feed marks to one gunner. Every enemy is a highlighted target.',
		color: '#6df'
	},
	'spotterx2+tank': {
		label: 'Recon Fortress',
		desc: 'Double intel feeding a tanky frontline. Nothing surprises this squad.',
		color: '#6af'
	},
	'gunnerx2+spotter': {
		label: 'Twin Guns, One Eye',
		desc: 'One spotter directs two shooters. Coordinated suppression at range.',
		color: '#fb8'
	},
	'gunnerx2+tank': {
		label: 'Breach & Clear',
		desc: 'Tank smashes in, two gunners finish the job. Aggressive and effective.',
		color: '#fc6'
	},
	'gunnerx2+healer': {
		label: 'Glass with Backbone',
		desc: 'Double DPS sustained by a healer. Explode damage, never stop shooting.',
		color: '#fca'
	},
	'spotter+tankx2': {
		label: 'Armored Recon',
		desc: 'Two tanks with scout support. Spotter marks; tanks absorb everything.',
		color: '#9d6'
	},
	'gunner+tankx2': {
		label: 'Battering Ram',
		desc: 'Two tanks distract and slam, gunner farms suppressed kills.',
		color: '#bd6'
	},
	'healer+tankx2': {
		label: 'Immortal Frontline',
		desc: 'Two tanks and a healer. Nothing dies — including you.',
		color: '#8fc'
	},
	'healerx2+spotter': {
		label: 'Eyes of God',
		desc: 'Double sustain and full map awareness. Survive forever, see everything.',
		color: '#cff'
	},
	'gunner+healerx2': {
		label: 'Pampered DPS',
		desc: 'One gunner with two dedicated healers. Absolute overkill on sustain.',
		color: '#faf'
	},
	'gunner+spotter+tank': {
		label: 'Warband',
		desc: 'Mark, slam, suppress. Three damage vectors with zero safety net.',
		color: '#fa8'
	},
	'gunner+healer+spotter': {
		label: 'Glass Cannon Squad',
		desc: 'Full intel and firepower with a medic. Win fast or die smart.',
		color: '#f86'
	},
	'healer+spotter+tank': {
		label: 'The Phalanx',
		desc: 'Marked threats, tanky frontline, endless heals. Fortress squad.',
		color: '#8fa'
	},
	'gunner+healer+tank': {
		label: 'The Backbone',
		desc: 'Core combat trio. DPS, armor, sustain — the classic survival loadout.',
		color: '#af8'
	},
	'gunnerx2+spotterx2': {
		label: 'Eyes & Firepower',
		desc: 'Maximum recon and DPS. No defense, but enemies are dead before they arrive.',
		color: '#fd8'
	},
	'spotterx2+tankx2': {
		label: 'Armored Overwatch',
		desc: 'Double eyes, double armor. Impenetrable and always aware.',
		color: '#7cf'
	},
	'healerx2+spotterx2': {
		label: 'Support Fortress',
		desc: 'Double intel and infinite sustain. You will outlast everything.',
		color: '#bff'
	},
	'gunnerx2+tankx2': {
		label: 'Steamroller',
		desc: 'Total offense and defense. Slam, suppress, repeat. Nothing survives.',
		color: '#fd6'
	},
	'gunnerx2+healerx2': {
		label: 'Sustained Fire',
		desc: 'Double DPS never stops — two healers make sure of it.',
		color: '#fcf'
	},
	'healerx2+tankx2': {
		label: 'The Bunker',
		desc: 'Survive forever, damage nothing. Best defensive quad possible.',
		color: '#9fc'
	},
	'gunner+spotterx2+tank': {
		label: 'Overwatch Formation',
		desc: 'Two spotters direct tank and gunner. Every move is calculated.',
		color: '#7df'
	},
	'gunner+healer+spotterx2': {
		label: 'Precision Squad',
		desc: 'Intel-heavy strike team. Two eyes guide gun and medic.',
		color: '#aef'
	},
	'healer+spotterx2+tank': {
		label: 'Turtle Watch',
		desc: 'Observe and survive. Double intel with tank+healer anchor.',
		color: '#8df'
	},
	'gunnerx2+spotter+tank': {
		label: 'Suppression Front',
		desc: 'Tank holds the line, two gunners suppress everything behind it.',
		color: '#fc8'
	},
	'gunnerx2+healer+spotter': {
		label: 'Fire Team Alpha',
		desc: 'Spotter + double DPS + medic. Aggressive intel-driven strike force.',
		color: '#fb6'
	},
	'gunnerx2+healer+tank': {
		label: 'Assault Squad',
		desc: 'Heavy DPS with armor and sustain. Balanced but offense-leaning.',
		color: '#fba'
	},
	'gunner+spotter+tankx2': {
		label: 'Shield Wall',
		desc: 'Double tanks absorb chaos while spotter and gunner farm kills behind them.',
		color: '#ad8'
	},
	'healer+spotter+tankx2': {
		label: 'Fortified Recon',
		desc: 'Safe scouting from behind double armor with a healer backup.',
		color: '#9e8'
	},
	'gunner+healer+tankx2': {
		label: 'Siege Mode',
		desc: 'Slow and unstoppable. Two tanks advance, gunner suppresses, healer sustains.',
		color: '#be8'
	},
	'gunner+healerx2+spotter': {
		label: 'Pampered Strike',
		desc: 'One gunner with double heals and full intel. Basically unkillable DPS.',
		color: '#fce'
	},
	'healerx2+spotter+tank': {
		label: 'Immortal Phalanx',
		desc: 'Sustained recon frontline. Tank never dies, spotter never misses.',
		color: '#afa'
	},
	'gunner+healerx2+tank': {
		label: 'Full Combat Support',
		desc: 'Balanced with maximum sustain. Classic roles, double the healing.',
		color: '#bfa'
	},
	'gunner+healer+spotter+tank': {
		label: 'Full Squad',
		desc: 'Perfect synergy. Every role covered — textbook survival.',
		color: '#ff8'
	}
};

export interface GameTip {
	tag: string;
	color: string;
	text: string;
}

export const TIPS: GameTip[] = [
	{
		tag: 'Tip',
		color: '#adf',
		text: 'Stamina regenerates faster after standing still briefly. Walking is always free.'
	},
	{
		tag: 'Tip',
		color: '#adf',
		text: 'Enemies spawn around a random alive player — you always have a moment to react.'
	},
	{
		tag: 'Tip',
		color: '#adf',
		text: 'Each day cycle is 5 minutes (5 phases × 1 minute each). Survive full cycles to score big.'
	},
	{
		tag: 'Tip',
		color: '#adf',
		text: 'Spawn rate accelerates every cycle — starts at one enemy every 6s, floors at 1.5s.'
	},
	{
		tag: 'Tip',
		color: '#adf',
		text: 'Enemies get +8 HP per cycle completed, capped at 3× their base health.'
	},
	{
		tag: 'Tip',
		color: '#adf',
		text: 'Every enemy gets faster the longer it stays alive — up to +50% speed over time. Kill fast.'
	},
	{
		tag: 'Tip',
		color: '#adf',
		text: 'Up to 36 enemies can be alive at once (4-player game). Clearing the field reduces spawn pressure.'
	},
	{
		tag: 'Tip',
		color: '#adf',
		text: 'If you go down, wait for a Revive — or hold on until the phase ends. All downed players are revived with 50 HP at the end of each phase.'
	},
	{
		tag: 'Tip',
		color: '#adf',
		text: 'Enemies loosely spread targets — each player gets at most 3 enemies fixated on them.'
	},
	{
		tag: 'Tip',
		color: '#adf',
		text: 'All 4 classes have an Ultimate (Space) with a 35s cooldown. Use them to turn the tide — not just for cleanup.'
	},
	{
		tag: 'Item Drop',
		color: '#ff4444',
		text: 'Red orbs restore 40 HP. Grab them before they expire — they vanish after 20 seconds.'
	},
	{
		tag: 'Item Drop',
		color: '#44ff88',
		text: 'Green orbs fully restore your Stamina. Essential for Spotter and Tank who burn through it fast.'
	},
	{
		tag: 'Item Drop',
		color: '#ff8800',
		text: 'Orange orbs grant Double Damage for 8 seconds. Time an Ultimate or ability burst while active.'
	},
	{
		tag: 'Item Drop',
		color: '#44aaff',
		text: 'Blue orbs grant Double Speed for 8 seconds. Great for repositioning or escaping a tight spot.'
	},
	{
		tag: 'Item Drop',
		color: '#dda',
		text: 'Bosses always drop 3 items on death: an HP orb, Double Damage, and Double Speed — guaranteed.'
	},
	{
		tag: 'Day Cycle',
		color: '#fa8',
		text: 'Sunset → Dusk → Twilight → Night → Deep Night, then loops. Each phase is 60 seconds.'
	},
	{
		tag: 'Day Cycle',
		color: '#fa8',
		text: 'Night and Deep Night bring storms, lightning, and faster, harder enemies. Brace up.'
	},
	{
		tag: 'Day Cycle',
		color: '#fa8',
		text: 'Fog rolls in during Sunset or Dusk — once per cycle, lasting 15–30 seconds. Visibility drops sharply.'
	},
	{
		tag: 'Day Cycle',
		color: '#fa8',
		text: 'At the end of every phase, all downed players are revived with 50 HP and a brief speed boost. Hold on.'
	},
	{
		tag: 'Day Cycle',
		color: '#fa8',
		text: 'Surviving to the next Sunset completes a cycle and increases enemy difficulty.'
	},
	{
		tag: 'Enemy: Basic',
		color: '#f88',
		text: '57% of spawns. Slow and direct. Easy to kite but threatening in large packs.'
	},
	{
		tag: 'Enemy: Fast',
		color: '#f88',
		text: '24% of spawns. Low HP (75) but closes gaps instantly at 5.2 units/s. Shoot on sight.'
	},
	{
		tag: 'Enemy: Brute',
		color: '#f88',
		text: '10% of spawns. 380 HP base — the tankiest regular enemy. Slam it, suppress it, then pile on.'
	},
	{
		tag: 'Enemy: Spitter',
		color: '#f88',
		text: '5% of spawns. Hangs back at 12-unit range and lobs acid pools. Move out of the green.'
	},
	{
		tag: 'Enemy: Caster',
		color: '#f88',
		text: '4% of spawns. Fires a beam from 8 units and strafes unpredictably. Suppress it first.'
	},
	...Object.values(CLASSES).flatMap((c) =>
		c.tips.map((tip) => ({
			tag: c.stats.name,
			color: c.stats.color,
			text: tip
		}))
	)
];

export const CLASS_LIST = ['spotter', 'gunner', 'tank', 'healer'] as const;

// ─── Boss Data ────────────────────────────────────────────────────────────────

export type BossId = 'ghost_dragon' | 'worm_monster' | 'rabid_dog' | 'scp_096' | 'terror_reaper';

export interface BossAbility {
	name: string;
	cooldown: string;
	desc: string;
}

export interface BossData {
	id: BossId;
	name: string;
	hp: number;
	/** world units/s (server value ÷ 1000) */
	speed: number;
	/** base melee damage per hit (0.5s cooldown); ×1.5 when enraged */
	meleeDamage: number;
	/** HP threshold for enrage (20% of max HP) */
	enrageHp: number;
	color: string;
	threat: 'low' | 'medium' | 'high' | 'extreme';
	abilities: [BossAbility, BossAbility];
	tips: string[];
}

export const BOSSES: Record<BossId, BossData> = {
	ghost_dragon: {
		id: 'ghost_dragon',
		name: 'Ghost Dragon',
		hp: 2500,
		speed: 4.8,
		meleeDamage: 12,
		enrageHp: 500,
		color: '#8af',
		threat: 'high',
		abilities: [
			{
				name: 'Hide & Seek',
				cooldown: '20s',
				desc: 'Turns invisible for 3s and charges the furthest player at 2× speed. Hard to track — watch for movement on the ground.'
			},
			{
				name: 'Ice Ball',
				cooldown: '10s',
				desc: 'Freezes up to 2 players in place for 1s. Stay spread out so not everyone gets hit simultaneously.'
			}
		],
		tips: [
			'When invisible it targets the FURTHEST player — cluster together to draw it in and counter-ambush.',
			'Ice Ball only stuns 2 players — if you\'re frozen, teammates can still reposition and attack.',
			'Enrages at 500 HP: melee climbs to 18/hit and it moves faster. Burst it down from range.',
			'Spotter Flash or Gunner suppress can daze it mid-hide — best time to DPS dump.'
		]
	},
	worm_monster: {
		id: 'worm_monster',
		name: 'Worm Monster',
		hp: 3500,
		speed: 3.5,
		meleeDamage: 9,
		enrageHp: 700,
		color: '#a84',
		threat: 'extreme',
		abilities: [
			{
				name: 'Chain Charge',
				cooldown: '12s',
				desc: 'Deals damage to ALL players within 20 units simultaneously. Spread out — don\'t cluster.'
			},
			{
				name: 'Burrow',
				cooldown: '20s',
				desc: 'Goes underground for 2.5s and teleports to a random position 20–40 units from center. Watch your minimap.'
			}
		],
		tips: [
			'Highest HP of all bosses at 3500 — prioritize it when it spawns, don\'t ignore it.',
			'Chain Charge hits everyone in 20 units — always stay spread: 3+ units apart.',
			'After Burrow it appears in the outer ring — hold position and wait for it to come back.',
			'Slow speed (3.5 u/s) makes it easy to kite — Spotter and Gunner shine here.'
		]
	},
	rabid_dog: {
		id: 'rabid_dog',
		name: 'Rabid Dog',
		hp: 1500,
		speed: 7.0,
		meleeDamage: 8,
		enrageHp: 300,
		color: '#f64',
		threat: 'high',
		abilities: [
			{
				name: 'Leap',
				cooldown: '7s',
				desc: 'Instantly teleports behind the closest player. No warning — always watch your back.'
			},
			{
				name: 'Stun Attack',
				cooldown: '12s',
				desc: 'Stuns a player for 2s and deals 16 damage. Only activates within 8 units — keep distance.'
			}
		],
		tips: [
			'Fastest boss at 7 u/s — you cannot outrun it. Use stuns and knockback to create space.',
			'Leap puts it directly behind you — spin after it leaps and counter-attack.',
			'Lowest HP at 1500 — focus fire immediately, especially if the healer is busy.',
			'Stun Attack needs 8 unit range — Tank charge or Spotter Flash can interrupt the approach.'
		]
	},
	scp_096: {
		id: 'scp_096',
		name: 'SCP-096',
		hp: 2000,
		speed: 5.0,
		meleeDamage: 6,
		enrageHp: 400,
		color: '#ddd',
		threat: 'medium',
		abilities: [
			{
				name: 'AoE Slam',
				cooldown: '14s',
				desc: 'Knocks back ALL players within 15 units and slows them by 55% for 3s. Stay outside 15 units or you\'ll be scattered.'
			},
			{
				name: 'Charge',
				cooldown: '9s',
				desc: 'Dashes toward a random player at 2× speed. Target changes every 8s — don\'t assume it\'s always chasing you.'
			}
		],
		tips: [
			'Lowest base damage (6/hit) but Charge makes it unpredictable — always track its current target.',
			'AoE Slam can scatter the whole team — position near the edge of its 15-unit range to dodge.',
			'It changes charge targets every 8s — communicate who it\'s chasing so teammates can draw it away.',
			'Healer should stay outside 15 units to avoid Slam — you can\'t heal if you\'re knocked away.'
		]
	},
	terror_reaper: {
		id: 'terror_reaper',
		name: 'Terror Reaper',
		hp: 2200,
		speed: 3.8,
		meleeDamage: 11,
		enrageHp: 440,
		color: '#a06fff',
		threat: 'extreme',
		abilities: [
			{
				name: 'Soul Drain',
				cooldown: '10s',
				desc: 'Drains life from ALL players within 14 units — heals itself for 40% of damage dealt. Don\'t cluster near it or it becomes unkillable.'
			},
			{
				name: 'Death Blink',
				cooldown: '15s',
				desc: 'Teleports instantly to the closest player, deals 2× melee damage, and stuns them for 2s. It always targets the nearest — spread out.'
			}
		],
		tips: [
			'Soul Drain heals it — if multiple players are in range it can fully recover. Stay beyond 14 units.',
			'Death Blink always targets the closest player — rotate who\'s nearest so no one gets repeatedly stunned.',
			'High melee damage (11/hit, 16.5 when enraged) — Tank should be the primary target absorber.',
			'Enrages at 440 HP: melee jumps to 16.5/hit. Burst it down fast when it\'s below half HP.'
		]
	}
};

export const BOSS_LIST: BossId[] = ['ghost_dragon', 'worm_monster', 'rabid_dog', 'scp_096', 'terror_reaper'];

export function getActiveSynergy(classCounts: Record<string, number>): SynergyData | null {
	const key = Object.entries(classCounts)
		.filter(([, n]) => n > 0)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([cls, n]) => (n >= 2 ? `${cls}x2` : cls))
		.join('+');
	return SYNERGIES[key] ?? null;
}
