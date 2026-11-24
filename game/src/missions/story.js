// The story of Meridian Bay: Kai Mercer, driver-for-hire, caught between
// the Harbor Kings and the Vesper Syndicate. Five missions, all original.

export const MISSIONS = [
  {
    id: 1,
    title: 'FIRST DELIVERY',
    giver: 'Harbor Kings',
    intro: 'Rook needs a package run to the marina before sundown. Easy money. What could go wrong?',
    outro: 'The drop was watched. The Kings are pleased, the cops are not. Welcome to the job.',
    reward: 400,
    objectives: [
      { id: 'pickup', type: 'goto', text: 'Pick up the package at the marina', x: -34, z: -238 },
      { id: 'dropoff', type: 'goto', text: 'Deliver the package to the boardwalk', x: 136, z: 272 },
    ],
    onComplete: 'wanted1',
  },
  {
    id: 2,
    title: 'BORROWED WHEELS',
    giver: 'Harbor Kings',
    intro: 'The Kings need a clean car. There is a blue delivery van downtown with the keys in it. Borrow it.',
    outro: 'Clean car, clean handoff. Rook owes you one now.',
    reward: 600,
    objectives: [
      { id: 'steal', type: 'enterCar', text: 'Steal the blue delivery car downtown', x: 30, z: -63, carColor: 0x4f7ec9 },
      { id: 'hideout', type: 'goto', text: 'Drive it to the hideout', x: -34, z: -34 },
    ],
  },
  {
    id: 3,
    title: 'HEAT ON THE HARBOR',
    giver: 'Harbor Kings',
    intro: 'Vesper tipped off the cops. Three stars and climbing. Lose them — lay low at the hideout.',
    outro: 'The heat fades. Vesper made an enemy today.',
    reward: 800,
    objectives: [
      { id: 'escape', type: 'loseWanted', text: 'Lose the police — lay low at the hideout', x: -34, z: -34 },
    ],
    onStart: 'wanted3',
  },
  {
    id: 4,
    title: 'PORT AMBUSH',
    giver: 'Harbor Kings',
    intro: 'Vesper gunmen are holding the port hostage. Rook wants the docks back. Take them down.',
    outro: 'The port is ours again. Six gunmen down, not a crate lost.',
    reward: 1200,
    objectives: [
      { id: 'port', type: 'goto', text: 'Reach the container port', x: 330, z: 20 },
      { id: 'clear', type: 'eliminate', text: 'Eliminate the Vesper gunmen', count: 6, x: 352, z: 20 },
    ],
  },
  {
    id: 5,
    title: 'THE MERIDIAN CHOICE',
    giver: 'Kai Mercer',
    intro: 'Both crews want you at the meet. Pick a side — the Kings at the port, or Vesper at the club.',
    outro: 'Meridian Bay remembers who you stood with. The city is yours now, Kai.',
    reward: 2000,
    objectives: [
      { id: 'meet', type: 'goto', text: 'Reach the meet point downtown', x: 0, z: 68 },
      { id: 'choice', type: 'choice', text: 'Choose a side: Harbor Kings (port) or Vesper (club)', kings: { x: 330, z: -60 }, vesper: { x: -68, z: -204 } },
    ],
  },
];

export const INTRO_TEXT = {
  title: 'MERIDIAN BAY',
  subtitle: 'A driver. Two crews. One city that never sleeps.',
  kai: 'Kai Mercer — driver-for-hire, new in town, already in trouble.',
  kings: 'HARBOR KINGS — dockside smugglers who run the port.',
  vesper: 'VESPER SYNDICATE — nightclub money with long arms.',
};
