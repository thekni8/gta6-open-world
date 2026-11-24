// Sun, sky, lighting and fog: warm late-afternoon light over the bay.

export function createDaylight(scene, config) {
  scene.background = new THREE.Color(config.skyColor);
  scene.fog = new THREE.Fog(config.fogColor, 260, 900);

  const sun = new THREE.DirectionalLight(config.sunColor, 2.6);
  sun.position.set(-180, 260, 120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -380;
  sun.shadow.camera.right = 380;
  sun.shadow.camera.top = 380;
  sun.shadow.camera.bottom = -380;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 900;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);

  const sky = new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5f, 1.15);
  scene.add(sky);

  // A few flat white clouds drifting high above the city.
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
  const clouds = new THREE.Group();
  const puffs = [
    [-260, 150, -220, 46], [120, 165, -260, 60], [260, 145, 60, 40],
    [-80, 170, 240, 55], [40, 155, -60, 34], [-280, 160, 140, 44],
  ];
  for (const [x, y, z, w] of puffs) {
    const cloud = new THREE.Group();
    const n = 3 + Math.floor(w / 18);
    for (let i = 0; i < n; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(w / n * 0.9, 10, 8), cloudMat);
      puff.scale.y = 0.42;
      puff.position.set((i - n / 2) * w / n * 1.1, (i % 2) * 2.5, (i % 3 - 1) * 5);
      cloud.add(puff);
    }
    cloud.position.set(x, y, z);
    clouds.add(cloud);
  }
  scene.add(clouds);

  return {
    sun,
    update(dt) {
      clouds.position.x += dt * 0.6;
      if (clouds.position.x > 420) clouds.position.x = -420;
    },
  };
}

// Meridian Bay round 9 — witness touch
