// Warm late-afternoon sun, sky and fog. The golden-hour look is what makes
// the city read as sun-soaked instead of flat.
export function setupDaylight(scene, renderer) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Warm hazy sky: pale gold horizon fading to soft blue overhead.
  scene.background = new THREE.Color(0xbfd9e8);
  scene.fog = new THREE.Fog(0xcfe0e8, 180, 620);

  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a7a5a, 0.95);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffe3b0, 2.6);
  sun.position.set(-140, 190, -90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -260;
  sun.shadow.camera.near = 20;
  sun.shadow.camera.far = 600;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);

  // Soft fill from the sea side so shadow faces never go black.
  const fill = new THREE.DirectionalLight(0x9fc8e8, 0.5);
  fill.position.set(120, 80, 200);
  scene.add(fill);

  return { sun, hemi, fill };
}
