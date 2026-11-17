// Keyboard + mouse handling. Tracks held keys, click edges, and the camera
// orbit deltas (pointer lock when available, drag fallback for headless or
// no-lock browsers). The game reads this, never raw DOM events.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set(); // keys pressed since last poll()
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.mouseClicked = false; // left button pressed since last poll()
    this.locked = false;
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
        this.mouseClicked = true;
        this.dragging = true;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        if (!this.locked && document.pointerLockElement !== canvas) {
          canvas.requestPointerLock?.();
        }
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.mouseDown = false;
        this.dragging = false;
      }
    });
    window.addEventListener('mousemove', (e) => {
      if (this.locked) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      } else if (this.dragging) {
        this.mouseDX += e.clientX - this.lastX;
        this.mouseDY += e.clientY - this.lastY;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
      }
    });
  }

  down(code) {
    return this.keys.has(code);
  }

  /** True once per physical press; consumed by poll(). */
  wasPressed(code) {
    return this.pressed.has(code);
  }

  /** WASD/arrows as a -1..1 pair, in camera space (x = strafe, y = forward). */
  moveAxis() {
    let x = 0;
    let y = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) y += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    return { x, y };
  }

  /** Consume this frame's edges and mouse deltas. Call once per tick. */
  poll() {
    const out = {
      pressed: this.pressed,
      clicked: this.mouseClicked,
      dx: this.mouseDX,
      dy: this.mouseDY,
    };
    this.pressed = new Set();
    this.mouseClicked = false;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return out;
  }
}
