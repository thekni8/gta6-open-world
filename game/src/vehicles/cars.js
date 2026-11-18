// Cars: low-poly box models (sedan, taxi, sports, truck, police), arcade
// driving physics with handbrake slides, damage smoke, and headlights.
// One factory builds every car in the game — player, traffic, and police.
import { CFG } from '../config.js';
import { clamp } from '../util/random.js';

const bodyGeo = new THREE.BoxGeometry(2, 0.85, 4.4);
const cabinGeo = new THREE.BoxGeometry(1.7, 0.7, 2.2);
const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 10);
const lightGeo = new THREE.BoxGeometry(0.4, 0.24, 0.12);
const barGeo = new THREE.BoxGeometry(1.4, 0.22, 0.5);

const glassMat = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
const tyreMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c0 });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
const bodyMats = {};
function bodyMaterial(colorHex) {
  if (!bodyMats[colorHex]) bodyMats[colorHex] = new THREE.MeshLambertMaterial({ color: colorHex });
  return bodyMats[colorHex];
}

export function buildCarMesh(type, colorHex) {
  const g = new THREE.Group();
  const bodyMat = bodyMaterial(colorHex);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.75;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(cabinGeo, glassMat);
  cabin.position.set(0, 1.45, type === 'truck' ? 0.9 : -0.15);
  cabin.castShadow = true;
  g.add(cabin);
  if (type === 'truck') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.6, 1.8), bodyMat);
    bed.position.set(0, 1.25, -1.2);
    bed.castShadow = true;
    g.add(bed);
  }
  if (type === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.28, 0.4), new THREE.MeshBasicMaterial({ color: 0xffe93a }));
    sign.position.set(0, 1.95, -0.15);
    g.add(sign);
  }
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, tyreMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    g.add(w);
    wheels.push(w);
  }
  const hl = new THREE.Mesh(lightGeo, headMat);
  hl.position.set(-0.6, 0.75, 2.21);
  const hr = new THREE.Mesh(lightGeo, headMat);
  hr.position.set(0.6, 0.75, 2.21);
  const tl = new THREE.Mesh(lightGeo, tailMat);
  tl.position.set(-0.6, 0.75, -2.21);
  const tr = new THREE.Mesh(lightGeo, tailMat);
  tr.position.set(0.6, 0.75, -2.21);
  g.add(hl, hr, tl, tr);
  let lightBar = null;
  if (type === 'police') {
    lightBar = new THREE.Group();
    const r = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    r.position.x = -0.36;
    const b = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    b.position.x = 0.36;
    lightBar.add(r, b);
    lightBar.position.set(0, 1.92, -0.15);
    g.add(lightBar);
  }
  g.userData.wheels = wheels;
  g.userData.lightBar = lightBar;
  g.traverse((o) => { o.userData.isCar = true; });
  return g;
}

export function createCar(scene, { type = 'sedan', color = 0xd84040, x = 0, z = 0, heading = 0, role = 'parked' } = {}) {
  const group = buildCarMesh(type, color);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  scene.add(group);
  return {
    group, type, color, role,
    heading, speed: 0,
    health: 100,
    smoking: false,
    lightsOn: false,
    steerVisual: 0,
    get x() { return group.position.x; },
    get z() { return group.position.z; },
    setPos(x, z) { group.position.x = x; group.position.z = z; },
    setHeading(h) { this.heading = h; group.rotation.y = h; },
  };
}

// Arcade driving: accelerate / brake / reverse / handbrake turn. Collisions
// against buildings stop the car with a thud; car-car hits are resolved by
// the caller. Returns true when a building was hit this frame.
export function driveCar(car, city, input, dt, fx) {
  const a = input.axis();
  const hb = input.handbrake();
  const maxF = car.type === 'sports' ? CFG.carMaxSpeed * 1.25 : car.type === 'truck' ? CFG.carMaxSpeed * 0.8 : CFG.carMaxSpeed;
  if (a.f > 0) car.speed += CFG.carAccel * (car.type === 'sports' ? 1.3 : 1) * dt;
  else if (a.f < 0) {
    if (car.speed > 0.5) car.speed -= CFG.carBrake * dt;
    else car.speed -= CFG.carReverse * dt;
  } else {
    car.speed -= car.speed * CFG.carDrag * dt;
    if (Math.abs(car.speed) < 0.15) car.speed = 0;
  }
  car.speed = clamp(car.speed, -CFG.carMaxReverse, maxF);
  if (hb) car.speed -= car.speed * 1.6 * dt;

  const dir = car.speed >= 0 ? 1 : -1;
  const turnRate = (hb ? CFG.handbrakeTurn : CFG.carTurn) * clamp(Math.abs(car.speed) / 12, 0, 1);
  car.heading += a.s * turnRate * dir * dt;
  car.setHeading(car.heading);

  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const fixed = city.resolveCircle(nx, nz, CFG.carRadius);
  const hitWall = Math.abs(fixed.x - nx) > 0.01 || Math.abs(fixed.z - nz) > 0.01;
  if (hitWall) {
    if (Math.abs(car.speed) > 8) {
      fx?.crash(fixed.x, fixed.z, Math.abs(car.speed));
      car.health = Math.max(0, car.health - Math.abs(car.speed) * 0.9);
    }
    car.speed *= -0.25;
  }
  car.setPos(fixed.x, fixed.z);
  if (hb && Math.abs(car.speed) > 10) fx?.skid(car.x, car.z, car.heading);
  // Wheel spin + front-wheel steer look
  const wheels = car.group.userData.wheels;
  for (let i = 0; i < wheels.length; i++) {
    wheels[i].rotation.x += (car.speed * dt) / 0.42;
    if (i < 2) wheels[i].rotation.y = a.s * 0.4;
  }
  return hitWall;
}

export function carSpeedKmh(car) {
  return Math.round(Math.abs(car.speed) * 3.6);
}
