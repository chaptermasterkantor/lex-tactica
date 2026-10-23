import type { Phase } from '../types/rules';

export interface PhaseCoachTip {
  title: string;
  content?: string;
  bullets?: string[];
}

export const PHASE_COACH_TIPS: Record<Phase, PhaseCoachTip[]> = {
  pre_game: [
    {
      title: 'Dual Leaders (Regular + Support)',
      content:
        "A Bodyguard unit can attach up to 1 Leader AND 1 Support character. They act as a single unit, and attacks against them always use the Bodyguard's highest Toughness until all bodyguards are dead (19.02).",
    },
    {
      title: 'Shared Keywords Warning',
      content:
        'Attached units pool all keywords (e.g., a PSYKER Leader gives the whole squad the PSYKER keyword, making the bodyguards vulnerable to [ANTI-PSYKER] weapons) (19.03).',
    },
    {
      title: 'Infiltrators & Scouts Range',
      content:
        'Both Infiltrators and Scouts moves must end more than 8" horizontally from all enemy models (down from 9" in 10th Ed) (24.20, 24.32).',
    },
    {
      title: 'Scouts from Reserves',
      content:
        'If a unit with Scouts X" starts in Strategic Reserves, you can deploy it wholly within your deployment zone during the pre-battle step instead of keeping it in reserve (24.31).',
    },
  ],

  start_of_round: [
    {
      title: 'Start of Round Triggers & Selection',
      content:
        'Resolve all Start-of-Battle-Round Army and Detachment abilities (e.g. Combat Doctrines, Blessings of Khorne, Waaagh!).',
    },
    {
      title: 'Round 3 Strategic Reserves Destruction Warning',
      content:
        'Any unit that started the game in Strategic Reserves or Deep Strike and has not arrived by the end of Battle Round 3 is automatically destroyed! (20.04)',
    },
  ],

  command: [
    {
      title: 'Both Players Gain CP',
      content:
        'Both you and your opponent gain +1 Core CP at the start of every Command Phase (08.02).',
    },
    {
      title: 'Battle-Shock Triggers & Recovery',
      content:
        "You must roll 2D6 >= Ld for any unit at or below half-strength, AND for any unit already Battle-shocked (they don't auto-recover at the start of the turn anymore—you must pass the roll to clear it!) (08.03).",
    },
    {
      title: 'Battle-Shock Penalties',
      content:
        'Battle-shocked units have OC - (cannot hold objectives), cannot be targeted by friendly Stratagems, and cannot start or complete Actions (01.07).',
    },
    {
      title: 'Insane Bravery Timing',
      content:
        'Must be used before you roll the Battle-shock dice (1 CP, once per battle) (15.04).',
    },
  ],

  movement: [
    {
      title: 'Terrain Movement & The "Solid" Wall Trap',
      bullets: [
        'INFANTRY, BEASTS, and SWARM move freely through Dense terrain walls (13.06).',
        'VEHICLES and MONSTERS can only cross Dense terrain sections 2" or less in height; otherwise they must go around (13.06).',
        'No Sticking Gun Barrels Through Walls: On Dense (Solid) terrain, no part of a model can end a move sticking through a wall or window 3" or less off the ground (13.06).',
      ],
    },
    {
      title: 'Flying "Take to the Skies"',
      content:
        "FLY units don't automatically ignore vertical distance anymore. Before moving, you can declare they Take to the Skies: subtract 2\" from their Move (unless they have Hover), and they ignore vertical distances, terrain, and enemy models during that move (21.03).",
    },
    {
      title: '3 Disembark Modes (18.04)',
      bullets: [
        'Tactical Disembark (Transport hasn\'t moved): Set up wholly within 3", then the squad can move AND charge normally.',
        'Rapid Disembark (Transport already moved/ingressed): Set up wholly within 3", cannot charge this turn.',
        'Combat Disembark (Transport is Engaged): Set up wholly within 6" (can be set up in Engagement Range of the same enemies), take a Hazard roll per model, unit becomes Battle-shocked and cannot charge.',
      ],
    },
    {
      title: 'Strategic Reserves Arrival (8" Rule)',
      content:
        'Arriving reserves set up wholly within 6" of a board edge (Deep Strike anywhere) and more than 8" horizontally from enemies (not 9"!) (20.04, 24.09).',
    },
    {
      title: 'Ingress & Deep Strike Timing (20.03–20.04)',
      bullets: [
        'Round 1: No Strategic Reserves or Deep Strike arrivals (unless a specific datasheet ability overrides it).',
        'Round 2: Standard Reserves arrive wholly within 6" of a board edge, >8" from enemies, and outside the enemy deployment zone. Units with Deep Strike (24.09) can set up anywhere >8" from enemies (including inside the enemy deployment zone!).',
        'Round 3: Standard Reserves can now also use the enemy\'s deployment zone board edges.',
        'After Ingressing: A unit that makes an Ingress Move cannot make any other move until the Charge phase (when it is eligible to declare a charge!) (20.04).',
      ],
    },
    {
      title: 'Fall Back Modes',
      content:
        'If your unit is not Battle-shocked, choose Ordered Retreat to fall back safely. If it is Battle-shocked (or needs to move through enemy models), you must choose Desperate Escape and roll a Hazard test (1-2 = 1 Mortal Wound) for every model (09.07).',
    },
  ],

  shooting: [
    {
      title: 'The 4 Terrain Visibility Rules (13.07–13.11)',
      bullets: [
        'Obscuring (Look Through Terrain): If line of sight crosses a Light or Dense terrain area that neither the shooter nor the target is inside ("toe-in"), they cannot see each other at all—even if you have true line of sight over a low barricade (13.10).',
        'Hidden (15" Stealth Bubble): INFANTRY, BEASTS, and SWARM inside a terrain area with Dense features are Hidden and cannot be targeted from outside 15"—only if they did not shoot in this turn or the previous turn. The moment they fire a gun, they lose Hidden until a full turn passes without them shooting (13.09).',
        'Solid (Ground Floor Windows): You cannot draw line of sight through windows, doors, or gaps 3" or less from ground level on Dense terrain (13.11).',
        'Benefit of Cover (-1 BS, Not +1 Save!): In 11th Ed, Cover worsens the attacker\'s BS by 1 (e.g., BS 3+ becomes 4+) instead of adding to the target\'s armour save. A unit gets Cover only if every model in the target unit is either INFANTRY/BEASTS/SWARM inside a terrain area, or not fully visible due to terrain (13.08).',
      ],
    },
    {
      title: 'Plunging Fire (+1 BS)',
      content:
        'Shooting from terrain 3"+ high (or with a TOWERING model within 12") at a unit on ground level improves your BS by 1 (22.05).',
    },
    {
      title: 'Shooting While Engaged ("Close-Quarters Shooting" 10.06)',
      bullets: [
        'Non-Monster/Vehicle units locked in melee can only fire [CLOSE-QUARTERS] / [PISTOL] weapons, and only at the enemy they are engaged with.',
        'MONSTERS and VEHICLES can shoot out of or into melee at -1 to Hit (no [BLAST] into melee) (10.06, 17.03).',
      ],
    },
    {
      title: "Devastating Wounds Don't Spill Over",
      content:
        'Mortal wounds from [DEVASTATING WOUNDS] only apply to a single model per Critical Wound—excess mortal wounds from that dice do not spill over to the next model in the squad! (24.10).',
    },
  ],

  charge: [
    {
      title: 'Roll 2D6 Before Selecting Targets (11.02 & 11.04)',
      bullets: [
        'Step 1: Select your charging unit (must be within 12" of an enemy) and roll 2D6 immediately.',
        'Step 2: After seeing the dice result, choose which enemy unit(s) within that rolled distance you want to declare as charge targets (or choose not to move at all!).',
      ],
    },
    {
      title: '2" Engagement Range & Double-1s',
      content:
        'Engagement Range in 11th Edition is 2" horizontally (03.04). However, a roll of 2 (double 1s) always fails because you had to start outside 2" (11.02).',
    },
    {
      title: '1" Base-to-Base Pull',
      content:
        'While making a Charge move, any model that can end within 1" of a charge target must do so (11.04).',
    },
    {
      title: "Reactive Watch (Opponent's Turn)",
      content:
        'Heroic Intervention (15.11) costs 1 CP (Leap to Defend: charge a unit that just charged) or 2 CP (Into the Fray: max 6" charge roll into any enemy within 6").',
    },
  ],

  fight: [
    {
      title: 'All Pile-Ins Happen Upfront (12.02)',
      content:
        'Unlike 10th Edition, you do not Pile-In when activating each unit. At the start of the Fight Phase, the active player makes 3" Pile-In moves for all eligible units first, followed by the opponent, before any melee attacks are rolled. (Models already in base-to-base contact cannot move).',
    },
    {
      title: 'Engagement Range is 2"',
      content:
        'Every model within 2" horizontally of the target enemy unit can swing—no more "base-to-base plus second rank" math (03.04, 04.02).',
    },
    {
      title: 'Overrun Fights (12.06)',
      content:
        'If your unit charged or started the Fight step engaged, and its target gets killed before your unit swings, your unit is still eligible! It can make an Overrun Fight, getting an extra 3" Pile-In move to tag a new nearby enemy and attack them.',
    },
    {
      title: 'All Consolidates Happen at the End (12.07–12.08)',
      content:
        'After all fighting is done, players alternate bulk Consolidations. Watch out for Engaging Consolidation: if you consolidate into a fresh enemy unit that hasn\'t fought yet, they immediately get to fight your unit!',
    },
  ],

  end_of_turn: [
    {
      title: 'Coherency Check (2" & 9" Rule)',
      content:
        'In 11th Ed, coherency doesn\'t require 2 models within 2" for 7+ model squads anymore. Instead, every model must be within 2" of at least one model AND within 9" of every other model in its unit (preventing long conga-lines) (03.03).',
    },
    {
      title: 'Terrain Objectives',
      content:
        'You control a Terrain Objective if your models have a foot inside the Terrain Area boundary mat/footprint, not just within 3" of the center token (14.01–14.02).',
    },
    {
      title: 'Round 3 Reserve Destruction Warning (20.04)',
      content:
        'Any unit that started the game in Strategic Reserves/Deep Strike and hasn\'t arrived by the end of Battle Round 3 is destroyed! (Exception: Units placed into reserves mid-battle via "reposition" abilities or embarked in a Transport that already arrived are safe and can arrive in Rounds 4–5).',
    },
  ],

  end_of_round: [
    {
      title: 'Coherency Check (2" & 9" Rule)',
      content:
        'In 11th Ed, coherency doesn\'t require 2 models within 2" for 7+ model squads anymore. Instead, every model must be within 2" of at least one model AND within 9" of every other model in its unit (preventing long conga-lines) (03.03).',
    },
    {
      title: 'Terrain Objectives',
      content:
        'You control a Terrain Objective if your models have a foot inside the Terrain Area boundary mat/footprint, not just within 3" of the center token (14.01–14.02).',
    },
    {
      title: 'Round 3 Reserve Destruction Warning (20.04)',
      content:
        'Any unit that started the game in Strategic Reserves/Deep Strike and hasn\'t arrived by the end of Battle Round 3 is destroyed! (Exception: Units placed into reserves mid-battle via "reposition" abilities or embarked in a Transport that already arrived are safe and can arrive in Rounds 4–5).',
    },
  ],

  any: [],
};
