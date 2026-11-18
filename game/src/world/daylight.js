// Golden-hour light over Meridian Bay: a low warm sun that throws long
// shadows, a gradient sky dome (blue overhead melting into peach at the
// horizon), a visible sun disc hanging over the sea, and warm haze so the
// far city melts into the afternoon instead of flat blue.

import * as THREE from 'three';
import { CONFIG } from '../config.js';

function skyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#4f9fd8'); // deep blue overhead
  grad.addColorStop(0.45, '#8ec3e8'); // afternoon blue
  grad.addColorStop(0.72, '#f7c98d'); // warm horizon band
  grad.addColorStop(0.85, '#ffb066'); // low golden glow
  grad.addColorStop(1.0, '#e89a5a'); // below the horizon
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255, 236, 180, 1)');
  grad.addColorStop(0.25, 'rgba(255, 190, 110, 0.9)');
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
    scene.fog = new THREE.Fog(CONFIG.palette.fog, 150, 560);

    // Gradient sky dome, far enough to sit behind the whole city.
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(850, 24, 16),
      new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false, depthWrite: false }),
    );
    dome.renderOrder = -10;
    scene.add(dome);
    this.dome = dome;

    // Low sun, warm and strong: long shadows across the streets.
    this.sun = new THREE.DirectionalLight(CONFIG.palette.sun, 3.1);
    this.sun.position.set(-220, 115, 70);
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

    // Warm sky fill, cooler ground bounce.
    const hemi = new THREE.HemisphereLight(0xffd9b0, 0x6a5a48, 0.75);
    scene.add(hemi);
    this.hemi = hemi;

    // Sun disc + halo hanging low over the sea to the west.
    const glow = glowTexture();
    this.sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, fog: false, depthWrite: false, transparent: true }));
    this.sunDisc.scale.set(190, 190, 1);
    this.sunDisc.position.set(-720, 135, 180);
    scene.add(this.sunDisc);
    this.sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, fog: false, depthWrite: false, transparent: true, opacity: 0.35 }));
    this.sunHalo.scale.set(320, 320, 1);
    this.sunHalo.position.set(-720, 135, 180);
    scene.add(this.sunHalo);
  }

  /** Keep the sun centred on the player so shadows stay crisp nearby. */
  follow(x, z) {
    this.sun.position.set(x - 220, 115, z + 70);
    this.sun.target.position.set(x, 0, z);
    this.sun.target.updateMatrixWorld();
    // The dome and sun disc travel with the player so the horizon never runs out.
    this.dome.position.set(x, 0, z);
    this.sunDisc.position.set(x - 720, 135, z + 180);
    this.sunHalo.position.set(x - 720, 135, z + 180);
  }
}
