// Keyboard + mouse input. Tracks held keys, edge-triggered presses, mouse
// orbit deltas (pointer lock when available, arrow keys as fallback), and
// the fire button. The game loop consumes presses each frame.
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let mouseDX = 0, mouseDY = 0;
  let mouseDown = false, mouseClicked = false;
  let locked = false;

  const onKeyDown = (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    pressed.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  };
  const onKeyUp = (e) => keys.delete(e.code);
  const onMouseMove = (e) => {
    if (document.pointerLockElement === canvas) {
      mouseDX += e.movementX;
      mouseDY += e.movementY;
    }
  };
  const onMouseDown = (e) => {
    if (e.button === 0) { mouseDown = true; mouseClicked = true; }
  };
  const onMouseUp = (e) => { if (e.button === 0) mouseDown = false; };
  const onLockChange = () => { locked = document.pointerLockElement === canvas; };
  const onBlur = () => { keys.clear(); mouseDown = false; };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  document.addEventListener('pointerlockchange', onLockChange);
  window.addEventListener('blur', onBlur);

  canvas.addEventListener('click', () => {
    if (document.pointerLockElement !== canvas) {
      canvas.requestPointerLock?.();
    }
  });

  return {
    isDown(code) { return keys.has(code); },
    wasPressed(code) { return pressed.has(code); },
    axis() {
      // -1..1 forward / strafe from WASD + arrows
      const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      const s = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
      return { f, s };
    },
    sprint() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    handbrake() { return keys.has('Space'); },
    firing() { return mouseDown; },
    clicked() { return mouseClicked; },
    consumeMouse() { const d = { dx: mouseDX, dy: mouseDY }; mouseDX = 0; mouseDY = 0; return d; },
    orbitKeys() {
      return (keys.has('ArrowLeft') ? 1 : 0) - (keys.has('ArrowRight') ? 1 : 0);
    },
    isLocked() { return locked; },
    releaseLock() { if (document.pointerLockElement) document.exitPointerLock(); },
    clear() { pressed.clear(); mouseClicked = false; mouseDown = false; },
    endFrame() { pressed.clear(); mouseClicked = false; },
  };
}
