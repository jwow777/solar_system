import * as THREE from 'three';
import type { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BODY_CATALOG } from './catalog';
import { simulationDate, DAY_MS, J2000_MS } from './simulation';
import { defaultSettings, savePreferences, type SceneSettings } from './settings';
import { bodyAvatar, bodySubtitle, icon } from './uiVisuals';
import { applyDisplayScale } from './scale';
import type { LoadingStatus } from './textures';
import type { BodyId, SimulationState, SolarSystem, TimeControl } from './types/types';

interface InterfaceOptions {
  system: SolarSystem;
  state: SimulationState;
  settings: SceneSettings;
  bloomPass: UnrealBloomPass;
  renderer: THREE.WebGLRenderer;
  timeControl: TimeControl & { setDays(days: number): void };
  select(id: BodyId, keyboard?: boolean): void;
  overview(): void;
  browse(): void;
  retryTextures(): void;
  onScaleChanged(): void;
  signal: AbortSignal;
}

type Category = 'major' | 'dwarf' | 'moon';
const categories: { id: Category; label: string; group: string }[] = [
  { id: 'major', label: 'Планеты', group: 'Солнце и планеты' },
  { id: 'dwarf', label: 'Карликовые', group: 'Карликовые планеты' },
  { id: 'moon', label: 'Спутники', group: 'Спутники' },
];
const categoryFor = (kind: string): Category => kind === 'moon' ? 'moon' : kind === 'dwarf' ? 'dwarf' : 'major';

