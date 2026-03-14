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
	input: string;
	cooldown: string;
	desc: string;
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
			stamina: 450,
			walkSpeed: 5.0,
			sprintSpeed: 9.0,
			color: '#4af',
			icon: 'sword'
		},
		abilities: [
			{
				name: 'Mark Enemy',
				input: 'LMB',
				cooldown: '2s',
				desc: 'Tag an enemy within 15 units. Marked targets take bonus damage and are visible through walls. Lasts 5s. +10 score on new marks.'
			},
			{
				name: 'Flash Stun',
				input: 'RMB',
				cooldown: '1.5s',
				desc: 'Fire a 90° stun cone up to 5 units. Enemies caught are dazed for 2s. +10 score per stunned enemy.'
			}
		],
		tips: [
			'Marked enemies take bonus damage from all sources — always mark before the gunner shoots.',
			'Flash stun has a 90° cone — use it to buy time for teammates when overwhelmed.',
			'Your high stamina and speed make you the best scout — stay mobile and keep marking.',
			'Re-mark enemies before the mark expires to maintain damage bonus.'
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
				input: 'LMB',
				cooldown: 'None',
				desc: 'Fire at enemies within 10 units. Deals 15 damage per shot. Every 3rd consecutive shot on the same target suppresses (dazes for 1s).'
			},
			{
				name: 'Adrenaline',
				input: 'RMB',
				cooldown: '5s',
				desc: 'Instantly restore all stamina. Essential for maintaining suppression chains or escapingdanger.'
			}
		],
		tips: [
			'Every 3rd shot suppresses (dazes) the target. Chain bursts to keep Brutes permanently staggered.',
			'Adrenaline is essential when you need to sprint or maintain fire — time it before engagements.',
			'You have low stamina — use Adrenaline strategically, not on cooldown.',
			'Suppressed enemies deal no damage. Prioritize high-threat targets like Brutes and Casters.'
		]
	},
	tank: {
		stats: {
			id: 'tank',
			name: 'Tank',
			role: 'Frontline',
			hp: 150,
			stamina: 200,
			walkSpeed: 2.5,
			sprintSpeed: 3.5,
			color: '#8a4',
			icon: 'shield'
		},
		abilities: [
			{
				name: 'Shield Bash',
				input: 'LMB',
				cooldown: '1.5s',
				desc: 'Bash enemies within 5 units. Knocks them back and dazes for 1.5s. +5 score per bash.'
			},
			{
				name: 'Brace',
				input: 'RMB (hold)',
				cooldown: '1s after release',
				desc: 'Enter a defensive stance. Enemies hitting you are knocked back instead of dealing damage. Lasts up to 5s. Auto-releases at max duration.'
			}
		],
		tips: [
			'Shield Bash has a 1.5s cooldown. Use it to knock enemies off downed teammates.',
			'Bracing significantly reduces incoming damage. Hold RMB when a Brute or beam is incoming.',
			'Your slow speed means you cannot escape — brace and absorb damage instead.',
			'Bash enemies out of melee range of teammates to protect them.'
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
				name: 'Heal',
				input: 'LMB',
				cooldown: '2s',
				desc: 'Heal an ally within 10 units for 30 HP. You also heal yourself for 8 HP. +5 score if target was damaged.'
			},
			{
				name: 'Revive',
				input: 'RMB',
				cooldown: '15s after completion',
				desc: 'Channel for 2s to revive a downed ally within 3 units. Revived player gets 50 HP and a 5s speed boost. +20 score. Interrupted on damage.'
			}
		],
		tips: [
			'Reviving a downed ally gives them a speed boost — use it to pull them out of a pile.',
			'Taking damage while channeling a revive interrupts it. Tank should cover the heal.',
			'You deal 35 damage per shot — use it to finish low-HP enemies between heals.',
			'Prioritize keeping the Tank alive — they absorb the most damage.'
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
		desc: 'Nothing gets through. Bash and brace forever — but who marks the kills?',
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
		desc: 'Tank bashes to stagger, gunner unloads. Brutal CC chain.',
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
		desc: 'Two tanks distract and bash, gunner farms suppressed kills.',
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
		desc: 'Mark, bash, suppress. Three damage vectors with zero safety net.',
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
		desc: 'Total offense and defense. Bash, suppress, repeat. Nothing survives.',
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
		text: 'Enemies spawn 35 units around a random alive player — you always have a moment to react.'
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
		text: 'Enemies get +5 HP per cycle completed, capped at 3× their base health.'
	},
	{
		tag: 'Tip',
		color: '#adf',
		text: 'Every enemy gets faster the longer it stays alive — up to +50% speed over time. Kill fast.'
	},
	{
		tag: 'Tip',
		color: '#adf',
		text: 'Up to 26 enemies can be alive at once. Clearing the field briefly reduces spawn pressure.'
	},
	{
		tag: 'Tip',
		color: '#adf',
		text: 'If you go down, wait for a teammate to revive you. If all players are downed at once, the game ends.'
	},
	{
		tag: 'Tip',
		color: '#adf',
		text: 'Enemies loosely spread targets — each player gets at most 3 enemies fixated on them.'
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
		text: 'Surviving to the next Sunset completes a cycle and increases your squad score multiplier.'
	},
	{
		tag: 'Enemy: Basic',
		color: '#f88',
		text: '57% of spawns. Slow and direct. Easy to kite but threatening in large packs.'
	},
	{
		tag: 'Enemy: Fast',
		color: '#f88',
		text: '24% of spawns. Low HP (50) but closes gaps instantly at 5.2 units/s. Shoot on sight.'
	},
	{
		tag: 'Enemy: Brute',
		color: '#f88',
		text: '10% of spawns. 250 HP base — the tankiest enemy. Bash it, slow it, then pile on.'
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
	{
		tag: 'Boss',
		color: '#f44',
		text: 'Spawns every 90 seconds if no boss is alive. 1500 HP, 0.6 units/s. Kills all other enemies on spawn. Drops massive score.'
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

export function getActiveSynergy(classCounts: Record<string, number>): SynergyData | null {
	const key = Object.entries(classCounts)
		.filter(([, n]) => n > 0)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([cls, n]) => (n >= 2 ? `${cls}x2` : cls))
		.join('+');
	return SYNERGIES[key] ?? null;
}
