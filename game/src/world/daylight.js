// Golden-hour light over Meridian Bay. A low warm sun throws long
// shadows down the streets, a gradient dome melts from blue overhead into
// peach at the horizon, and a glowing sun disc hangs over the sea to the
// west. The sun rig travels with the player so shadows stay crisp nearby.

import * as THREE from 'three';
import { CONFIG } from '../config.js';

function paintSky() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#3f8fd0'); // deep blue overhead
  grad.addColorStop(0.42, '#8ec3e8'); // afternoon blue
  grad.addColorStop(0.68, '#f7c98d'); // warm horizon band
  grad.addColorStop(0.84, '#ffb066'); // low golden glow
  grad.addColorStop(1.0, '#e89a5a'); // below the horizon
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function paintGlow() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255, 238, 185, 1)');
  grad.addColorStop(0.25, 'rgba(255, 192, 110, 0.9)');
  grad.addColorStop(0.6, 'rgba(255, 150, 70, 0.35)');
  grad.addColorStop(1, 'rgba(255, 140, 60, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Daylight {
  constructor(scene) {
    this.scene = scene;
    scene.background = new THREE.Color(CONFIG.palette.sky);
    scene.fog = new THREE.Fog(CONFIG.palette.haze, 160, 580);

    // Gradient sky dome, far enough to sit behind the whole city.
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(880, 24, 16),
      new THREE.MeshBasicMaterial({
        map: paintSky(),
        side: THREE.BackSide,
        fog: false,
        depthWrite: false,
      }),
    );
    dome.renderOrder = -10;
    scene.add(dome);
    this.dome = dome;

    // Low sun, warm and strong: long shadows across the streets.
    // The shadow camera is a tight box around the player (it travels with
    // the sun in follow()), so a 1024 map still gives crisp shadows near
    // the action while the far city — already fogged — goes unshadowed.
    this.sun = new THREE.DirectionalLight(CONFIG.palette.sun, 3.2);
    this.sun.position.set(-230, 120, 75);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -130;
    this.sun.shadow.camera.right = 130;
    this.sun.shadow.camera.top = 130;
    this.sun.shadow.camera.bottom = -130;
    this.sun.shadow.camera.far = 720;
    this.sun.shadow.bias = -0.0006;
    scene.add(this.sun);
    scene.add(this.sun.target);

    // Warm sky fill with a cooler ground bounce.
    this.hemi = new THREE.HemisphereLight(0xffd9b0, 0x6a5a48, 0.8);
    scene.add(this.hemi);

    // Sun disc and halo, low over the sea to the west.
    const glow = paintGlow();
    this.sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glow, fog: false, depthWrite: false, transparent: true,
    }));
    this.sunDisc.scale.set(200, 200, 1);
    this.sunDisc.position.set(-740, 140, 190);
    scene.add(this.sunDisc);
    this.sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glow, fog: false, depthWrite: false, transparent: true, opacity: 0.35,
    }));
    this.sunHalo.scale.set(340, 340, 1);
    this.sunHalo.position.set(-740, 140, 190);
    scene.add(this.sunHalo);
  }

  /** Keep the sun centred on the player so shadows stay crisp nearby. */
  follow(x, z) {
    this.sun.position.set(x - 230, 120, z + 75);
    this.sun.target.position.set(x, 0, z);
    this.sun.target.updateMatrixWorld();
    // The dome and sun travel with the player so the horizon never runs out.
    this.dome.position.set(x, 0, z);
    this.sunDisc.position.set(x - 740, 140, z + 190);
    this.sunHalo.position.set(x - 740, 140, z + 190);
  }
}
