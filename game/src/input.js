// Keyboard and mouse. The game never reads raw DOM events — it polls
// this once per frame for held keys, fresh presses, click edges, and the
// camera orbit deltas. Pointer lock drives the mouse when the browser
// grants it; dragging is the fallback for headless or no-lock browsers.

const SCROLL_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'Tab']);

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.held = new Set();
    this.fresh = new Set(); // codes pressed since the last poll()
    this.orbitX = 0; // accumulated mouse deltas since the last poll()
    this.orbitY = 0;
    this.clicked = false; // left button pressed since the last poll()
    this.locked = false;
    this.dragging = false;
    this.dragX = 0;
    this.dragY = 0;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.held.add(e.code);
      this.fresh.add(e.code);
      if (SCROLL_KEYS.has(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.held.delete(e.code));
    window.addEventListener('blur', () => {
      this.held.clear();
      this.dragging = false;
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this.clicked = true;
      this.dragging = true;
      this.dragX = e.clientX;
      this.dragY = e.clientY;
      if (!this.locked) canvas.requestPointerLock?.();
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.dragging = false;
    });
    window.addEventListener('mousemove', (e) => {
      if (this.locked) {
        this.orbitX += e.movementX;
        this.orbitY += e.movementY;
      } else if (this.dragging) {
        this.orbitX += e.clientX - this.dragX;
        this.orbitY += e.clientY - this.dragY;
        this.dragX = e.clientX;
        this.dragY = e.clientY;
      }
    });
  }

  down(code) {
    return this.held.has(code);
  }

  /** WASD/arrows as a -1..1 pair in camera space (x = strafe, y = forward). */
  moveAxis() {
    let x = 0;
    let y = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) y += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    return { x, y };
  }

  sprinting() {
    return this.down('ShiftLeft') || this.down('ShiftRight');
  }

  /** Consume this frame's edges and mouse deltas. Call once per tick. */
  poll() {
    const frame = {
      pressed: this.fresh,
      clicked: this.clicked,
      dx: this.orbitX,
      dy: this.orbitY,
    };
    this.fresh = new Set();
    this.clicked = false;
    this.orbitX = 0;
    this.orbitY = 0;
    return frame;
  }
}
