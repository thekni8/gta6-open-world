// The HUD: health, cash, wanted stars, the weapon badge, ammo, speed,
// the mission objective pill, toasts, the district label, the controls
// bar, the [E] prompt and floating damage numbers. Everything sits on
// soft dark containers so it reads against bright sky and light road.

export class HUD {
  constructor(camera, renderer) {
    this.camera = camera;
    this.renderer = renderer;
    this.el = {};
    for (const id of [
      'hud', 'hp-fill', 'hp-text', 'cash-text', 'stars',
      'obj-title', 'obj-text', 'obj-progress', 'objective-pill',
      'toasts', 'district-name', 'district-sub',
      'weapon-icon', 'weapon-name', 'ammo-text', 'reserve-text',
      'speed-text', 'speed-box', 'crosshair', 'prompt', 'prompt-key',
      'prompt-text', 'damage-layer', 'damage-flash', 'controls-bar',
      'kills-text',
    ]) {
      this.el[id] = document.getElementById(id);
    }
    this.damageNumbers = [];
    this.projector = new THREE.Vector3();
  }

  show() {
    this.el.hud.style.display = 'block';
  }

  hide() {
    this.el.hud.style.display = 'none';
  }

  setState(s) {
    const hpFrac = Math.max(0, s.hp / 100);
    this.el['hp-fill'].style.width = `${hpFrac * 100}%`;
    this.el['hp-fill'].style.background = hpFrac > 0.5 ? '#51d96a' : hpFrac > 0.25 ? '#f2c230' : '#e84a4a';
    this.el['hp-text'].textContent = `HP ${Math.ceil(s.hp)}`;
    this.el['cash-text'].textContent = `$${s.cash.toLocaleString('en-US')}`;
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < s.stars ? '★' : '☆';
    this.el.stars.textContent = stars;
    this.el.stars.classList.toggle('wanted', s.stars > 0);
    this.el['weapon-icon'].textContent = s.weaponIcon;
    this.el['weapon-name'].textContent = s.weaponName;
    this.el['ammo-text'].textContent = `${s.ammo} / ${s.mag}`;
    this.el['reserve-text'].textContent = `· ${s.reserve}`;
    this.el['kills-text'].textContent = s.kills > 0 ? `☠ ${s.kills}` : '';
    if (s.driving) {
      this.el['speed-box'].style.display = 'block';
      this.el['speed-text'].textContent = `${Math.round(s.speedKmh)}`;
    } else {
      this.el['speed-box'].style.display = 'none';
    }
    this.el.crosshair.style.display = s.driving ? 'none' : 'block';
  }

  setObjective(title, text, progress = '') {
    this.el['objective-pill'].style.display = title ? 'block' : 'none';
    this.el['obj-title'].textContent = title || '';
    this.el['obj-text'].textContent = text || '';
    this.el['obj-progress'].textContent = progress || '';
  }

  setDistrict(name, sub = '') {
    this.el['district-name'].textContent = name;
    this.el['district-sub'].textContent = sub;
  }

  clearToasts() {
    this.el.toasts.innerHTML = '';
  }

  toast(title, text, ms = 4200) {
    const div = document.createElement('div');
    div.className = 'toast';
    div.innerHTML = `<div class="toast-title"></div><div class="toast-text"></div>`;
    div.querySelector('.toast-title').textContent = title;
    div.querySelector('.toast-text').textContent = text;
    this.el.toasts.appendChild(div);
    while (this.el.toasts.children.length > 3) this.el.toasts.removeChild(this.el.toasts.firstChild);
    setTimeout(() => {
      div.classList.add('toast-out');
      setTimeout(() => div.remove(), 500);
    }, ms);
  }

  showPrompt(key, text, screenX, screenY) {
    const p = this.el.prompt;
    p.style.display = 'flex';
    p.style.left = `${screenX}px`;
    p.style.top = `${screenY}px`;
    this.el['prompt-key'].textContent = key;
    this.el['prompt-text'].textContent = text;
  }

  hidePrompt() {
    this.el.prompt.style.display = 'none';
  }

  flashDamage() {
    const f = this.el['damage-flash'];
    f.style.opacity = '0.45';
    setTimeout(() => { f.style.opacity = '0'; }, 120);
  }

  damageNumber(worldPos, amount) {
    const div = document.createElement('div');
    div.className = 'damage-number';
    div.textContent = `-${amount}`;
    this.el['damage-layer'].appendChild(div);
    this.damageNumbers.push({ el: div, pos: worldPos.clone(), life: 0.9 });
  }

  // Project a world point to screen pixels. Returns null behind camera.
  project(worldPos) {
    this.projector.copy(worldPos).project(this.camera);
    if (this.projector.z > 1) return null;
    const w = this.renderer.domElement.clientWidth;
    const h = this.renderer.domElement.clientHeight;
    return {
      x: (this.projector.x * 0.5 + 0.5) * w,
      y: (-this.projector.y * 0.5 + 0.5) * h,
    };
  }

  update(dt) {
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const d = this.damageNumbers[i];
      d.life -= dt;
      if (d.life <= 0) {
        d.el.remove();
        this.damageNumbers.splice(i, 1);
        continue;
      }
      const p = this.project(d.pos);
      if (!p) {
        d.el.style.display = 'none';
        continue;
      }
      d.el.style.display = 'block';
      const rise = (0.9 - d.life) * 46;
      d.el.style.left = `${p.x}px`;
      d.el.style.top = `${p.y - rise}px`;
      d.el.style.opacity = String(Math.min(1, d.life / 0.35));
    }
  }
}

// Meridian Bay round 9 — witness touch
