// Late-afternoon sun, sky and fog for Meridian Bay.
// One warm directional light with a shadow camera that follows the player,
// so shadows stay crisp wherever the action is.

import { CFG } from '../config.js';

const THREE = window.THREE;

export class Daylight {
  constructor(G) {
    this.G = G;
    const scene = G.scene;
    scene.background = new THREE.Color(CFG.skyColor);
    scene.fog = new THREE.Fog(CFG.skyColor, CFG.fogNear, CFG.fogFar);

    this.sun = new THREE.DirectionalLight(CFG.sunColor, CFG.sunIntensity);
    this.sun.position.set(90, 130, 60);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(CFG.shadowMapSize, CFG.shadowMapSize);
    const r = CFG.shadowRadius;
    const cam = this.sun.shadow.camera;
    cam.left = -r;
    cam.right = r;
    cam.top = r;
    cam.bottom = -r;
    cam.near = 10;
    cam.far = 420;
    cam.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0006;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(CFG.hemiSky, CFG.hemiGround, 0.85);
    scene.add(this.hemi);

    // A soft warm bounce from the west so shadowed faces are never black.
    this.bounce = new THREE.DirectionalLight(0xffc9a0, 0.35);
    this.bounce.position.set(-80, 40, -60);
    scene.add(this.bounce);
  }

  // Keep the shadow frustum centred on the action.
  update(focusX, focusZ) {
    const s = this.sun;
    s.position.set(focusX + 90, 130, focusZ + 60);
    s.target.position.set(focusX, 0, focusZ);
  }
}
