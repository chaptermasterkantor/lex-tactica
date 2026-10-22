import type { KeywordDefinition } from '../types/rules';

/**
 * Comprehensive 11th Edition Keyword, Weapon Ability, and Core Rule Glossary.
 * Supports exact matches and dynamic parameterized rules (e.g. "SUSTAINED HITS 1", "ANTI-VEHICLE 4+", "FEEL NO PAIN 5+").
 */
export const KEYWORD_GLOSSARY: KeywordDefinition[] = [
  // =========================================================================
  // WEAPON ABILITIES ([...])
  // =========================================================================
  {
    keyword: 'CLOSE-QUARTERS',
    category: 'weapon',
    name: 'Close-Quarters',
    summary: 'Can be selected to shoot even if the bearer’s unit is Engaged (replaces 10th Ed Pistol for point-blank shooting).',
    description:
      'Weapons with [CLOSE-QUARTERS] in their profile are designed for point-blank firefights. When a unit is Engaged in combat, models in that unit can select [CLOSE-QUARTERS] weapons to shoot at enemy units they are engaged with in the Shooting phase (without the -1 Hit roll penalty suffered by non-[CLOSE-QUARTERS] weapons on Monsters and Vehicles).',
  },
  {
    keyword: 'ASSAULT',
    category: 'weapon',
    name: 'Assault',
    summary: 'Can be shot even if the bearer’s unit Advanced.',
    description:
      'Weapons with [ASSAULT] in their profile are known as Assault weapons. If a unit that Advanced this turn contains any models equipped with Assault weapons, it is still eligible to shoot in this turn’s Shooting phase (including via the 11th Edition Snap Shooting core action), but when it does, models in that unit can only make attacks with Assault weapons they are equipped with.',
  },
  {
    keyword: 'HEAVY',
    category: 'weapon',
    name: 'Heavy',
    summary: '+1 to Hit rolls if the bearer’s unit Remained Stationary or moved 3" or less.',
    description:
      'Weapons with [HEAVY] in their profile are known as Heavy weapons. In 11th Edition, each time an attack is made with such a weapon, if the attacking model’s unit Remained Stationary or made a move of 3" or less (e.g. pivoting / bracing) this turn, add 1 to the Hit roll.',
  },
  {
    keyword: 'RAPID FIRE',
    category: 'weapon',
    name: 'Rapid Fire X',
    summary: 'Increase the Attacks characteristic by X when targeting units within half range.',
    description:
      'Weapons with [RAPID FIRE X] in their profile are known as Rapid Fire weapons. Each time such a weapon targets a unit within half of the weapon’s maximum range, the Attacks characteristic of that weapon is increased by X.',
    hasParameter: true,
  },
  {
    keyword: 'PISTOL',
    category: 'weapon',
    name: 'Pistol',
    summary: 'Can be shot while within Engagement Range of enemy units (must target that enemy unit).',
    description:
      'Weapons with [PISTOL] in their profile are known as Pistols. If a unit is within Engagement Range of one or more enemy units, it is eligible to shoot in its controlling player’s Shooting phase using Pistols, targeting one of those enemy units. A model cannot shoot both Pistols and non-Pistol ranged weapons in the same phase (unless it is a Monster or Vehicle).',
  },
  {
    keyword: 'TORRENT',
    category: 'weapon',
    name: 'Torrent',
    summary: 'Attacks automatically hit the target (no Hit roll required).',
    description:
      'Weapons with [TORRENT] in their profile are known as Torrent weapons. Each time an attack is made with such a weapon, that attack automatically hits the target (including during Fire Overwatch).',
  },
  {
    keyword: 'LETHAL HITS',
    category: 'weapon',
    name: 'Lethal Hits',
    summary: 'Critical Hits (unmodified Hit roll of 6) automatically wound the target.',
    description:
      'Weapons with [LETHAL HITS] in their profile are known as Lethal Hits weapons. Each time an attack is made with such a weapon, a Critical Hit automatically wounds the target (do not make a Wound roll). Note: some 11th Edition profiles feature conditional Lethal Hits (e.g. [LETHAL HITS: non-MONSTER/VEHICLE]).',
  },
  {
    keyword: 'SUSTAINED HITS',
    category: 'weapon',
    name: 'Sustained Hits X',
    summary: 'Critical Hits (unmodified Hit roll of 6) score X additional hits.',
    description:
      'Weapons with [SUSTAINED HITS X] in their profile cause X additional hits on the target each time an attack scores a Critical Hit.',
    hasParameter: true,
  },
  {
    keyword: 'DEVASTATING WOUNDS',
    category: 'weapon',
    name: 'Devastating Wounds',
    summary: 'Critical Wounds inflict mortal wounds or bypass armor/invulnerable saves.',
    description:
      'Each time an attack is made with a [DEVASTATING WOUNDS] weapon, if that attack scores a Critical Wound, no saving throw of any kind can be made against that attack (including invulnerable saves). The damage is applied directly to the target unit (Feel No Pain rolls can still be made).',
  },
  {
    keyword: 'TWIN-LINKED',
    category: 'weapon',
    name: 'Twin-linked',
    summary: 'You can re-roll the Wound roll for attacks made with this weapon.',
    description:
      'Weapons with [TWIN-LINKED] in their profile allow you to re-roll the Wound roll each time an attack is made with that weapon.',
  },
  {
    keyword: 'BLAST',
    category: 'weapon',
    name: 'Blast X',
    summary: '+X Attacks per 5 models in the target unit. Cannot target units in Engagement Range of friendly units.',
    description:
      'In 11th Edition, weapons with [BLAST X] (or standard [BLAST]) add X Attacks (defaulting to 1) for every 5 models in the target unit (rounding down). Blast weapons can never be used to make attacks against a unit that is within Engagement Range of one or more units from the attacking model’s army.',
    hasParameter: true,
  },
  {
    keyword: 'CLEAVE',
    category: 'weapon',
    name: 'Cleave X',
    summary: '11th Edition melee ability: on critical wound or hit, improves AP or deals extra sweeping damage.',
    description:
      'Weapons with [CLEAVE X] are specialized 11th Edition close-combat weapons (such as Choppas, Power Klaws, and heavy blades) designed to hack through multiple combatants or slice through heavy armor.',
    hasParameter: true,
  },
  {
    keyword: 'CONVERSION',
    category: 'weapon',
    name: 'Conversion',
    summary: 'Long-range critical hits: attacks targeting units beyond 12" (or 24") score Critical Hits on unmodified 4+.',
    description:
      'Weapons with [CONVERSION] focus matter-disrupting beams. Each time an attack is made with this weapon targeting a unit beyond its minimum bracket (typically more than 12" or 24" away), an unmodified successful Hit roll of 4+ scores a Critical Hit.',
  },
  {
    keyword: 'MELTA',
    category: 'weapon',
    name: 'Melta X',
    summary: 'Increase the Damage characteristic by X when targeting units within half range.',
    description:
      'Each time an attack made with a [MELTA X] weapon targets a unit within half of that weapon’s range, the Damage characteristic of that attack is increased by X.',
    hasParameter: true,
  },
  {
    keyword: 'HAZARDOUS',
    category: 'weapon',
    name: 'Hazardous',
    summary: 'After shooting or fighting, roll 1D6 per Hazardous weapon used; on a 1, suffer 3 mortal wounds (or destroy 1 non-Character/Vehicle/Monster model).',
    description:
      'After a unit shoots or fights, roll one Hazardous test (1D6) for each [HAZARDOUS] weapon used. For each roll of 1, one model equipped with a Hazardous weapon is destroyed (Characters, Monsters, and Vehicles suffer 3 mortal wounds instead).',
  },
  {
    keyword: 'PRECISION',
    category: 'weapon',
    name: 'Precision',
    summary: 'When targeting an Attached unit, the attacking player can allocate successful wounds directly to a visible attached Character model.',
    description:
      'Each time an attack made with a [PRECISION] weapon successfully wounds an Attached unit, if a Character model in that unit is visible to the attacking model, the attacking player can choose to have that attack allocated to that Character model instead of following the normal attack allocation sequence.',
  },
  {
    keyword: 'INDIRECT FIRE',
    category: 'weapon',
    name: 'Indirect Fire',
    summary: 'Can target units that are not visible to the bearer (unmodified 1-3 to Hit fails; target gains Benefit of Cover if not visible).',
    description:
      'Weapons with [INDIRECT FIRE] can target and make attacks against units that are not visible to the attacking unit. If no models in a target unit are visible when selected, subtract 1 from the Hit roll, unmodified Hit rolls of 1–3 always fail, and the target has the Benefit of Cover against those attacks.',
  },
  {
    keyword: 'IGNORES COVER',
    category: 'weapon',
    name: 'Ignores Cover',
    summary: 'Target cannot have the Benefit of Cover against attacks made with this weapon.',
    description:
      'Each time an attack is made with an [IGNORES COVER] weapon, the target cannot have the Benefit of Cover against that attack.',
  },
  {
    keyword: 'LANCE',
    category: 'weapon',
    name: 'Lance',
    summary: '+1 to Wound rolls if the bearer made a Charge move this turn.',
    description:
      'Each time an attack is made with a [LANCE] weapon, if the bearer’s unit made a Charge move this turn, add 1 to that attack’s Wound roll.',
  },
  {
    keyword: 'EXTRA ATTACKS',
    category: 'weapon',
    name: 'Extra Attacks',
    summary: 'Bearer can attack with this melee weapon in addition to its primary melee weapon.',
    description:
      'Each time the bearer of an [EXTRA ATTACKS] weapon fights, it can make attacks with that weapon in addition to the one melee weapon it selects to fight with. The number of attacks made with an Extra Attacks weapon cannot be modified by other rules.',
  },
  {
    keyword: 'ONE SHOT',
    category: 'weapon',
    name: 'One Shot',
    summary: 'The bearer can only shoot with this weapon once per battle.',
    description:
      'The bearer can only shoot with a [ONE SHOT] weapon once per battle. Use the One Shot checkbox on the unit card to track when it has been fired.',
  },
  {
    keyword: 'ANTI-',
    category: 'weapon',
    name: 'Anti-Keyword X+',
    summary: 'An unmodified Wound roll of X+ against a target with the matching keyword scores a Critical Wound.',
    description:
      'Each time an attack is made with an [ANTI-KEYWORD X+] weapon against a target with the matching keyword, an unmodified Wound roll of X+ scores a Critical Wound (which always wounds, and triggers Devastating Wounds if also present).',
    hasParameter: true,
  },
  {
    keyword: 'PSYCHIC',
    category: 'weapon',
    name: 'Psychic',
    summary: 'Attacks and abilities tagged with Psychic are Psychic Attacks (triggers Feel No Pain vs Psychic).',
    description:
      'Any weapon or ability with the [PSYCHIC] tag counts as a Psychic Attack. Wounds inflicted by Psychic Attacks can be resisted by rules that grant Feel No Pain against Psychic Attacks.',
  },
  {
    keyword: 'PIERCING',
    category: 'weapon',
    name: 'Piercing',
    summary: '11th Edition weapon rule improving Armor Penetration on critical rolls or specific conditions.',
    description:
      'Weapons with [PIERCING] improve the Armour Penetration (AP) characteristic of their attacks according to their profile parameter.',
    hasParameter: true,
  },

  // =========================================================================
  // CORE ABILITIES
  // =========================================================================
  {
    keyword: 'DEEP STRIKE',
    category: 'core_rule',
    name: 'Deep Strike',
    summary: 'Can be set up in Reserves and arrive in the Reinforcements step of your Movement phase (>9" from enemies).',
    description:
      'During the Declare Battle Formations step, if every model in a unit has this ability, you can set it up in Reserves instead of on the battlefield. In the Reinforcements step of your Movement phase (Battle Round 2+), set it up anywhere on the battlefield more than 9" horizontally away from all enemy models.',
  },
  {
    keyword: 'SCOUTS',
    category: 'core_rule',
    name: 'Scouts X"',
    summary: 'Before the first turn begins, can make a Normal move of up to X" (must end >9" from enemy models).',
    description:
      'If every model in a unit has this ability, at the start of the first battle round, before the first turn begins, it can make a Normal move of up to X" as if it were your Movement phase (including Dedicated Transports they are embarked within). Must end more than 9" horizontally from all enemy models.',
    hasParameter: true,
  },
  {
    keyword: 'INFILTRATORS',
    category: 'core_rule',
    name: 'Infiltrators',
    summary: 'During deployment, can be set up anywhere on the battlefield >9" from the enemy deployment zone and enemy models.',
    description:
      'During deployment, if every model in a unit has this ability, when you set it up, it can be set up anywhere on the battlefield that is more than 9" horizontally away from the enemy deployment zone and all enemy models.',
  },
  {
    keyword: 'FEEL NO PAIN',
    category: 'core_rule',
    name: 'Feel No Pain X+',
    summary: 'Each time a model in this unit would lose a wound, roll 1D6; on X+, that wound is not lost.',
    description:
      'Each time a model with Feel No Pain X+ would lose a wound (including from mortal wounds or Devastating Wounds), roll one D6: if the result equals or exceeds X+, that wound is not lost.',
    hasParameter: true,
  },
  {
    keyword: 'FIGHTS FIRST',
    category: 'core_rule',
    name: 'Fights First',
    summary: 'Fights in the Fights First step of the Fight phase (before Remaining Combats).',
    description:
      'Units with this ability that are eligible to fight do so in the Fights First step of the Fight phase, alternating activations starting with the player whose turn is not taking place.',
  },
  {
    keyword: 'LONE OPERATIVE',
    category: 'core_rule',
    name: 'Lone Operative',
    summary: 'Unless part of an Attached unit, cannot be targeted by ranged attacks from more than 12" away.',
    description:
      'Unless part of an Attached unit, this unit can only be selected as the target of a ranged attack if the attacking model is within 12".',
  },
  {
    keyword: 'STEALTH',
    category: 'core_rule',
    name: 'Stealth',
    summary: 'Subtract 1 from the Hit roll for ranged attacks targeting this unit.',
    description:
      'If every model in a unit has this ability, each time a ranged attack is made against it, subtract 1 from that attack’s Hit roll.',
  },
  {
    keyword: 'DEADLY DEMISE',
    category: 'core_rule',
    name: 'Deadly Demise X',
    summary: 'When destroyed, roll 1D6; on a 6, each unit within 6" suffers X mortal wounds.',
    description:
      'When this model is destroyed, roll one D6 before removing it from play. On a 6, each unit within 6" suffers X mortal wounds.',
    hasParameter: true,
  },
  {
    keyword: 'LEADER',
    category: 'core_rule',
    name: 'Leader',
    summary: 'Can be attached to an eligible Bodyguard unit during the Declare Battle Formations step.',
    description:
      'In 11th Edition, a Bodyguard unit can have at most 1 Regular Leader and 1 Support Character (`is_support`) attached to it during Pre-game setup. While leading a unit, they form a single Attached unit for all rules except when destroyed.',
  },
  {
    keyword: 'FIRING DECK',
    category: 'core_rule',
    name: 'Firing Deck X',
    summary: 'Up to X embarked models can have 1 ranged weapon selected for the Transport to shoot with.',
    description:
      'Each time this Transport shoots in the Shooting phase, you can select one ranged weapon from up to X models embarked within it; the Transport counts as being equipped with those weapons in addition to its own.',
    hasParameter: true,
  },
  {
    keyword: 'HOVER',
    category: 'core_rule',
    name: 'Hover',
    summary: 'Aircraft can declare Hover mode in Pre-game: loses Aircraft, Move becomes 20", starts on battlefield.',
    description:
      'During Declare Battle Formations, you can declare this Aircraft is in Hover mode: its Move characteristic becomes 20", it loses the Aircraft keyword and all Aircraft rules, and it can be deployed on the battlefield in Round 1.',
  },
  {
    keyword: 'DAMAGED:',
    category: 'core_rule',
    name: 'Damaged Bracket',
    summary: 'While this Vehicle or Monster is at or below its wound threshold, subtract 1 from its Hit rolls.',
    description:
      'Many large Vehicles and Monsters suffer a Damaged penalty (typically -1 to Hit rolls, and sometimes reduced Objective Control) once their remaining Wounds fall into their Damaged bracket.',
    hasParameter: true,
  },

  // =========================================================================
  // UNIT & FACTION KEYWORDS
  // =========================================================================
  {
    keyword: 'INFANTRY',
    category: 'unit',
    name: 'Infantry',
    summary: 'Can move freely through Ruins walls, embark in standard Transports, and perform Infantry actions.',
    description:
      'Infantry models can move through Ruins terrain features (walls, floors, and windows) without penalty, gain the Benefit of Cover easily, and are affected by Anti-Infantry weapons.',
  },
  {
    keyword: 'CHARACTER',
    category: 'unit',
    name: 'Character',
    summary: 'Heroic commander or specialist; eligible for Enhancements, Heroic Intervention, and vulnerable to [PRECISION].',
    description:
      'Character units can be given Detachment Enhancements (max 1 per Character, up to 3 per army). When attached to a Bodyguard unit, enemy attacks with [PRECISION] can allocate wounds directly to visible Character models.',
  },
  {
    keyword: 'EPIC HERO',
    category: 'unit',
    name: 'Epic Hero',
    summary: 'Named legendary character: max 1 of each Epic Hero per army; cannot be given Enhancements.',
    description:
      'Your army cannot include the same Epic Hero more than once, and Epic Hero models cannot be given any Enhancements.',
  },
  {
    keyword: 'BATTLELINE',
    category: 'unit',
    name: 'Battleline',
    summary: 'Core troops choice: you can include up to 6 copies of each Battleline datasheet in your army.',
    description:
      'Unlike standard datasheets (limited to 3 copies), an army can include up to 6 units of each Battleline datasheet (and up to 6 Dedicated Transports). Often receives special mission bonuses.',
  },
  {
    keyword: 'DEDICATED TRANSPORT',
    category: 'unit',
    name: 'Dedicated Transport',
    summary: 'Must start the battle with at least one friendly unit embarked within it, or it counts as destroyed.',
    description:
      'You can include up to 6 Dedicated Transports of the same datasheet. Every Dedicated Transport must start the battle with at least one unit embarked within it, or it is destroyed at the start of the first battle round.',
  },
  {
    keyword: 'VEHICLE',
    category: 'unit',
    name: 'Vehicle',
    summary: 'Can shoot into and out of Engagement Range (Big Guns Never Tire, -1 to Hit) and use Tank Shock.',
    description:
      'Vehicles are eligible to shoot in their Shooting phase even while within Engagement Range of enemy units (and enemy units can shoot at Vehicles that are in Engagement Range) with a -1 Hit penalty via Big Guns Never Tire. Cannot move through Ruins walls unless Titanic/specific rules apply.',
  },
  {
    keyword: 'MONSTER',
    category: 'unit',
    name: 'Monster',
    summary: 'Can shoot into and out of Engagement Range (Big Guns Never Tire, -1 to Hit).',
    description:
      'Monsters are eligible to shoot in their Shooting phase even while within Engagement Range of enemy units (and enemy units can shoot at Monsters that are in Engagement Range) with a -1 Hit penalty via Big Guns Never Tire.',
  },
  {
    keyword: 'MOUNTED',
    category: 'unit',
    name: 'Mounted',
    summary: 'Fast cavalry/bikers: moves around Ruins walls; interacts with Anti-Mounted rules.',
    description:
      'Mounted units represent bikers and cavalry. Unlike Infantry, they cannot move straight through solid Ruins walls, but often boast high Movement and Lance/Charge synergies.',
  },
  {
    keyword: 'BEAST',
    category: 'unit',
    name: 'Beast',
    summary: 'Fast creatures that can move through Ruins walls just like Infantry.',
    description:
      'Beast models can move through Ruins walls and floors freely just like Infantry.',
  },
  {
    keyword: 'SWARM',
    category: 'unit',
    name: 'Swarm',
    summary: 'Small creatures that can move through Ruins walls; typically OC 0 and cannot hold objectives alone.',
    description:
      'Swarm models can move through Ruins terrain freely like Infantry, though they usually have an Objective Control (OC) characteristic of 0.',
  },
  {
    keyword: 'FLY',
    category: 'unit',
    name: 'Fly',
    summary: 'Can move over enemy models and terrain (measuring diagonal distance through the air when crossing tall terrain).',
    description:
      'Models with FLY can move over enemy models when making a Normal, Advance, Fall Back, or Charge move. Vulnerable to [ANTI-FLY] weapons.',
  },
  {
    keyword: 'WALKER',
    category: 'unit',
    name: 'Walker',
    summary: 'Bipedal/multi-legged Vehicle (e.g. Dreadnoughts) eligible for Heroic Intervention and melee stratagems.',
    description:
      'Walkers are Vehicles that fight on foot in close combat and can use several melee-oriented Stratagems and Heroic Intervention.',
  },
  {
    keyword: 'TITANIC',
    category: 'unit',
    name: 'Titanic',
    summary: 'Super-heavy unit: cannot Fire Overwatch; can move over low terrain features and Fall Back + Shoot in some detachments.',
    description:
      'Titanic units are massive war machines. They cannot be targeted by the Fire Overwatch Stratagem, and follow special visibility and movement rules over low obstacles.',
  },
  {
    keyword: 'TOWERING',
    category: 'unit',
    name: 'Towering',
    summary: 'Massive stature: follows special Ruins visibility rules when toeing into terrain.',
    description:
      'Towering models can see through Ruins terrain features even when only partially within them, and can be seen in return.',
  },
  {
    keyword: 'AIRCRAFT',
    category: 'unit',
    name: 'Aircraft',
    summary: 'Must start in Reserves (unless Hovering), moves minimum 20" straight ahead, and only interacts with FLY units in melee.',
    description:
      'Aircraft start in Strategic Reserves (arriving Round 2+), must pivot up to 90° and move at least 20" straight forward, and can only be charged by units with FLY.',
  },
  {
    keyword: 'TRANSPORT',
    category: 'unit',
    name: 'Transport',
    summary: 'Can embark friendly Infantry/eligible models up to its Transport capacity.',
    description:
      'Friendly units can embark within this Transport if they end a Normal, Advance, or Fall Back move wholly within 3" of it. Disembarking units cannot Charge in the same turn if the Transport already moved (unless it has Assault Ramp).',
  },
  {
    keyword: 'EXPLOSIVES',
    category: 'unit',
    name: 'Explosives',
    summary: '11th Edition unit keyword: specialized demolitionists/ordnance-bearers with access to ordnance core actions and explosive buffs.',
    description:
      'In 11th Edition, the EXPLOSIVES keyword is given to units armed with heavy charges, satchel bombs, or combat grenades (e.g. Intercessors, Krieg Engineers, Ork Tankbustas). It governs interaction with ordnance Stratagems and demolition actions against fortifications and terrain.',
  },
  {
    keyword: 'MOBILE',
    category: 'unit',
    name: 'Mobile',
    summary: '11th Edition keyword: allows models to move horizontally through dense terrain features without penalty.',
    description:
      'In 11th Edition, units with the MOBILE keyword (or units that gain it via abilities such as Super-heavy Walker) can move horizontally through sections of dense terrain features that are 4" or less in height as if they were clear ground.',
  },
  {
    keyword: 'FRAME',
    category: 'unit',
    name: 'Frame',
    summary: '11th Edition light-vehicle chassis keyword for buggies, sentinels, and light war-engines.',
    description:
      'Denotes light vehicle and walker chassis (such as Ork Buggies and Scout Walkers), interacting with transport capacities and repair subroutines.',
  },
  {
    keyword: 'WAGON',
    category: 'unit',
    name: 'Wagon',
    summary: '11th Edition heavy armored vehicle/transport keyword for battlewagons and tanks.',
    description:
      'Denotes heavy battle tanks and ram-equipped transports, unlocking ramming attacks and enhanced capacity bonuses.',
  },
  {
    keyword: 'MOB',
    category: 'unit',
    name: 'Mob',
    summary: '11th Edition mass infantry formation: gains morale buffs and swarm bonuses when above starting strength thresholds.',
    description:
      'Units with the MOB keyword represent vast throngs of infantry (such as Ork Boyz and Gretchin) that benefit from swarm combat rules and modified Battle-shock tests.',
  },
  {
    keyword: 'GRENADES',
    category: 'unit',
    name: 'Grenades',
    summary: 'Unlocks the Core "Grenade" Stratagem (1 CP in your Shooting phase: roll 6D6 within 8" for mortal wounds on 4+).',
    description:
      'Units with the GRENADES keyword can use the Core Grenade Stratagem (1 CP) in your Shooting phase if they have not shot and are not in Engagement Range: select one visible enemy unit within 8" and roll six D6; for each 4+, that enemy unit suffers 1 mortal wound.',
  },
  {
    keyword: 'SMOKE',
    category: 'unit',
    name: 'Smoke',
    summary: 'Unlocks the Core "Smokescreen" Stratagem (1 CP in Opponent’s Shooting phase: grants Benefit of Cover and Stealth).',
    description:
      'Units with the SMOKE keyword can use the Core Smokescreen Stratagem (1 CP) in your opponent’s Shooting phase when targeted: until the end of the phase, all models in your unit have the Benefit of Cover and the Stealth ability (-1 to be Hit).',
  },
  {
    keyword: 'PSYKER',
    category: 'unit',
    name: 'Psyker',
    summary: 'Wields Warp powers; vulnerable to [ANTI-PSYKER] weapons.',
    description:
      'Psyker models channel the Warp to unleash Psychic weapons and abilities, and are susceptible to Anti-Psyker rules and defences.',
  },
  {
    keyword: 'TERMINATOR',
    category: 'unit',
    name: 'Terminator',
    summary: 'Heavy tactical dreadnought armor; typically takes 2 spaces in compatible Transports and has a 2+ Save / 4+ Invulnerable Save.',
    description:
      'Terminator Infantry wear Tactical Dreadnought Armour, granting deep strike teleportation and heavy resilience, while occupying 2 capacity slots in Transports that allow them.',
  },
  {
    keyword: 'JUMP PACK',
    category: 'unit',
    name: 'Jump Pack',
    summary: 'High-mobility thrusters granting FLY and Deep Strike.',
    description:
      'Jump Pack units are fast-moving assault troops with FLY and Deep Strike capabilities.',
  },
  {
    keyword: 'GRAVIS',
    category: 'unit',
    name: 'Gravis',
    summary: 'Heavy Mark X Gravis armor (T6); takes 2 spaces in compatible Space Marine Transports.',
    description:
      'Mk X Gravis armour provides Toughness 6 and extra wounds for Space Marine infantry, occupying 2 slots in compatible Transports.',
  },
  {
    keyword: 'PHOBOS',
    category: 'unit',
    name: 'Phobos',
    summary: 'Stealth/recon Mark X Phobos armor; interacts with Infiltrators, Scouts, and vanguard redeployment rules.',
    description:
      'Mk X Phobos armour is worn by Space Marine reconnaissance units, unlocking vanguard guerrilla Stratagems and abilities.',
  },
  {
    keyword: 'TACTICUS',
    category: 'unit',
    name: 'Tacticus',
    summary: 'Standard Mark X Tacticus power armor; compatible with Impulsor and standard Space Marine Transports.',
    description:
      'Mk X Tacticus armour is worn by standard Primaris Space Marine squads, allowing embarkation in Impulsors, Repulsors, and Land Raiders.',
  },
  {
    keyword: 'SYNAPSE',
    category: 'unit',
    name: 'Synapse',
    summary: 'Tyranid Hive Mind node: friendly Tyranids within 6" roll 3D6 for Battle-shock tests and gain +1 Melee Strength.',
    description:
      'While a Tyranids unit is within 6" of one or more friendly Synapse models, it is within Synapse Range: it takes Battle-shock tests on 3D6 instead of 2D6, and adds 1 to the Strength characteristic of its melee weapons.',
  },
  {
    keyword: 'DAMNED',
    category: 'unit',
    name: 'Damned',
    summary: 'Mortal Chaos cultists and renegades.',
    description:
      'Identifies mortal Chaos Cultist, Traitor Guard, and Accursed units for Chaos Space Marines detachments and Stratagems.',
  },
  {
    keyword: 'DAEMON',
    category: 'unit',
    name: 'Daemon',
    summary: 'Warp entity with invulnerable saves; interacts with Anti-Daemon rules.',
    description:
      'Daemon units are manifestations of the Warp, typically possessing an invulnerable save and interacting with Daemonic Pact / Shadow of Chaos rules.',
  },
  {
    keyword: 'IMPERIUM',
    category: 'unit',
    name: 'Imperium',
    summary: 'Super-faction keyword for armies of the Imperium of Man.',
    description:
      'Denotes allegiance to the Imperium of Man, governing Imperial Agents and Freeblade Knight allies.',
  },
  {
    keyword: 'CHAOS',
    category: 'unit',
    name: 'Chaos',
    summary: 'Super-faction keyword for armies of the Dark Gods.',
    description:
      'Denotes allegiance to the Ruinous Powers of Chaos (Khorne, Tzeentch, Nurgle, Slaanesh), governing Daemonic Pact and Dreadblade allies.',
  },
  {
    keyword: 'ADEPTUS ASTARTES',
    category: 'unit',
    name: 'Adeptus Astartes',
    summary: 'Faction keyword for Space Marines; unlocks Oath of Moment and Space Marine Stratagems.',
    description:
      'Identifies Space Marine units eligible for the Oath of Moment army rule and Adeptus Astartes Detachment rules.',
  },

  // =========================================================================
  // STATLINE & WEAPON COLUMN HELPERS (Just-in-Time Tabletop Coaching)
  // =========================================================================
  {
    keyword: 'STAT_M',
    category: 'core_rule',
    name: 'Move (M)',
    summary: 'Maximum distance in inches a model can move in the Movement phase.',
    description:
      'Normal Move: Move up to M". Advance: Roll 1D6 and add to M" (unit cannot shoot or charge this turn unless weapons have [ASSAULT]). Fall Back: Move up to M" out of Engagement Range.',
  },
  {
    keyword: 'STAT_T',
    category: 'core_rule',
    name: 'Toughness (T)',
    summary: 'Resilience against incoming attacks; compared against the attacker’s Strength (S).',
    description:
      'When an opponent hits your unit, compare their weapon’s Strength (S) to your unit’s Toughness (T): S = T wounds on 4+. If S is higher, they wound on 3+ (or 2+ if S is at least double T). If S is lower, they wound on 5+ (or 6+ if S is half T or less).',
  },
  {
    keyword: 'STAT_SV',
    category: 'core_rule',
    name: 'Armour Save (Sv)',
    summary: 'Roll 1D6 for each wound suffered; modified by the attacker’s AP and Cover.',
    description:
      'Roll 1D6 and subtract the attacking weapon’s Armour Penetration (AP). If you have the Benefit of Cover, add 1 to the save roll (Note: Cover cannot improve a 3+ or better save against AP 0 attacks). An unmodified roll of 1 always fails.',
  },
  {
    keyword: 'STAT_INV',
    category: 'core_rule',
    name: 'Invulnerable Save (Inv)',
    summary: 'Special save that is NEVER modified by the attacker’s AP.',
    description:
      'When making a saving throw, you can choose to use either your Armour Save (modified by AP) or your Invulnerable Save (never modified by AP). Devastating Wounds bypass both Armour and Invulnerable saves.',
  },
  {
    keyword: 'STAT_W',
    category: 'core_rule',
    name: 'Wounds (W)',
    summary: 'How much damage each model can suffer before being destroyed.',
    description:
      'Allocate all attacks to an already-wounded model in the unit first until it is destroyed. Note: Excess damage from a normal attack does NOT spill over from one destroyed model to the next (only Mortal Wounds spill over).',
  },
  {
    keyword: 'STAT_LD',
    category: 'core_rule',
    name: 'Leadership (Ld)',
    summary: 'Roll 2D6 ≥ Ld in your Command phase if this unit is Below Half-Strength.',
    description:
      'In the Battle-shock step of your Command phase, test each unit Below Half-Strength by rolling 2D6. If the total is less than Ld, the unit is Battle-shocked until your next Command phase: its Objective Control (OC) becomes 0 and you cannot target it with Stratagems.',
  },
  {
    keyword: 'STAT_OC',
    category: 'core_rule',
    name: 'Objective Control (OC)',
    summary: 'Points each model contributes toward controlling an Objective Marker (within 3").',
    description:
      'Sum the OC of all models within range of an Objective Marker at the end of any phase/turn. The player with the highest total OC controls that objective. Battle-shocked units have an OC of 0.',
  },
  {
    keyword: 'STAT_RNG',
    category: 'core_rule',
    name: 'Range',
    summary: 'Maximum distance in inches to an eligible target model.',
    description:
      'Measure from the attacking model’s base to the closest visible model in the target unit. Weapons with [RAPID FIRE] or [MELTA] gain bonuses within half of this maximum range.',
  },
  {
    keyword: 'STAT_A',
    category: 'core_rule',
    name: 'Attacks (A)',
    summary: 'Number of Hit dice rolled per model firing or fighting with this weapon.',
    description:
      'Multiply Attacks (A) by the number of models in your unit firing this weapon. If A is variable (e.g. D6), roll separately to determine the number of attacks.',
  },
  {
    keyword: 'STAT_BS_WS',
    category: 'core_rule',
    name: 'Ballistic / Weapon Skill (BS/WS)',
    summary: 'Minimum D6 roll required to score a Hit.',
    description:
      'Step 1 of the Attack Sequence: Roll 1D6 per Attack. If the result ≥ BS (ranged) or WS (melee), the attack hits! Unmodified 6 is always a Critical Hit; unmodified 1 always misses. Hit rolls can never be modified by more than +1 or -1.',
  },
  {
    keyword: 'STAT_S',
    category: 'core_rule',
    name: 'Strength (S) — Wound Roll Chart',
    summary: 'Compared against target’s Toughness (T) to determine the Wound roll (2+ to 6+).',
    description:
      '11th Ed Wound Chart (Step 2 of Attack Sequence):\n• S is ≥ 2× Toughness → Wound on 2+\n• S is > Toughness → Wound on 3+\n• S equals Toughness → Wound on 4+\n• S is < Toughness → Wound on 5+\n• S is ≤ ½ Toughness → Wound on 6+\nTip: Tap any weapon’s Strength number to calculate its exact Toughness breakpoints!',
  },
  {
    keyword: 'STAT_AP',
    category: 'core_rule',
    name: 'Armour Penetration (AP)',
    summary: 'Modifier subtracted from the target’s Armour Save roll.',
    description:
      'Step 3 of the Attack Sequence: When your wound succeeds, the opponent subtracts your AP from their Armour Save roll (e.g., Sv 3+ against AP -2 requires a 5+ on the die). AP does not affect Invulnerable Saves.',
  },
  {
    keyword: 'STAT_D',
    category: 'core_rule',
    name: 'Damage (D)',
    summary: 'Wounds lost by the target model for each failed Save.',
    description:
      'Step 4 of the Attack Sequence: For each failed saving throw, the target model loses D wounds. Remember: normal excess damage does not spill over to a second model if the first model dies!',
  },
];

