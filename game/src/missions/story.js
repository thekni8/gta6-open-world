// The Meridian Bay story: Kai Mercer, driver-for-hire, caught between the
// Harbor Kings and the Vesper Syndicate. Five missions, each with steps,
// a timer, and a cash reward.
export const STORY_INTRO =
  'Kai Mercer drives for anyone who pays. Tonight the Harbor Kings pay — and the Vesper Syndicate is watching.';

export const MISSIONS = [
  {
    id: 0,
    title: 'First Delivery',
    giver: 'HARBOR KINGS',
    briefing: 'A crate needs to move from the old warehouse to the marina — fast, and quiet. The Syndicate has eyes on the docks.',
    outro: 'Clean run. The Kings notice drivers who deliver on time.',
    reward: 500,
    timeLimit: 180,
    steps: [
      { type: 'goto', x: -140, z: 28, radius: 9, label: 'Drive to the old warehouse' },
      { type: 'goto', x: 196, z: 140, radius: 9, label: 'Deliver the crate to the marina' },
    ],
  },
  {
    id: 1,
    title: 'Borrowed Wheels',
    giver: 'HARBOR KINGS',
    briefing: 'The Kings need a particular car — a red coupe parked near the park. Take it, and bring it to the Northside garage. Try not to get spotted.',
    outro: 'The coupe is in the garage. The Kings owe you one.',
    reward: 800,
    timeLimit: 210,
    steps: [
      { type: 'goto', x: -84, z: 112, radius: 10, label: 'Find the red coupe near the park' },
      { type: 'steal', x: -84, z: 112, label: 'Steal the coupe (E to get in)' },
      { type: 'gotoCar', x: 28, z: -140, radius: 10, label: 'Deliver the coupe to the Northside garage' },
    ],
  },
  {
    id: 2,
    title: 'Heat Run',
    giver: 'HARBOR KINGS',
    briefing: 'The drop went bad — the Meridian Bay PD is all over you. Lose them, then lay low at the park hideout until it cools off.',
    outro: 'The heat is off. For now.',
    reward: 1200,
    timeLimit: 300,
    startWanted: 3,
    steps: [
      { type: 'loseHeat', label: 'Lose the police — break line of sight' },
      { type: 'goto', x: 96, z: 130, radius: 12, label: 'Reach the park hideout' },
    ],
  },
  {
    id: 3,
    title: 'Port Ambush',
    giver: 'VESPER SYNDICATE',
    briefing: 'The Syndicate wants the Kings\' port shipment stopped. Their gunmen are waiting at the docks. Go in loud — the Kings started this.',
    outro: 'The docks are quiet. Both crews know your name now.',
    reward: 2000,
    timeLimit: 360,
    steps: [
      { type: 'goto', x: -214, z: 60, radius: 12, label: 'Reach Meridian Port' },
      {
        type: 'eliminate', count: 6, label: 'Eliminate the gunmen',
        // Open gaps between the container rows (rows sit at z=44/60/76…,
        // columns at x=-234/-221/-208) — never inside a container.
        spawns: [
          [-214, 52], [-227, 68], [-214, 84], [-200, 100], [-227, 100], [-214, 116],
        ],
      },
    ],
  },
  {
    id: 4,
    title: 'The Choice',
    giver: 'KAI MERCER',
    briefing: 'Both crews want you tonight — and both want the other one gone. Pick a side, finish it, and get out of Meridian Bay airspace. The beach road is clear.',
    outro: 'Meridian Bay is yours now, Kai. Drive careful.',
    reward: 5000,
    timeLimit: 420,
    steps: [
      // The meet is on the downtown road (z=28) — open ground. (0,0) sat
      // inside a building cluster whose nearest approach is 15.7u, past
      // the trigger radius, so the mission could never start.
      { type: 'goto', x: 0, z: 28, radius: 12, label: 'Meet both crews downtown' },
      {
        type: 'choice', label: 'Choose a side',
        options: [
          { name: 'Harbor Kings', x: -140, z: -140, color: 0x3d7dd9 },
          { name: 'Vesper Syndicate', x: 140, z: -140, color: 0x8a5fc0 },
        ],
      },
      {
        type: 'eliminate', count: 4, label: 'Eliminate the rival crew',
        spawns: null, // filled in from the chosen side at runtime
      },
      { type: 'goto', x: 0, z: 210, radius: 12, label: 'Escape down the beach road' },
    ],
  },
];

export const HIDEOUT = { x: 96, z: 130, radius: 18 };
