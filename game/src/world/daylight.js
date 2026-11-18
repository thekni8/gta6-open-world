/* Warm late-afternoon sun, sky, and fog — the sun-soaked look.
   One directional light with shadows that follows the player so the
   shadow map stays tight and cheap. */
(function () {
  let sun = null, hemi = null;

  function init(scene) {
    scene.background = new THREE.Color(0x8fd0ee);
    scene.fog = new THREE.Fog(0xa8d4e8, 220, 650);

    hemi = new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5a, 0.95);
    scene.add(hemi);

    sun = new THREE.DirectionalLight(0xffe3b0, 2.1);
    sun.position.set(90, 140, 60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -90; sun.shadow.camera.right = 90;
    sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90;
    sun.shadow.camera.near = 10; sun.shadow.camera.far = 420;
    sun.shadow.bias = -0.0006;
    scene.add(sun);
    scene.add(sun.target);

    // Warm bounce fill from the sea side so shadowed faces stay readable.
    const fill = new THREE.DirectionalLight(0x9fd8ff, 0.5);
    fill.position.set(-80, 60, -40);
    scene.add(fill);
  }

  // Keep the shadow frustum centered on the player.
  function follow(x, z) {
    if (!sun) return;
    sun.position.set(x + 90, 140, z + 60);
    sun.target.position.set(x, 0, z);
  }

  MB.Daylight = { init: init, follow: follow };
})();
