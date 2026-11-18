// Late-afternoon sun over Meridian Bay: warm directional light with
// shadows that follow the player, sky color, and light distance fog.
import { CFG } from '../config.js';

export function createDaylight(scene, renderer, noShadows = false) {
  scene.background = new THREE.Color(CFG.skyColor);
  scene.fog = new THREE.Fog(CFG.fogColor, CFG.fogNear, CFG.fogFar);

  const sun = new THREE.DirectionalLight(CFG.sunColor, CFG.sunIntensity);
  sun.position.set(120, 180, 60);
  sun.castShadow = !noShadows;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -130;
  sun.shadow.camera.right = 130;
  sun.shadow.camera.top = 130;
  sun.shadow.camera.bottom = -130;
  sun.shadow.camera.near = 20;
  sun.shadow.camera.far = 500;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);

  const hemi = new THREE.HemisphereLight(CFG.hemiSky, CFG.hemiGround, CFG.hemiIntensity);
  scene.add(hemi);

  renderer.shadowMap.enabled = !noShadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  return {
    update(focusX, focusZ) {
      // Keep the shadow frustum centered on the action.
      sun.position.set(focusX + 120, 180, focusZ + 60);
      sun.target.position.set(focusX, 0, focusZ);
      sun.target.updateMatrixWorld();
    },
  };
}