export function setupInterface(options: InterfaceOptions) {
  const { system, state, settings, bloomPass, renderer, signal } = options;
  const persist = () => savePreferences(settings, state.timeScale);
  const syncControls: (() => void)[] = [];

  function applySettings() {
    system.sun.light.intensity = settings.sunIntensity;
    system.sun.light.color.set(settings.sunColor);
    system.sun.sprite.material.color.set(settings.bloomTint);
    system.ambientLight.intensity = settings.ambientIntensity;
    renderer.toneMappingExposure = settings.exposure;
    bloomPass.strength = settings.bloomStrength;
    bloomPass.radius = settings.bloomRadius;
    bloomPass.threshold = settings.bloomThreshold;
    applyDisplayScale(system, settings.realisticSizes, settings.planetScale);
    document.body.classList.toggle('realistic-sizes', settings.realisticSizes);
    context.querySelector('.context-label')!.textContent = settings.realisticSizes ? 'ФИЗИЧЕСКИЙ МАСШТАБ' : 'РЕЖИМ ИССЛЕДОВАНИЯ';
    for (const planet of Object.values(system.planets)) planet.orbitLine.visible = settings.showOrbits;
    for (const moon of Object.values(system.moons)) moon.orbitLine.visible = settings.showOrbits;
    options.onScaleChanged();
  }

  const header = document.createElement('header');
  header.className = 'app-header';
  header.innerHTML = '<div class="app-brand"><span class="brand-mark">' + icon('orbit') + '</span><div><span class="brand-eyebrow">СОЛНЕЧНАЯ СИСТЕМА</span><h1>Солнечный атлас</h1></div></div>';
  const context = document.createElement('div');
  context.className = 'header-context';
  context.innerHTML = '<span class="context-label">РЕЖИМ ИССЛЕДОВАНИЯ</span><span class="context-name">Свободный обзор</span>';
  const contextName = context.querySelector('.context-name')!;
  const actions = document.createElement('div');
  actions.className = 'header-actions';
  const status = document.createElement('span');
  status.className = 'simulation-status';
  status.innerHTML = '<span class="status-dot"></span><span class="status-label">В движении</span>';

  const browse = document.createElement('button');
  browse.className = 'icon-button catalog-toggle';
  browse.innerHTML = icon('grid');
  browse.setAttribute('aria-label', 'Открыть каталог');
  browse.setAttribute('aria-controls', 'body-catalog');
  browse.setAttribute('aria-expanded', 'false');
  browse.title = 'Каталог объектов';
  const overview = document.createElement('button');
  overview.className = 'header-action overview-btn';
  overview.innerHTML = icon('overview') + '<span class="action-label">Обзор</span>';
  overview.setAttribute('aria-label', 'Общий обзор');
  overview.title = 'Общий обзор';

  const settingsContainer = document.createElement('details');
  settingsContainer.className = 'scene-settings';
  const settingsSummary = document.createElement('summary');
  settingsSummary.className = 'header-action';
  settingsSummary.setAttribute('aria-label', 'Настройки сцены');
  settingsSummary.innerHTML = icon('settings') + '<span class="action-label">Настройки</span>';
  const settingsContent = document.createElement('div');
  settingsContent.className = 'settings-content glass-panel';
  settingsContent.innerHTML = '<div class="settings-heading"><span class="eyebrow">ВАШ КОСМОС</span><h2>Настройки сцены</h2><p>Свет, атмосфера и течение времени.</p></div>';
  settingsContainer.append(settingsSummary, settingsContent);
  actions.append(status, browse, overview, settingsContainer);
  header.append(context, actions);

  function settingsGroup(title: string, open = false) {
    const group = document.createElement('details');
    group.className = 'settings-group';
    group.open = open;
    const summary = document.createElement('summary');
    summary.innerHTML = '<span>' + title + '</span>' + icon('down');
    const fields = document.createElement('div');
    fields.className = 'settings-fields';
    group.append(summary, fields);
    settingsContent.appendChild(group);
    return fields;
  }

  function numberControl(parent: HTMLElement, label: string, get: () => number, set: (value: number) => void, min: number, max: number, step: number) {
    const field = document.createElement('div');
    field.className = 'setting-field';
    const heading = document.createElement('div');
    heading.className = 'setting-label';
    const text = document.createElement('span');
    text.textContent = label;
    const number = document.createElement('input');
    number.type = 'number';
    number.className = 'setting-number';
    number.setAttribute('aria-label', label);
    const range = document.createElement('input');
    range.type = 'range';
    range.setAttribute('aria-label', label + ' — ползунок');
    for (const input of [number, range]) {
      input.min = String(min); input.max = String(max); input.step = String(step);
    }
    const sync = () => {
      number.value = range.value = String(get());
      range.style.setProperty('--range-progress', ((get() - min) / (max - min) * 100) + '%');
    };
    const change = (input: HTMLInputElement) => {
      if (!input.value || !Number.isFinite(input.valueAsNumber)) return;
      set(Math.min(max, Math.max(min, input.valueAsNumber)));
      sync(); applySettings(); persist(); update();
    };
    number.addEventListener('input', () => change(number), { signal });
    number.addEventListener('blur', sync, { signal });
    range.addEventListener('input', () => change(range), { signal });
    heading.append(text, number); field.append(heading, range); parent.appendChild(field);
    syncControls.push(sync); sync();
    return field;
  }

  function colorControl(parent: HTMLElement, label: string, key: 'sunColor' | 'bloomTint') {
    const row = document.createElement('label');
    row.className = 'color-field';
    const text = document.createElement('span');
    text.textContent = label;
    const color = document.createElement('input');
    color.type = 'color';
    color.setAttribute('aria-label', label);
    const value = document.createElement('span');
    value.className = 'color-code';
    const sync = () => { color.value = settings[key]; value.textContent = settings[key].toUpperCase(); };
    color.addEventListener('input', () => { settings[key] = color.value; sync(); applySettings(); persist(); }, { signal });
    row.append(text, value, color); parent.appendChild(row); syncControls.push(sync); sync();
  }

  const modes = settingsGroup('Масштаб и время', true);
  function modeSwitch(label: string, key: 'realisticSizes' | 'realTime', description: string) {
    const field = document.createElement('label');
    field.className = 'toggle-field mode-field';
    const id = 'mode-' + key;
    field.innerHTML = '<span><span>' + label + '</span><small id="' + id + '">' + description + '</small></span>'
      + '<input type="checkbox" role="switch" aria-label="' + label + '" aria-describedby="' + id + '"><span class="toggle-track" aria-hidden="true"></span>';
    const input = field.querySelector('input')!;
    const sync = () => { input.checked = settings[key]; input.setAttribute('aria-checked', String(settings[key])); };
    input.addEventListener('change', () => {
      settings[key] = input.checked;
      syncControls.forEach(sync => sync()); applySettings(); persist(); update();
    }, { signal });
    modes.appendChild(field); syncControls.push(sync); sync();
  }
  modeSwitch('Реальные размеры и расстояния', 'realisticSizes', 'Солнце, планеты и спутники в едином масштабе с орбитами. Для просмотра маленьких тел используйте каталог.');
  modeSwitch('Реальные скорости — время 1:1', 'realTime', '1 секунда в сцене равна 1 секунде в жизни. Суточное вращение без замедления.');
  const light = settingsGroup('Источник света');
  numberControl(light, 'Мощность Солнца', () => settings.sunIntensity, value => { settings.sunIntensity = value; }, 0, 5, 0.05);
  numberControl(light, 'Фоновый свет', () => settings.ambientIntensity, value => { settings.ambientIntensity = value; }, 0, 1, 0.01);
  colorControl(light, 'Цвет Солнца', 'sunColor');
  const effects = settingsGroup('Экран и эффекты');
  for (const [label, key, min, max] of [
    ['Экспозиция', 'exposure', 0.2, 2], ['Сила свечения', 'bloomStrength', 0, 2],
    ['Мягкость свечения', 'bloomRadius', 0, 1], ['Порог свечения', 'bloomThreshold', 0, 1],
  ] as const) numberControl(effects, label, () => settings[key], value => { settings[key] = value; }, min, max, 0.01);
  colorControl(effects, 'Цвет ореола', 'bloomTint');
  const sceneSettings = settingsGroup('Сцена и время');
  const sizeField = numberControl(sceneSettings, 'Масштаб планет', () => settings.planetScale, value => { settings.planetScale = value; }, 0.5, 2, 0.05);
  const speedField = numberControl(sceneSettings, 'Скорость (дн/сек)', () => state.timeScale, value => { state.timeScale = value; }, 0, 50, 0.1);
  syncControls.push(() => { sizeField.hidden = settings.realisticSizes; speedField.hidden = settings.realTime; });
  const orbitToggle = document.createElement('label');
  orbitToggle.className = 'toggle-field';
  orbitToggle.innerHTML = '<span>Показать орбиты</span><input type="checkbox" aria-label="Показать орбиты"><span class="toggle-track" aria-hidden="true"></span>';
  const checkbox = orbitToggle.querySelector('input')!;
  checkbox.addEventListener('change', () => { settings.showOrbits = checkbox.checked; applySettings(); persist(); }, { signal });
  syncControls.push(() => { checkbox.checked = settings.showOrbits; });
  sceneSettings.appendChild(orbitToggle);
  const reset = document.createElement('button');
  reset.className = 'settings-reset';
  reset.innerHTML = icon('reset') + '<span>Вернуть исходные настройки</span>';
  reset.addEventListener('click', () => {
    Object.assign(settings, defaultSettings); state.timeScale = 1;
    syncControls.forEach(sync => sync()); applySettings(); persist(); update();
  }, { signal });
  settingsContent.appendChild(reset);

  const catalog = document.createElement('section');
  catalog.className = 'catalog-panel glass-panel';
  catalog.id = 'body-catalog';
  catalog.setAttribute('aria-label', 'Каталог объектов');
  catalog.innerHTML = '<div class="catalog-heading"><div><span class="eyebrow">СОЛНЕЧНАЯ СИСТЕМА</span><h2>Исследуйте</h2></div><span class="catalog-total">' + BODY_CATALOG.length + '</span></div>';
  const searchWrap = document.createElement('div');
  searchWrap.className = 'search-field';
  searchWrap.innerHTML = icon('search');
  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Найти объект…';
  search.setAttribute('aria-label', 'Поиск объектов');
  const shortcut = document.createElement('kbd');
  shortcut.textContent = 'Ctrl K';
  shortcut.setAttribute('aria-hidden', 'true');
  searchWrap.append(search, shortcut);
  const tabs = document.createElement('div');
  tabs.className = 'catalog-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Категории объектов');
  const categoryButtons = new Map<Category, HTMLButtonElement>();
  const navigation = document.createElement('nav');
  navigation.className = 'lil-nav-panel';
  navigation.setAttribute('aria-label', 'Объекты Солнечной системы');
  const buttons = new Map<BodyId, HTMLButtonElement>();
  const rows = new Map<Category, HTMLElement>();
  let activeCategory: Category = 'major';
  let catalogOpen = false;
  let catalogWasOpen = false;
  let infoOpen = false;
  let selected: BodyId | null = null;

  function setCatalogOpen(open: boolean) {
    catalogOpen = open;
    document.body.classList.toggle('catalog-open', open);
    browse.setAttribute('aria-expanded', String(open));
  }

  function filter() {
    const query = search.value.trim().toLocaleLowerCase('ru');
    let count = 0;
    for (const body of BODY_CATALOG) {
      const matches = query
        ? body.name.toLocaleLowerCase('ru').includes(query) || body.id.includes(query)
        : categoryFor(body.kind) === activeCategory;
      buttons.get(body.id)!.hidden = !matches;
      if (matches) count++;
    }
    for (const [category, row] of rows) row.hidden = !BODY_CATALOG.some(body => categoryFor(body.kind) === category && !buttons.get(body.id)!.hidden);
    for (const [category, button] of categoryButtons) {
      button.setAttribute('aria-selected', String(category === activeCategory));
      button.tabIndex = category === activeCategory ? 0 : -1;
    }
    empty.hidden = count > 0;
    const words: Record<string, string> = { one: 'объект', few: 'объекта', many: 'объектов', other: 'объекта' };
    resultCount.textContent = query ? 'Найдено: ' + count : count + ' ' + (words[new Intl.PluralRules('ru').select(count)] ?? 'объектов');
  }

  function setCategory(category: Category) {
    activeCategory = category; search.value = ''; filter();
    navigation.scrollTop = 0;
  }

  for (const category of categories) {
    const tab = document.createElement('button');
    tab.className = 'catalog-tab';
    tab.id = 'category-' + category.id;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-label', category.label);
    tab.setAttribute('aria-controls', 'bodies-' + category.id);
    tab.textContent = category.label;
    tab.addEventListener('click', () => setCategory(category.id), { signal });
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const index = categories.findIndex(item => item.id === activeCategory);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
      setCategory(categories[next].id); categoryButtons.get(categories[next].id)!.focus();
    }, { signal });
    categoryButtons.set(category.id, tab); tabs.appendChild(tab);
    const row = document.createElement('div');
    row.className = 'nav-row';
    row.id = 'bodies-' + category.id;
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', category.group);
    for (const body of BODY_CATALOG.filter(body => categoryFor(body.kind) === category.id)) {
      const button = document.createElement('button');
      button.className = 'lil-nav-btn';
      button.dataset.body = body.id;
      button.dataset.category = category.id;
      button.setAttribute('aria-label', body.name);
      button.setAttribute('aria-pressed', 'false');
      button.innerHTML = bodyAvatar(body.id) + '<span class="body-copy"><span class="body-name">' + body.name + '</span><span class="body-type">' + bodySubtitle(body.id) + '</span></span><span class="body-arrow">' + icon('chevron') + '</span>';
      button.addEventListener('click', event => options.select(body.id, event.detail === 0), { signal });
      row.appendChild(button); buttons.set(body.id, button);
    }
    navigation.appendChild(row); rows.set(category.id, row);
  }

  const empty = document.createElement('div');
  empty.className = 'search-empty';
  empty.setAttribute('role', 'status');
  empty.innerHTML = icon('search') + '<strong>Ничего не найдено</strong><span>Попробуйте другое название</span>';
  const catalogFooter = document.createElement('div');
  catalogFooter.className = 'catalog-footer';
  const resultCount = document.createElement('span');
  const catalogHint = document.createElement('span');
  catalogHint.innerHTML = icon('mouse') + '<span>Выберите объект</span>';
  catalogFooter.append(resultCount, catalogHint);
  catalog.append(searchWrap, tabs, navigation, empty, catalogFooter);
  search.addEventListener('input', filter, { signal });
  filter();

  const sceneViewport = document.createElement('div');
  sceneViewport.className = 'scene-viewport';
  sceneViewport.setAttribute('aria-hidden', 'true');
  sceneViewport.innerHTML = '<div class="scene-hint">' + icon('mouse') + '<span>Перетаскивайте для обзора<span class="hint-separator">·</span>Колесо — масштаб</span></div>';

  const dock = document.createElement('section');
  dock.className = 'control-dock glass-panel';
  dock.setAttribute('aria-label', 'Управление временем');
  const dateLabel = document.createElement('label');
  dateLabel.className = 'simulation-date';
  dateLabel.innerHTML = '<span class="eyebrow"><span class="date-heading">ДАТА СИМУЛЯЦИИ</span><span class="simulation-clock" role="timer" aria-label="Время симуляции (UTC)" hidden></span> <span class="utc-label">UTC</span></span>';
  const dateHeading = dateLabel.querySelector<HTMLElement>('.date-heading')!;
  const simulationClock = dateLabel.querySelector<HTMLElement>('.simulation-clock')!;
  const dateField = document.createElement('span');
  dateField.className = 'date-value';
  dateField.innerHTML = icon('calendar');
  const date = document.createElement('input');
  date.type = 'date'; date.min = '0001-01-01'; date.max = '9999-12-31';
  date.setAttribute('aria-label', 'Дата симуляции (UTC)');
  dateField.appendChild(date); dateLabel.appendChild(dateField);

  const transport = document.createElement('div');
  transport.className = 'time-transport';
  function timeButton(label: string, markup: string, action: () => void, className = '') {
    const button = document.createElement('button');
    button.className = 'time-btn ' + className;
    button.setAttribute('aria-label', label); button.title = label; button.innerHTML = markup;
    button.addEventListener('click', action, { signal });
    transport.appendChild(button); return button;
  }
  timeButton('Назад на 10 дней', icon('back') + '<span>10д</span>', () => options.timeControl.step(-10));
  const play = timeButton('Приостановить симуляцию', icon('pause'), () => { options.timeControl.togglePlay(); update(); }, 'play-button');
  timeButton('Вперёд на 10 дней', '<span>10д</span>' + icon('forward'), () => options.timeControl.step(10));

  const speedBlock = document.createElement('div');
  speedBlock.className = 'speed-control';
  const speedLabel = document.createElement('span');
  speedLabel.className = 'eyebrow simulation-speed';
  const presets = document.createElement('div');
  presets.className = 'speed-presets';
  presets.setAttribute('aria-label', 'Скорость времени');
  const speedButtons = [0.1, 1, 10].map(rate => {
    const button = document.createElement('button');
    button.className = 'speed-preset';
    button.textContent = rate.toLocaleString('ru') + '×';
    button.setAttribute('aria-label', 'Скорость ' + rate.toLocaleString('ru') + ' дн/сек');
    button.addEventListener('click', () => {
      state.timeScale = rate; syncControls.forEach(sync => sync()); persist(); update();
    }, { signal });
    presets.appendChild(button); return { button, rate };
  });
  const realTimeBadge = document.createElement('span');
  realTimeBadge.className = 'real-time-badge';
  realTimeBadge.textContent = '1× · реальное время';
  speedBlock.append(speedLabel, presets, realTimeBadge);
  dock.append(dateLabel, transport, speedBlock);

  const loading = document.createElement('div');
  loading.className = 'loading-status glass-panel';
  loading.setAttribute('role', 'status');
  loading.setAttribute('aria-live', 'polite');
  const loadingText = document.createElement('span');
  const retry = document.createElement('button');
  retry.className = 'quiet-button';
  retry.textContent = 'Повторить'; retry.hidden = true;
  retry.addEventListener('click', options.retryTextures, { signal });
  loading.innerHTML = '<span class="loading-spinner" aria-hidden="true"></span>';
  loading.append(loadingText, retry);
  document.body.append(header, catalog, sceneViewport, dock, loading);

  date.addEventListener('change', () => {
    const milliseconds = Date.parse(date.value + 'T12:00:00Z');
    if (Number.isFinite(milliseconds)) options.timeControl.setDays((milliseconds - J2000_MS) / DAY_MS);
    update();
  }, { signal });
  browse.addEventListener('click', () => {
    settingsContainer.open = false;
    if (document.body.classList.contains('panel-open')) { options.browse(); setCatalogOpen(true); }
    else setCatalogOpen(!catalogOpen);
    if (catalogOpen) search.focus({ preventScroll: true });
  }, { signal });
  overview.addEventListener('click', () => {
    settingsContainer.open = false; search.value = ''; activeCategory = 'major'; filter();
    options.overview(); setCatalogOpen(false);
  }, { signal });
  document.addEventListener('pointerdown', event => {
    if (settingsContainer.open && event.target instanceof Node && !settingsContainer.contains(event.target)) settingsContainer.open = false;
  }, { signal });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && settingsContainer.open) {
      event.preventDefault(); event.stopPropagation(); settingsContainer.open = false; settingsSummary.focus();
    }
    const typing = event.target instanceof HTMLElement && (event.target.matches('input, textarea, select') || event.target.isContentEditable);
    if (((event.ctrlKey || event.metaKey) && (event.code === 'KeyK' || event.key.toLowerCase() === 'k')) || (!typing && event.key === '/')) {
      event.preventDefault(); options.browse(); setCatalogOpen(true); search.focus();
    }
  }, { signal, capture: true });

  let displayedDate = '';
  let displayedPaused: boolean | undefined;
  let displayedSpeed = NaN;
  let displayedRealTime: boolean | undefined;
  function update() {
    if (displayedPaused !== state.isPaused || displayedRealTime !== settings.realTime) {
      displayedPaused = state.isPaused;
      play.innerHTML = icon(state.isPaused ? 'play' : 'pause');
      play.setAttribute('aria-label', state.isPaused ? 'Продолжить симуляцию' : 'Приостановить симуляцию');
      play.title = play.getAttribute('aria-label')!;
      play.setAttribute('aria-pressed', String(state.isPaused));
      status.classList.toggle('is-paused', state.isPaused);
      status.querySelector('.status-label')!.textContent = state.isPaused ? 'Пауза' : settings.realTime ? 'Время 1:1' : 'В движении';
    }
    const timestamp = simulationDate(state.simDays).toISOString();
    const iso = timestamp.slice(0, 10);
    dateHeading.hidden = settings.realTime;
    simulationClock.hidden = !settings.realTime;
    if (settings.realTime) simulationClock.textContent = timestamp.slice(11, 19);
    if (iso !== displayedDate) {
      displayedDate = iso;
      if (document.activeElement !== date) date.value = iso;
    }
    if (displayedSpeed !== state.timeScale || displayedRealTime !== settings.realTime) {
      displayedSpeed = state.timeScale;
      displayedRealTime = settings.realTime;
      speedLabel.textContent = settings.realTime ? '1 СЕК = 1 СЕК' : state.timeScale.toLocaleString('ru') + ' ДН / СЕК';
      presets.hidden = settings.realTime;
      realTimeBadge.hidden = !settings.realTime;
      speedButtons.forEach(({ button, rate }) => {
        button.disabled = settings.realTime;
        button.setAttribute('aria-pressed', String(!settings.realTime && state.timeScale === rate));
      });
    }
  }
  syncControls.forEach(sync => sync()); applySettings(); update();
  return {
    element: dock,
    sceneElement: sceneViewport,
    update,
    setInfoOpen(open: boolean) {
      if (open && !infoOpen) { catalogWasOpen = catalogOpen; setCatalogOpen(false); }
      else if (!open && infoOpen && catalogWasOpen) { setCatalogOpen(true); catalogWasOpen = false; }
      infoOpen = open;
    },
    setSelected(id: BodyId | null) {
      selected = id;
      for (const [key, button] of buttons) button.setAttribute('aria-pressed', String(key === selected));
      contextName.textContent = id ? BODY_CATALOG.find(body => body.id === id)!.name : 'Свободный обзор';
      if (id) {
        activeCategory = categoryFor(BODY_CATALOG.find(body => body.id === id)!.kind);
        filter();
        if (!buttons.get(id)!.hidden) buttons.get(id)!.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    },
    setLoading(status: LoadingStatus) {
      loading.hidden = status.pending === 0 && status.failed === 0;
      retry.hidden = status.failed === 0;
      loading.classList.toggle('has-error', status.failed > 0);
      loadingText.textContent = status.failed > 0 ? 'Не удалось загрузить текстуры: ' + status.failed
        : 'Готовим ваш космос… ' + status.pending;
    },
    dispose() {
      header.remove(); catalog.remove(); sceneViewport.remove(); dock.remove(); loading.remove();
      document.body.classList.remove('catalog-open', 'realistic-sizes');
    },
  };
}
