// The Meridian Bay story: Kai Mercer, driver-for-hire, caught between the
// Harbor Kings and the Vesper Syndicate. Five missions, each a short arc of
// stages; the manager turns these definitions into live objectives.

import { LANDMARKS, CFG } from '../config.js';

export const CREWS = {
  harbor: {
    name: 'Harbor Kings',
    color: '#1abc9c',
    blurb: 'Dockside smugglers who run the port. Loyal to their drivers, ruthless to rivals.',
  },
  vesper: {
    name: 'Vesper Syndicate',
    color: '#9b59b6',
    blurb: 'Nightclub money with a clean front and dirty books. They own half of downtown after dark.',
  },
};

export const MISSIONS = [
  {
    id: 0,
    title: 'First Delivery',
    giver: 'Harbor Kings',
    briefing: 'The Kings need a driver they can trust. Pick up the crate at the port and get it downtown — no questions, no stops.',
    outro: 'Clean run. The Kings are watching you now, Kai — and so is the Syndicate.',
    reward: CFG.missionRewards[0],
    stages: [
      { type: 'goto', label: 'Pick up the crate at Meridian Port', pos: { x: 225, z: 60 }, radius: 10 },
      { type: 'goto', label: 'Deliver the crate downtown', pos: { x: 30, z: -30 }, radius: 10 },
    ],
  },
  {
    id: 1,
    title: 'Borrowed Wheels',
    giver: 'Harbor Kings',
    briefing: 'A Syndicate courier left a tuned coupe parked downtown. Take it — quietly if you can — and bring it to the Kings\' garage.',
    outro: 'Nice wheels. The Syndicate will want them back. Let them try.',
    reward: CFG.missionRewards[1],
    stages: [
      { type: 'steal', label: 'Steal the Syndicate coupe downtown', pos: { x: 90, z: 90 }, radius: 6, carColor: 0x8e44ad, carKind: 'sedan' },
      { type: 'deliver', label: 'Drive the coupe to the Harbor Kings garage', pos: { x: LANDMARKS.garage.x, z: LANDMARKS.garage.z }, radius: 12 },
    ],
  },
  {
    id: 2,
    title: 'Heat Run',
    giver: 'Harbor Kings',
    briefing: 'The drop is hot — the PD is already rolling. Hit all three checkpoints across the bay, then shake the heat. Lose them and you\'re golden.',
    outro: 'Three checkpoints, half the force behind you, and you still walked away. Legend.',
    reward: CFG.missionRewards[2],
    stages: [
      { type: 'goto', label: 'Reach the Bayfront checkpoint', pos: { x: 0, z: 210 }, radius: 12, wantedOnEnter: 3 },
      { type: 'goto', label: 'Reach the Westside checkpoint', pos: { x: -180, z: 0 }, radius: 12 },
      { type: 'goto', label: 'Reach the Old Town checkpoint', pos: { x: 0, z: -180 }, radius: 12 },
      { type: 'escape', label: 'Lose the cops — lay low at the spray shop or outrun them', pos: { x: LANDMARKS.sprayShop.x, z: LANDMARKS.sprayShop.z }, radius: 14 },
    ],
  },
  {
    id: 3,
    title: 'Port Ambush',
    giver: 'Harbor Kings',
    briefing: 'The Syndicate is moving on the port tonight. Hold the docks, Kai — nobody else is coming.',
    outro: 'The port is ours. The Syndicate just declared war, and you just answered.',
    reward: CFG.missionRewards[3],
    stages: [
      { type: 'goto', label: 'Get to the docks at Meridian Port', pos: { x: 225, z: 120 }, radius: 14 },
      { type: 'killAll', label: 'Defeat the Vesper gunmen at the port', pos: { x: 225, z: 120 }, radius: 30, enemies: 6 },
    ],
  },
  {
    id: 4,
    title: 'The Choice',
    giver: 'Both crews',
    briefing: 'Both crews want you — tonight, at the plaza. Pick a side, then get to their hideout alive. The other crew will not take it well.',
    outro: 'Meridian Bay has a new name on its streets: Kai Mercer. The city is yours now.',
    reward: CFG.missionRewards[4],
    stages: [
      { type: 'goto', label: 'Meet both crews at Meridian Plaza', pos: { x: LANDMARKS.plaza.x, z: LANDMARKS.plaza.z }, radius: 10 },
      { type: 'choice', label: 'Choose your crew', pos: { x: LANDMARKS.plaza.x, z: LANDMARKS.plaza.z }, radius: 10 },
      { type: 'escapeTo', label: 'Reach your crew\'s hideout alive', pos: null, radius: 14, enemies: 4 },
    ],
  },
];

export const HIDEOUTS = {
  harbor: { x: 210, z: 210, name: 'Harbor Kings Hideout' },
  vesper: { x: -210, z: -150, name: 'Vesper Club Hideout' },
};
