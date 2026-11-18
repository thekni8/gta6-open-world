// Keyboard + mouse input. Tracks held keys, just-pressed edges (consumed
// once per frame), mouse deltas for the orbit camera, and pointer lock.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.downKeys = new Set();
    this.pressedKeys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.mousePressed = false;
    this.pointerLocked = false;
    this.enabled = true;

    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (e.code === 'Space') e.preventDefault();
      if (!this.downKeys.has(e.code)) this.pressedKeys.add(e.code);
      this.downKeys.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.downKeys.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.downKeys.clear();
      this.pressedKeys.clear();
    });
    document.addEventListener('mousemove', (e) => {
      if (this.pointerLocked) {
        this.mouseDX += e.movementX || 0;
        this.mouseDY += e.movementY || 0;
      }
    });
    document.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
        this.mousePressed = true;
      }
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
    });
    // Clicking the canvas while playing locks the pointer for mouse-look.
    canvas.addEventListener('click', () => {
      if (this.enabled && this.pointerLockWanted) {
        this._lock();
      }
    });
    this.pointerLockWanted = false;
  }

  _lock() {
    try {
      const p = this.canvas.requestPointerLock();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch {
      /* pointer lock needs a user gesture; the click handler retries */
    }
  }

  down(code) {
    return this.downKeys.has(code);
  }

  pressed(code) {
    return this.pressedKeys.has(code);
  }

  consumeMousePress() {
    const p = this.mousePressed;
    this.mousePressed = false;
    return p;
  }

  // Call once per frame after all systems have read input.
  endFrame() {
    this.pressedKeys.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
  }

  requestLock() {
    this.pointerLockWanted = true;
    if (document.pointerLockElement !== this.canvas) {
      this._lock();
    }
  }

  releaseLock() {
    this.pointerLockWanted = false;
    if (document.exitPointerLock) document.exitPointerLock();
  }
}
