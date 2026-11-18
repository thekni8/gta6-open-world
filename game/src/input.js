/* Keyboard + mouse input. Tracks held keys, edge-triggered presses,
   mouse orbit drag, and click-to-shoot. */
(function () {
  const keys = {};
  const pressed = {};          // true only on the frame the key went down
  let mouseDX = 0, mouseDY = 0;
  let dragging = false, lastX = 0, lastY = 0;
  let mouseDown = false, mouseClicked = false;

  window.addEventListener('keydown', function (e) {
    if (e.repeat) return;
    keys[e.code] = true;
    pressed[e.code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown'].indexOf(e.code) >= 0) e.preventDefault();
  });
  window.addEventListener('keyup', function (e) { keys[e.code] = false; });
  window.addEventListener('blur', function () {
    for (const k in keys) keys[k] = false;
    dragging = false; mouseDown = false;
  });
  window.addEventListener('mousedown', function (e) {
    if (e.target.closest('button') || e.target.closest('.menu-panel')) return;
    mouseDown = true; mouseClicked = true;
    dragging = true; lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('mouseup', function () { mouseDown = false; dragging = false; });
  window.addEventListener('mousemove', function (e) {
    if (!dragging) return;
    mouseDX += e.clientX - lastX;
    mouseDY += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
  });

  MB.Input = {
    isDown: function (code) { return !!keys[code]; },
    wasPressed: function (code) { return !!pressed[code]; },
    mouseDelta: function () { const d = { x: mouseDX, y: mouseDY }; mouseDX = 0; mouseDY = 0; return d; },
    isMouseDown: function () { return mouseDown; },
    wasClicked: function () { return mouseClicked; },
    // Forward/back/left/right as -1..1, for feet and wheels alike.
    axes: function () {
      let f = 0, s = 0;
      if (keys['KeyW'] || keys['ArrowUp']) f += 1;
      if (keys['KeyS'] || keys['ArrowDown']) f -= 1;
      if (keys['KeyA'] || keys['ArrowLeft']) s -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) s += 1;
      return { forward: f, strafe: s };
    },
    endFrame: function () {
      for (const k in pressed) pressed[k] = false;
      mouseClicked = false;
    },
    // Test/scenario helper: pretend a key is held.
    setKey: function (code, down) { keys[code] = down; if (down) pressed[code] = true; },
  };
})();
