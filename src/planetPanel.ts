import { PLANET_INFO } from './constants/planetInfo';
import { PLANETS_DATA } from './constants/planetsData';
import { MOONS_DATA, MOON_ORBIT_EPOCH } from './constants/moonsData';
import moonTextureCredits from './constants/moonTextureCredits.json';
import { BODY_CATALOG } from './catalog';
import { bodyAvatar, icon } from './uiVisuals';
import { AU_SCALE, getMeanAnomaly, getOrbitalSpeedKmS, getPlanetPosition } from './utils/orbitPhysics';
import { getMoonMeanAnomaly, getMoonPositionKm, getMoonSpeedKmS } from './utils/moonOrbits';
import type { BodyId, SimulationState } from './types/types';

export function createPlanetPanel(state: SimulationState, signal: AbortSignal, onVisibilityChange: (open: boolean) => void = () => {}) {
  const tooltip = document.createElement('div');
  tooltip.className = 'planet-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  const panel = document.createElement('aside');
  panel.className = 'planet-panel glass-panel';
  panel.setAttribute('aria-labelledby', 'planet-panel-title');
  panel.setAttribute('aria-hidden', 'true');
  panel.inert = true;
  const closeButton = document.createElement('button');
  closeButton.className = 'planet-panel-close icon-button';
  closeButton.innerHTML = icon('close');
  closeButton.setAttribute('aria-label', 'Закрыть карточку объекта');
  const content = document.createElement('div');
  content.className = 'planet-panel-content';
  content.tabIndex = 0;
  content.setAttribute('aria-label', 'Сведения об объекте');
  panel.append(closeButton, content);
  document.body.append(tooltip, panel);
  let current: BodyId | null = null;
  let returnFocus: HTMLElement | null = null;
  let lastDays = NaN;

  function close(restoreFocus = true) {
    if (!current) return;
    current = null;
    document.body.classList.remove('panel-open');
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    panel.inert = true;
    onVisibilityChange(false);
    if (restoreFocus) returnFocus?.focus({ preventScroll: true });
  }

  const format = (value: number, decimals: number) => value.toLocaleString('ru', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  function update() {
    if (!current || lastDays === state.simDays) return;
    lastDays = state.simDays;
    const data = PLANETS_DATA.find(planet => planet.name === current);
    const moon = MOONS_DATA.find(moon => moon.name === current);
    if (!data && !moon) return;
    const distance = data ? getPlanetPosition(data, state.simDays).length() / AU_SCALE : getMoonPositionKm(moon!, state.simDays).length();
    const anomaly = data ? getMeanAnomaly(data, state.simDays) : getMoonMeanAnomaly(moon!, state.simDays);
    const values = {
      distance: format(distance, moon ? 0 : 3),
      anomaly: format(((anomaly * 180 / Math.PI) + 360) % 360, 1),
      speed: format(data ? getOrbitalSpeedKmS(data, distance) : getMoonSpeedKmS(moon!, distance), moon ? 3 : 2),
    };
    for (const [key, value] of Object.entries(values)) {
      const target = content.querySelector('[data-orbit="' + key + '"]');
      if (target) target.textContent = value;
    }
  }

  function activateTab(name: string, focus = false) {
    content.querySelectorAll<HTMLButtonElement>('[data-panel-tab]').forEach(button => {
      const selected = button.dataset.panelTab === name;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
      if (selected && focus) button.focus();
    });
    content.querySelectorAll<HTMLElement>('[data-panel-content]').forEach(section => { section.hidden = section.dataset.panelContent !== name; });
  }

  function open(id: BodyId, keyboard = false) {
    const active = document.activeElement;
    if (active instanceof HTMLElement && !panel.contains(active)) returnFocus = active;
    current = id;
    document.body.classList.add('panel-open');
    lastDays = NaN;
    const info = PLANET_INFO[id];
    const data = PLANETS_DATA.find(planet => planet.name === id);
    const moon = MOONS_DATA.find(moon => moon.name === id);
    const hasOrbit = Boolean(data || moon);
    const orbitRows = data ? [
      ['Большая полуось', format(data.a, 3) + ' а.е.'], ['Эксцентриситет', format(data.e, 4)],
      ['Наклон орбиты', format(data.i, 2) + '°'], ['Период обращения', format(data.period, 1) + ' сут.'],
    ] : moon ? [
      ['Большая полуось', format(moon.semiMajorAxisKm, 0) + ' км'], ['Эксцентриситет', format(moon.eccentricity, 5)],
      ['Наклон к эклиптике', format(moon.inclination, 3) + '°'], ['Восходящий узел', format(moon.ascendingNode, 2) + '°'],
      ['Аргумент перицентра', format(moon.argumentOfPeriapsis, 2) + '°'], ['Оскулирующий период', format(moon.period, 5) + ' сут.'],
    ] : [];
    const kind = BODY_CATALOG.find(body => body.id === id)!.kind;
    const kindLabel = { star: 'ЗВЕЗДА', planet: 'ПЛАНЕТА', dwarf: 'КАРЛИКОВАЯ ПЛАНЕТА', moon: 'СПУТНИК' }[kind];
    const texture = moonTextureCredits.find(source => source.id === id);
    content.innerHTML = `
      <div class="card-topline"><span class="eyebrow">В ФОКУСЕ</span><span class="object-kind">${kindLabel}</span></div>
      <div class="planet-panel-header">
        <div class="planet-title-group"><h2 class="planet-panel-name" id="planet-panel-title">${info.nameRu}</h2><p class="planet-panel-type">${info.type}</p></div>
        ${bodyAvatar(id, 'planet-avatar-large')}
      </div>
      ${hasOrbit ? `<div class="object-tabs" role="tablist" aria-label="Сведения об объекте">
        <button id="facts-tab" role="tab" aria-controls="object-facts" aria-selected="true" data-panel-tab="facts">Характеристики</button>
        <button id="orbit-tab" role="tab" aria-controls="object-orbit" aria-selected="false" tabindex="-1" data-panel-tab="orbit">Орбита</button>
      </div>` : '<div class="panel-subheading eyebrow">ХАРАКТЕРИСТИКИ</div>'}
      <section id="object-facts" ${hasOrbit ? 'role="tabpanel" aria-labelledby="facts-tab"' : 'aria-label="Характеристики"'} data-panel-content="facts">
        <dl class="planet-highlights">
          <div class="highlight-stat"><dt>Диаметр</dt><dd>${info.diameter}<small>км</small></dd></div>
          <div class="highlight-stat"><dt>Гравитация</dt><dd>${info.gravity}<small>м/с²</small></dd></div>
        </dl>
        <dl class="planet-stats">
          ${[
            ['Масса', info.mass + ' кг'], ['Длина суток', info.dayLength + ' зем. сут.'],
            ['Спутники', String(info.moons)], ['Температура', info.avgTemp + ' °C'],
          ].map(([label, value]) => '<div class="stat-row"><dt class="stat-label">' + label + '</dt><dd class="stat-value">' + value + '</dd></div>').join('')}
          <div class="atmosphere-stat"><dt class="stat-label">Атмосфера</dt><dd class="stat-value">${info.atmosphere}</dd></div>
        </dl>
        <details class="planet-description"><summary><span>Об объекте</span>${icon('down')}</summary><p class="planet-panel-desc">${info.description}</p></details>
        ${texture ? `<details class="planet-description"><summary><span>О текстуре</span>${icon('down')}</summary><p class="planet-panel-desc">${texture.note}<br><a href="${texture.page}" target="_blank" rel="noopener noreferrer">${texture.credit}</a></p></details>` : ''}
      </section>
      ${hasOrbit ? `<section id="object-orbit" role="tabpanel" aria-labelledby="orbit-tab" data-panel-content="orbit" hidden>
        <div class="orbit-live-label"><span class="status-dot"></span>Сейчас в симуляции</div>
        <dl class="orbit-highlights">
          <div class="highlight-stat"><dt>${moon ? 'От планеты' : 'От Солнца'}</dt><dd><span data-orbit="distance"></span><small>${moon ? 'км' : 'а.е.'}</small></dd></div>
          <div class="highlight-stat"><dt>Скорость</dt><dd><span data-orbit="speed"></span><small>км/с</small></dd></div>
        </dl>
        <dl class="orbit-params">
          <div class="orbit-row"><dt>Средняя аномалия</dt><dd><span data-orbit="anomaly"></span>°</dd></div>
          ${orbitRows.map(([label, value]) => '<div class="orbit-row"><dt>' + label + '</dt><dd>' + value + '</dd></div>').join('')}
        </dl>
        ${moon ? '<p class="planet-panel-desc">Элементы <a href="https://ssd.jpl.nasa.gov/horizons/" target="_blank" rel="noopener noreferrer">JPL Horizons</a> на ' + new Date(MOON_ORBIT_EPOCH).toLocaleDateString('ru-RU', { timeZone: 'UTC' }) + '. Кеплеровское приближение без прецессии и возмущений.</p>' : ''}
      </section>` : ''}
      <div class="model-note">${icon('orbit')}<p><span class="model-scale-illustrative">Размеры и расстояния изменены для наглядности.</span><span class="model-scale-real">Средние размеры и расстояния в едином масштабе.</span><br>Орбиты и текстуры — приближённая модель.</p></div>
    `;
    content.scrollTop = 0;
    panel.inert = false;
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    onVisibilityChange(true);
    update();
    if (keyboard) requestAnimationFrame(() => {
      if (!signal.aborted && current === id) closeButton.focus({ preventScroll: true });
    });
  }

  content.addEventListener('click', event => {
    const tab = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-panel-tab]') : null;
    if (tab) activateTab(tab.dataset.panelTab!);
  }, { signal });
  content.addEventListener('keydown', event => {
    if (!(event.target instanceof HTMLElement) || !event.target.matches('[data-panel-tab]') || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const currentTab = event.target.dataset.panelTab;
    activateTab(event.key === 'Home' ? 'facts' : event.key === 'End' ? 'orbit' : currentTab === 'facts' ? 'orbit' : 'facts', true);
  }, { signal });
  closeButton.addEventListener('click', () => close(), { signal });
  window.addEventListener('keydown', event => { if (event.key === 'Escape' && current) { event.preventDefault(); close(); } }, { signal });
  return {
    element: panel, open, close, update,
    showTooltip(id: BodyId, x: number, y: number, orbit = false) {
      tooltip.textContent = (orbit ? 'Орбита: ' : '') + PLANET_INFO[id].nameRu;
      tooltip.classList.add('visible');
      tooltip.style.left = Math.max(8, Math.min(x + 16, window.innerWidth - tooltip.offsetWidth - 8)) + 'px';
      tooltip.style.top = Math.max(8, Math.min(y - 10, window.innerHeight - tooltip.offsetHeight - 8)) + 'px';
    },
    hideTooltip() { tooltip.classList.remove('visible'); },
    dispose() { document.body.classList.remove('panel-open'); tooltip.remove(); panel.remove(); },
  };
}
