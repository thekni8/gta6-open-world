// Late-afternoon sun over Meridian Bay: warm directional light with
// shadows, a soft sky fill, and sea haze on the horizon.

import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class Daylight {
  constructor(scene) {
    this.scene = scene;
    scene.background = new THREE.Color(CONFIG.palette.sky);
    scene.fog = new THREE.Fog(CONFIG.palette.fog, 180, 620);

    this.sun = new THREE.DirectionalLight(CONFIG.palette.sun, 2.6);
    this.sun.position.set(-140, 190, 90);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -280;
    this.sun.shadow.camera.right = 280;
    this.sun.shadow.camera.top = 280;
    this.sun.shadow.camera.bottom = -280;
    this.sun.shadow.camera.far = 700;
    this.sun.shadow.bias = -0.0006;
    scene.add(this.sun);
    scene.add(this.sun.target);

    const hemi = new THREE.HemisphereLight(0xbfd9e8, 0x8a7a5a, 0.85);
    scene.add(hemi);
    this.hemi = hemi;
  }

  /** Keep the sun centred on the player so shadows stay crisp nearby. */
  follow(x, z) {
    this.sun.position.set(x - 140, 190, z + 90);
    this.sun.target.position.set(x, 0, z);
    this.sun.target.updateMatrixWorld();
  }
}
