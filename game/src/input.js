// Keyboard + mouse handling. Tracks held keys, edge-triggered presses,
// mouse look deltas and mouse buttons. Pointer lock is requested on the
// canvas while playing and released in menus.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.locked = false;
    this.onLockChange = null; // (locked) => void; Esc exits lock without a keydown

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      this.keys.add(k);
      this.pressed.add(k);
      if ([' ', 'arrowup', 'arrowdown'].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      this.onLockChange?.(this.locked);
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
        this.mouseClicked = true;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  lock() {
    if (this.locked) return;
    try {
      const p = this.canvas.requestPointerLock?.();
      // Headless / gesture-less lock attempts reject; that is fine.
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch {
      // Pointer lock unavailable; mouse look still works via drag-free deltas.
    }
  }

  unlock() {
    if (this.locked) document.exitPointerLock?.();
  }

  isDown(key) {
    return this.keys.has(key.toLowerCase());
  }

  // True once, on the frame the key went down.
  wasPressed(key) {
    return this.pressed.has(key.toLowerCase());
  }

  // WASD as a -1..1 pair, forward positive.
  moveAxes() {
    const f = (this.isDown('w') ? 1 : 0) - (this.isDown('s') ? 1 : 0);
    const s = (this.isDown('d') ? 1 : 0) - (this.isDown('a') ? 1 : 0);
    return { forward: f, strafe: s };
  }

  consumeLook() {
    const dx = this.mouseDX;
    const dy = this.mouseDY;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { dx, dy };
  }

  endFrame() {
    this.pressed.clear();
    this.mouseClicked = false;
  }
}

// Meridian Bay round 9 — witness touch
