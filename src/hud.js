// DOM HUD: status numbers, wave banner, damage flash, menu overlays.
export class HUD {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      health: document.getElementById('health'),
      ammo: document.getElementById('ammo'),
      weaponName: document.getElementById('weapon-name'),
      wave: document.getElementById('wave'),
      kills: document.getElementById('kills'),
      sentryCount: document.getElementById('sentry-count'),
      reloadHint: document.getElementById('reload-hint'),
      dashFill: document.getElementById('dash-fill'),
      banner: document.getElementById('banner'),
      flash: document.getElementById('flash'),
      hurtVignette: document.getElementById('hurt-vignette'),
      menu: document.getElementById('menu'),
      pause: document.getElementById('pause'),
      gameover: document.getElementById('gameover'),
      goStats: document.getElementById('go-stats'),
      crosshair: document.getElementById('crosshair'),
    };
    this.bannerTimer = 0;
  }

  showOverlay(name) {
    for (const k of ['menu', 'pause', 'gameover']) {
      this.el[k].classList.toggle('hidden', k !== name);
    }
    const inGame = name === null;
    this.el.hud.style.visibility = inGame ? 'visible' : 'hidden';
    this.el.crosshair.style.display = inGame ? 'block' : 'none';
  }

  banner(text) {
    this.el.banner.textContent = text;
    this.el.banner.style.opacity = 1;
    this.bannerTimer = 2.2;
  }

  damageFlash() {
    this.el.flash.style.transition = 'none';
    this.el.flash.style.opacity = 0.45;
    requestAnimationFrame(() => {
      this.el.flash.style.transition = 'opacity 0.35s';
      this.el.flash.style.opacity = 0;
    });
  }

  setGameOver(wave, kills, score) {
    this.el.goStats.innerHTML =
      `SURVIVED TO WAVE <b>${wave}</b><br>` +
      `<b>${kills}</b> DEMONS SLAIN &mdash; SCORE <b>${score}</b>`;
  }

  update(dt, { health, ammoText, weaponName, wave, kills, dashFrac, sentryCount, reloading }) {
    this.el.health.textContent = health;
    this.el.health.classList.toggle('low', health <= 30);
    this.el.ammo.innerHTML = ammoText;
    this.el.weaponName.textContent = weaponName;
    this.el.wave.textContent = wave;
    this.el.kills.textContent = kills;
    this.el.sentryCount.textContent = sentryCount;
    this.el.sentryCount.classList.toggle('ready', sentryCount > 0);
    this.el.reloadHint.style.opacity = reloading ? 1 : 0;
    this.el.dashFill.style.width = `${Math.round(dashFrac * 100)}%`;
    this.el.dashFill.style.background = dashFrac >= 1 ? 'var(--ember)' : 'var(--rust)';
    this.el.hurtVignette.style.opacity = health <= 35 ? 0.5 + 0.5 * (1 - health / 35) : 0;

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.el.banner.style.opacity = 0;
    }
  }
}
