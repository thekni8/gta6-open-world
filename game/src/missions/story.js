/* The five-mission story arc: Kai Mercer between the Harbor Kings
   and the Vesper Syndicate. Definitions only — the manager runs them. */
(function () {
  const MISSIONS = [
    {
      name: 'Harbor Run',
      intro: 'Rook of the Harbor Kings needs a package moved. Get in the delivery car and run it to the marina — no questions.',
      outro: 'Package delivered. The Kings notice a driver who shows up on time.',
      reward: 500,
      time: 180,
      steps: [
        { type: 'enterCar', car: 'delivery', text: 'Get in the delivery car' },
        { type: 'reach', x: 176, z: 172, radius: 8, text: 'Drive to the marina marker' },
      ],
    },
    {
      name: 'Hot Wheels',
      intro: 'The Kings want a gold coupe sitting in Midtown. Take it — quietly if you can — and bring it to the garage in Old Town.',
      outro: 'Clean lift. The garage crew strips it before the owner finishes lunch.',
      reward: 700,
      time: 240,
      steps: [
        { type: 'stealCar', car: 'target', text: 'Steal the gold coupe in Midtown' },
        { type: 'reach', x: -150, z: 150, radius: 8, text: 'Deliver the coupe to the garage', inCar: true },
      ],
    },
    {
      name: 'Heat Wave',
      intro: 'A Vesper tip put the whole precinct on you. Lose the cops, then lay low at the park hideout.',
      outro: 'Heat dies down. Somebody on the inside owes you one.',
      reward: 900,
      time: 240,
      startWanted: 3,
      steps: [
        { type: 'evade', text: 'Lose the police' },
        { type: 'reach', x: -150, z: 90, radius: 9, text: 'Reach the park hideout' },
      ],
    },
    {
      name: 'Port Ambush',
      intro: 'Vesper gunmen hit a Kings shipment at Meridian Port. Get down there and clear them out.',
      outro: 'The port is quiet again. The Kings remember who held the docks.',
      reward: 1200,
      time: 300,
      steps: [
        { type: 'reach', x: 0, z: -208, radius: 12, text: 'Reach Meridian Port' },
        { type: 'eliminate', count: 6, text: 'Eliminate the gunmen', spawn: 'port' },
      ],
    },
    {
      name: 'Kingmaker',
      intro: 'Both crews want you for the final play. Pick a side — drive to their door — and finish it.',
      outro: 'Meridian Bay has one king now. And a driver nobody forgets.',
      reward: 2500,
      time: 360,
      steps: [
        { type: 'choose', text: 'Choose a side — Kings or Vesper',
          options: [
            { x: -170, z: -120, label: 'Harbor Kings HQ', side: 'kings' },
            { x: 120, z: -150, label: 'Vesper Syndicate club', side: 'vesper' },
          ] },
        { type: 'eliminate', count: 4, text: 'Eliminate the rival crew', spawn: 'choice' },
        { type: 'reach', x: 176, z: 172, radius: 9, text: 'Escape to the marina' },
      ],
    },
  ];

  // Fixed landmark positions used by missions and scenarios.
  const PLACES = {
    spawn: { x: 0, z: 30 },
    deliveryCar: { x: 6, z: 42 },
    targetCar: { x: -60, z: -54 },
    garage: { x: -150, z: 150 },
    marina: { x: 176, z: 172 },
    parkHideout: { x: -150, z: 90 },
    port: { x: 0, z: -208 },
    kingsHQ: { x: -170, z: -120 },
    vesperClub: { x: 120, z: -150 },
    portSpawns: [
      { x: -24, z: -208 }, { x: -10, z: -216 }, { x: 8, z: -204 },
      { x: 22, z: -214 }, { x: -2, z: -224 }, { x: 16, z: -226 },
    ],
  };

  MB.Story = { missions: MISSIONS, places: PLACES };
})();
