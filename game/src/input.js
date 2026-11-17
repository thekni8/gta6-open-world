// Keyboard + mouse input. Held keys are read every frame; one-shot presses
// (confirm, pause, enter car, reload, map) are queued as bit flags and taken
// once by the loop, so a press between two frames is never lost or double-counted.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_RELOAD = 8;
export const ACTION_MAP = 16;
export const ACTION_HEADLIGHTS = 32;

const FORWARD = new Set(['KeyW', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseDown = false;
  let mouseDownEdge = false;
  let dragDX = 0;
  let dragging = false;
  let lastX = 0;
  let pointerDowns = 0; // debug counter: pointerdown events seen

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Enter' || event.code === 'Space') actions |= ACTION_CONFIRM;
    if (event.code === 'Escape' || event.code === 'KeyP') actions |= ACTION_PAUSE;
    if (event.code === 'KeyE') actions |= ACTION_ENTER_CAR;
    if (event.code === 'KeyR') actions |= ACTION_RELOAD;
    if (event.code === 'KeyM') actions |= ACTION_MAP;
    if (event.code === 'KeyF') actions |= ACTION_HEADLIGHTS;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('pointerdown', (event) => {
    mouseDown = true;
    mouseDownEdge = true;
    pointerDowns += 1;
    dragging = true;
    lastX = event.clientX;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    dragDX += event.clientX - lastX;
    lastX = event.clientX;
  });
  function endDrag() {
    dragging = false;
    mouseDown = false;
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  return {
    /** -1..1 forward throttle (W/S or arrows). */
    throttle() {
      return (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0)
        - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
    },
    /** -1..1 steering (A/D or arrows). */
    steer() {
      return (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0)
        - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    },
    sprint() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    handbrake() {
      return keys.has('Space');
    },
    /** True while the left mouse button is held (shoot / punch). */
    mouseHeld() {
      return mouseDown;
    },
    /** True once, on the frame the mouse button went down. */
    takeMouseClick() {
      const clicked = mouseDownEdge;
      mouseDownEdge = false;
      return clicked;
    },
    /** Horizontal mouse drag since last call, in pixels (orbits the camera). */
    takeDragDX() {
      const dx = dragDX;
      dragDX = 0;
      return dx;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Test helper: pretend a key is held. */
    _press(code) {
      keys.add(code);
    },
    /** Debug counter: pointerdown events seen on the canvas. */
    pointerDowns() {
      return pointerDowns;
    },
  };
}
