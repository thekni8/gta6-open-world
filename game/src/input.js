// Keyboard + mouse input, with edge-triggered "pressed" events.
// The game loop reads held keys every frame and consumes pressed keys once,
// so a single tap of E never enters and exits a car in the same frame.

export class Input {
  constructor() {
    this.held = new Set();
    this.pressedQueue = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.mousePressed = false;
    this.rightDown = false;
    this.pointerLocked = false;
    this.canvas = null;
    this.onAnyKey = null;
  }

  attach(canvas) {
    this.canvas = canvas;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.held.add(e.code);
      this.pressedQueue.add(e.code);
      if (this.onAnyKey) this.onAnyKey();
      if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.held.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.held.clear();
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
    });
    document.addEventListener('mousemove', (e) => {
      if (this.pointerLocked) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
        this.mousePressed = true;
      }
      if (e.button === 2) this.rightDown = true;
      if (this.onAnyKey) this.onAnyKey();
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
      if (e.button === 2) this.rightDown = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  requestPointerLock() {
    if (this.canvas && !this.pointerLocked) {
      try {
        this.canvas.requestPointerLock();
      } catch (_) {
        // Pointer lock is a nicety; the camera also turns with Q/E and drag.
      }
    }
  }

  exitPointerLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  isDown(code) {
    return this.held.has(code);
  }

  // True once, on the frame the key went down.
  pressed(code) {
    if (this.pressedQueue.has(code)) {
      this.pressedQueue.delete(code);
      return true;
    }
    return false;
  }

  consumeMouse() {
    const dx = this.mouseDX;
    const dy = this.mouseDY;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { dx, dy };
  }

  consumeMousePressed() {
    const p = this.mousePressed;
    this.mousePressed = false;
    return p;
  }

  // Called at the end of each frame: anything not consumed is dropped.
  endFrame() {
    this.pressedQueue.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
  }
}