/**
 * Resolves a keyword, weapon ability, or core ability string (including parameterized ones like
 * "SUSTAINED HITS 1", "ANTI-INFANTRY 4+", "FEEL NO PAIN 5+", "SCOUTS 6\"") to a KeywordDefinition
 * with interpolated summary and description.
 */
export function lookupKeywordDefinition(
  rawKeyword: string,
  customGlossary?: KeywordDefinition[]
): KeywordDefinition | undefined {
  const cleaned = rawKeyword
    .replace(/^\[|\]$/g, '')
    .trim();
  if (!cleaned) return undefined;

  const upper = cleaned.toUpperCase();
  const list = customGlossary && customGlossary.length > 0 ? customGlossary : KEYWORD_GLOSSARY;

  // 1. Exact match
  const exact = list.find(
    (entry) => entry.keyword.toUpperCase() === upper || entry.name.toUpperCase() === upper
  );
  if (exact) {
    return exact;
  }

  // 1b. Dynamic Weapon Strength vs. Toughness Wound Roll Calculator (e.g., "STRENGTH 6", "STRENGTH 10")
  const strengthMatch = upper.match(/^STRENGTH\s+(\d+)$/);
  if (strengthMatch) {
    const s = parseInt(strengthMatch[1], 10);
    if (s > 0) {
      const twoPlusMax = Math.floor(s / 2);
      const threePlusMin = twoPlusMax + 1;
      const threePlusMax = s - 1;
      const fivePlusMin = s + 1;
      const fivePlusMax = s * 2 - 1;
      const sixPlusMin = s * 2;

      const twoPlusLine =
        twoPlusMax >= 1
          ? `• 2+ to Wound: Target T 1–${twoPlusMax} (S ≥ 2×T)\n`
          : '';
      const threePlusLine =
        threePlusMin <= threePlusMax
          ? `• 3+ to Wound: Target T ${
              threePlusMin === threePlusMax ? threePlusMin : `${threePlusMin}–${threePlusMax}`
            } (S > T)\n`
          : '';
      const fourPlusLine = `• 4+ to Wound: Target T ${s} (S = T)\n`;
      const fivePlusLine =
        fivePlusMin <= fivePlusMax
          ? `• 5+ to Wound: Target T ${
              fivePlusMin === fivePlusMax ? fivePlusMin : `${fivePlusMin}–${fivePlusMax}`
            } (S < T)\n`
          : '';
      const sixPlusLine = `• 6+ to Wound: Target T ${sixPlusMin}+ (S ≤ ½T)`;

      return {
        keyword: cleaned,
        category: 'core_rule',
        name: `Strength ${s} — Wound Roll Chart`,
        summary: `Wounds T${s} on 4+${
          twoPlusMax >= 1 ? ` · T≤${twoPlusMax} on 2+` : ''
        } · T${sixPlusMin}+ on 6+`,
        description: `When rolling to Wound with Strength ${s} against your opponent’s Toughness (T):\n${twoPlusLine}${threePlusLine}${fourPlusLine}${fivePlusLine}${sixPlusLine}`,
      };
    }
  }

  // 2. Parameterized Anti-Keyword X+ (e.g., "ANTI-VEHICLE 4+", "ANTI-INFANTRY 2+")
  const antiMatch = upper.match(/^ANTI-([A-Z\s-]+?)\s+(\d+\+)$/i);
  if (antiMatch) {
    const targetKw = antiMatch[1].trim();
    const rollVal = antiMatch[2].trim();
    return {
      keyword: cleaned,
      category: 'weapon',
      name: `Anti-${targetKw} ${rollVal}`,
      summary: `Unmodified Wound rolls of ${rollVal} against ${targetKw} units score a Critical Wound.`,
      description: `Each time an attack is made with this weapon against a target unit that has the ${targetKw} keyword, an unmodified Wound roll of ${rollVal} scores a Critical Wound (automatically wounding the target, and triggering Devastating Wounds if this weapon also has [DEVASTATING WOUNDS]).`,
      hasParameter: true,
    };
  }

  // 3. Conditional Lethal Hits (e.g., "LETHAL HITS: non-MONSTER/VEHICLE", "LETHAL HITS: MONSTER/VEHICLE")
  if (upper.startsWith('LETHAL HITS:')) {
    const condition = cleaned.slice('LETHAL HITS:'.length).trim();
    return {
      keyword: cleaned,
      category: 'weapon',
      name: `Lethal Hits (${condition})`,
      summary: `Critical Hits automatically wound when targeting ${condition}.`,
      description: `Each time an attack is made with this weapon targeting a unit matching "${condition}", a Critical Hit automatically wounds the target without needing to make a Wound roll.`,
    };
  }

  // 4. Prefix match for parameterized abilities (e.g., "SUSTAINED HITS 1", "RAPID FIRE 2", "MELTA 2", "FEEL NO PAIN 5+", "SCOUTS 6\"", "DEADLY DEMISE D3", "FIRING DECK 2", "CLEAVE 2", "BLAST 1")
  for (const entry of list) {
    if (entry.hasParameter && upper.startsWith(entry.keyword.toUpperCase())) {
      const paramPart = cleaned.slice(entry.keyword.length).trim();
      if (paramPart) {
        return {
          ...entry,
          keyword: cleaned,
          name: `${entry.name.replace(/\s+X\+?\"?$/i, '')} ${paramPart}`,
          summary: entry.summary.replace(/\bX\+?\"?/g, paramPart),
          description: entry.description.replace(/\bX\+?\"?/g, paramPart),
        };
      }
    }
  }

  // 4. Generic fallback for any other unit or faction keyword so every keyword badge has a helpful tooltip
  return {
    keyword: cleaned,
    category: 'unit',
    name: cleaned,
    summary: `Unit / Faction Keyword: ${cleaned.toUpperCase()}`,
    description: `Models in this unit have the ${cleaned.toUpperCase()} keyword. Stratagems, Detachment rules, Transport capacities, and [ANTI-${cleaned.toUpperCase()}] weapons that reference ${cleaned.toUpperCase()} apply to this unit (and to the entire Attached unit while a Character with this keyword is attached).`,
  };
}
