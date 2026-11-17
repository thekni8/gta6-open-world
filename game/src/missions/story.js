// Meridian Bay — the story. Five missions in Kai Mercer's turf war between the
// Harbor Kings (dockside smugglers) and the Vesper Syndicate (nightclub money).
// Every name, place and crew is invented for this game.
export const STORY = {
  intro: 'Kai Mercer, driver-for-hire. The Harbor Kings own the docks. The Vesper Syndicate owns the night. Tonight, both want Kai.',
  outroKings: 'Kai hands the ledger to the Harbor Kings. The docks are his now — and the Syndicate will remember the night he chose.',
  outroVesper: 'Kai burns the ledger and walks into the Vesper club a made man. The Kings lose the port, and Kai gains a city.',
};

export const MISSION_DEFS = [
  {
    id: 1,
    name: 'First Delivery',
    giver: 'Harbor Kings',
    intro: 'Mara Voss (Harbor Kings): "One package, no questions. Marina to the downtown tower. Drive like the rent depends on it — it does."',
    outro: 'Delivered. Mara nods once. "You drive clean. The Kings remember clean."',
    reward: 400,
    steps: [
      { text: 'Pick up the package at the marina', place: 'marina', radius: 10 },
      { text: 'Deliver it to the downtown tower', place: 'downtown', radius: 10 },
    ],
  },
  {
    id: 2,
    name: 'Borrowed Wheels',
    giver: 'Harbor Kings',
    intro: 'Mara: "The Syndicate took our car. Take it back. The gold coupe by the old-town garage — bring it to our garage. Try not to get noticed."',
    outro: 'The coupe is home. "Borrowed, returned," Mara grins. "The Kings pay their debts."',
    reward: 600,
    needsSteal: true,
    steps: [
      { text: 'Steal the gold coupe at the old-town garage', place: 'stealSpot', radius: 8, steal: true },
      { text: 'Deliver the coupe to the Harbor Kings garage', place: 'kingsGarage', radius: 10 },
    ],
  },
  {
    id: 3,
    name: 'Hot Pursuit',
    giver: 'Harbor Kings',
    intro: 'Mara: "Syndicate tipped the cops. You are the distraction. Lose them — hit all three checkpoints and do not get caught."',
    outro: 'Sirens fade behind you. "You made the whole precinct look slow," Mara laughs.',
    reward: 900,
    wantedOnStart: 3,
    steps: [
      { text: 'Reach checkpoint 1 — the beachfront', place: 'beachfront', radius: 12 },
      { text: 'Reach checkpoint 2 — the nightclub', place: 'nightclub', radius: 12 },
      { text: 'Reach checkpoint 3 — the safehouse', place: 'safehouse', radius: 12 },
    ],
  },
  {
    id: 4,
    name: 'Port Ambush',
    giver: 'Vesper Syndicate',
    intro: 'Vesper (Syndicate): "The Kings are moving product through the port tonight. Be there. Make sure none of it leaves."',
    outro: 'Six shooters down, the port quiet. Vesper: "The Syndicate notices people who finish jobs."',
    reward: 1200,
    combat: true,
    enemies: 6,
    steps: [
      { text: 'Get to the port', place: 'port', radius: 14 },
      { text: 'Take down the Harbor Kings shooters (0/6)', place: 'port', radius: 30, combat: true },
    ],
  },
  {
    id: 5,
    name: 'Pick a Side',
    giver: 'Kai Mercer',
    intro: 'Both crews want the ledger. The Kings wait at the garage. The Syndicate waits at the nightclub. One delivery decides who owns Meridian Bay.',
    outro: '',
    reward: 2000,
    choice: true,
    steps: [
      { text: 'Choose: deliver the ledger to the Kings (garage) or the Syndicate (nightclub)', place: 'choice', radius: 12 },
    ],
  },
];

/** The objective line shown on the HUD for a mission step. */
export function stepText(def, stepIndex, kills = 0) {
  const step = def.steps[stepIndex];
  if (!step) return 'Mission complete';
  if (step.combat) return `Take down the Harbor Kings shooters (${kills}/${def.enemies})`;
  return step.text;
}
