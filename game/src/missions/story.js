// The story: Kai Mercer, driver-for-hire, caught between the Harbor Kings
// and the Vesper Syndicate. Five missions, each a list of steps — drive
// somewhere, steal a car, lose the heat, clear the gunmen, pick a side.
export const MISSIONS = [
  {
    id: 1,
    title: 'Harbor Run',
    intro: 'The Harbor Kings need a package at the marina. Drive it there — and don\'t ask what\'s in the box.',
    outro: 'Package delivered. The Kings notice a driver who keeps his cool.',
    reward: 500,
    timeLimit: 240,
    steps: [
      { type: 'enterCar', text: 'Get in the delivery car', car: { x: 12, z: -8, type: 'sedan', color: 0x2a7fd8 } },
      { type: 'goto', text: 'Drive to the marina marker', x: 160, z: 160, onArrive: 'Vesper eyes on the docks — keep moving!' },
      { type: 'goto', text: 'Drop the package in Old Town', x: -140, z: -40 },
    ],
  },
  {
    id: 2,
    title: 'Hot Wheels',
    intro: 'The Kings want a very specific sports car. It has an owner. He\'s about to have one less car.',
    outro: 'The Kings pay fast for fast cars. That one was very fast.',
    reward: 800,
    timeLimit: 210,
    steps: [
      { type: 'goto', text: 'Find the sports car downtown', x: 60, z: -20 },
      { type: 'stealCar', text: 'Steal the sports car', car: { x: 60, z: -20, type: 'sports', color: 0xd84040 } },
      { type: 'goto', text: 'Deliver it to the Kings\' garage', x: -160, z: -120, clearsWanted: true },
    ],
  },
  {
    id: 3,
    title: 'Heat Wave',
    intro: 'Somebody talked. The whole department wants Kai Mercer tonight — lose them, then vanish into the park.',
    outro: 'The heat fades. In Harbor Park, Kai is just another face on a bench.',
    reward: 1200,
    timeLimit: 240,
    startWanted: 3,
    steps: [
      { type: 'loseWanted', text: 'Lose the police' },
      { type: 'goto', text: 'Reach the park hideout', x: 0, z: 120 },
    ],
  },
  {
    id: 4,
    title: 'Port Ambush',
    intro: 'The Vespers are moving product through Meridian Port tonight. The Kings want the shipment stopped — permanently.',
    outro: 'The port goes quiet. The Syndicate just lost a lot of money.',
    reward: 2000,
    timeLimit: 300,
    steps: [
      { type: 'goto', text: 'Reach Meridian Port', x: 160, z: -160 },
      {
        type: 'eliminate', text: 'Eliminate the gunmen', count: 6,
        spawns: [
          { x: 148, z: -148 }, { x: 172, z: -152 }, { x: 160, z: -172 },
          { x: 140, z: -128 }, { x: 184, z: -136 }, { x: 168, z: -120 },
        ],
      },
    ],
  },
  {
    id: 5,
    title: 'The Choice',
    intro: 'Both crews want Kai for the last job. Tonight he picks a side — and the other side will remember it.',
    outro: 'Meridian Bay has a new name on its streets: Kai Mercer. The war is over. The legend starts.',
    reward: 5000,
    timeLimit: 360,
    steps: [
      {
        type: 'choose', text: 'Choose a crew — Kings at the port, Vespers downtown',
        options: [
          { label: 'Harbor Kings', x: 160, z: -160, id: 'kings' },
          { label: 'Vesper Syndicate', x: 60, z: -40, id: 'vespers' },
        ],
      },
      {
        type: 'eliminate', text: 'Eliminate the rival crew', count: 4, dynamic: true,
        spawnsKings: [
          { x: 52, z: -32 }, { x: 68, z: -48 }, { x: 60, z: -28 }, { x: 76, z: -36 },
        ],
        spawnsVespers: [
          { x: 148, z: -148 }, { x: 172, z: -152 }, { x: 160, z: -172 }, { x: 184, z: -136 },
        ],
      },
      { type: 'goto', text: 'Drive to the victory meet', x: 0, z: 120 },
    ],
  },
];
