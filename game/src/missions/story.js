// The story of Meridian Bay: Kai Mercer, a driver-for-hire, pulled into
// a turf war between the Harbor Kings (dockside smugglers) and the Vesper
// Syndicate (nightclub money). Five missions, all original names, crews,
// and places.

export const STORY = {
  hero: 'Kai Mercer',
  crews: {
    harbor: 'Harbor Kings',
    vesper: 'Vesper Syndicate',
  },
  intro:
    'Meridian Bay. You are Kai Mercer, a driver-for-hire with a fast car and slow rent. Two crews want you — and tonight, both of them are calling.',
};

export const MISSIONS = [
  {
    id: 'delivery',
    title: 'Mission 1 — First Delivery',
    intro: 'Rook of the Harbor Kings needs a package at the marina. Drive it there. No questions, no stops.',
    outro: 'Package delivered. Rook is impressed — and the Kings now know your name.',
    objective: 'Drive to the marina marker',
    reward: 400,
    type: 'reach',
    target: 'marina',
    timeLimit: 150,
  },
  {
    id: 'borrowed',
    title: 'Mission 2 — Borrowed Wheels',
    intro: 'The Kings want a Vesper courier car — gold paint, downtown. Take it, and bring it to the safehouse garage.',
    outro: 'The courier car is theirs now. The Vesper Syndicate will remember this.',
    objective: 'Steal the gold car, then deliver it to the safehouse',
    reward: 600,
    type: 'steal-deliver',
    target: 'downtown',
    deliverTo: 'safehouse',
    timeLimit: 240,
  },
  {
    id: 'pursuit',
    title: 'Mission 3 — Hot Pursuit',
    intro: 'Meridian Bay PD is on you — three stars and climbing. Lose them, then slip away to the old park.',
    outro: 'You ghosted the whole department. Word travels fast in this city.',
    objective: 'Lose the police, then reach the park hideout',
    reward: 900,
    type: 'escape',
    target: 'park',
    timeLimit: 240,
    wantedOnStart: 3,
  },
  {
    id: 'ambush',
    title: 'Mission 4 — Port Ambush',
    intro: 'Vesper gunmen are waiting at the container port. Rook wants them gone. Take them all down.',
    outro: 'The port is quiet. The Kings own the docks tonight.',
    objective: 'Eliminate the Vesper gunmen at the port (0/6)',
    reward: 1200,
    type: 'eliminate',
    target: 'port',
    enemies: 6,
    timeLimit: 300,
  },
  {
    id: 'choice',
    title: 'Mission 5 — The Choice',
    intro: 'Both crews meet downtown at midnight. Vesper brought an army. End it — then choose who you drive for.',
    outro: '',
    objective: 'Clear the downtown meeting point (0/8)',
    reward: 2500,
    type: 'eliminate-choice',
    target: 'downtown',
    enemies: 8,
    timeLimit: 420,
  },
];

export const ENDINGS = {
  harbor:
    'You drive for the Harbor Kings. The docks, the boats, the whole bay — yours to run. Meridian Bay is yours, Kai.',
  vesper:
    'You drive for the Vesper Syndicate. Neon nights, club money, and a city that never sleeps. Meridian Bay is yours, Kai.',
};
