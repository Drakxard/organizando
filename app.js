const themeOrder = ["tealSlider", "tealBars", "pixelBlack"];

const themes = {
  tealSlider: {
    label: "Turquesa lineal",
    description: "Linea de progreso limpia y suave."
  },
  tealBars: {
    label: "Turquesa barras",
    description: "Ritmo visual por columnas verticales."
  },
  pixelBlack: {
    label: "Pixel negro",
    description: "Look retro compacto sobre negro."
  }
};

const legacyPalettes = {
  "palette-01": { bg: "#dff7df", primary: "#6bdd43", text: "#162015" },
  "palette-02": { bg: "#ffe6c8", primary: "#ff9640", text: "#2e2118" },
  "palette-03": { bg: "#d9ecff", primary: "#4e9fff", text: "#152235" },
  "palette-04": { bg: "#ede2ff", primary: "#8a63d8", text: "#241c36" },
  "palette-05": { bg: "#151b13", primary: "#75df46", text: "#dfffd5" },
  "palette-06": { bg: "#ffe0ee", primary: "#ea5ba4", text: "#331224" },
  "palette-07": { bg: "#d8f8f3", primary: "#36bfa5", text: "#142a26" },
  "palette-08": { bg: "#d6d8df", primary: "#515d79", text: "#1a1f28" }
};

const colorFieldConfig = {
  background: { label: "Fondo", title: "Color de fondo" },
  progress: { label: "Barra", title: "Color de barra" },
  text: { label: "Texto", title: "Color de texto" }
};

const colorSwatches = [
  "#000000", "#2b2d33", "#4d5566", "#6f7b95", "#95a7c0", "#d0d7e8",
  "#58cfd0", "#35bfa5", "#5fd3d4", "#7cc4e8", "#4e9fff", "#1d7fd0",
  "#75df46", "#a4e66d", "#ffd95f", "#ffb347", "#ff9640", "#ff7740",
  "#ea5ba4", "#d24f8d", "#8a63d8", "#b08eff", "#ede2ff", "#c6a7ff",
  "#331224", "#55233c", "#7c4c3d", "#9d7d63", "#dff7df", "#ffe6c8",
  "#d9ecff", "#ffe0ee", "#d8f8f3", "#d6d8df", "#f5f3ee", "#ffffff"
];

const DEFAULT_EVENT = {
  title: "Titulo",
  theme: "tealSlider",
  date: getTodayISO(),
  colors: {
    background: "#dff7df",
    progress: "#6bdd43",
    text: "#162015"
  }
};

const state = {
  today: getToday(),
  currentMonth: getMonthStart(getToday()),
  events: [],
  selectedEventId: null,
  editingEventId: null,
  isModalOpen: false,
  activeEditorTab: "theme",
  activeColorField: null,
  draft: createDefaultEventData(),
  isLoading: true,
  isSaving: false,
  loadError: "",
  saveError: "",
  saveNotice: "",
  deletingEventId: null,
  draggedEventId: null,
  discardedTempEventIds: new Set()
};

const monthFormatter = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" });

const appStatus = document.getElementById("appStatus");
const eventStack = document.getElementById("eventStack");
const homeCalendarTitle = document.getElementById("homeCalendarTitle");
const homeCalendarDays = document.getElementById("homeCalendarDays");
const homePrevMonthButton = document.getElementById("homePrevMonth");
const homeNextMonthButton = document.getElementById("homeNextMonth");

const modalBackdrop = document.getElementById("modalBackdrop");
const editorModal = document.getElementById("editorModal");
const editorStatusLabel = document.getElementById("editorStatusLabel");
const editorError = document.getElementById("editorError");
const closeModalButton = document.getElementById("closeModal");
const saveEventButton = document.getElementById("saveEvent");
const titleInput = document.getElementById("eventTitle");
const modalPreview = document.getElementById("modalPreview");
const themePane = document.getElementById("themePane");
const colorPane = document.getElementById("colorPane");
const tabThemeButton = document.getElementById("tabTheme");
const tabColorsButton = document.getElementById("tabColors");

let nextDayRefreshTimeoutId = null;

function getToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
}

function getTodayISO() {
  return toISODate(getToday());
}

function getNowISO() {
  return new Date().toISOString();
}

function getCurrentTodayISO() {
  return toISODate(state.today);
}

function toISODate(date) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toDateOnly(value) {
  return new Date(`${value}T12:00:00`);
}

function getMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatMonthTitle(date) {
  const label = monthFormatter.format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function daysBetween(dateA, dateB) {
  return Math.round((toDateOnly(dateA).getTime() - toDateOnly(dateB).getTime()) / 86400000);
}

function clamp(min, value, max) {
  return Math.min(max, Math.max(min, value));
}

function getTargetEndOfDay(dateValue) {
  const target = toDateOnly(dateValue);
  target.setHours(23, 59, 59, 999);
  return target;
}

function getEventCreatedAt(event) {
  return event.createdAt ? new Date(event.createdAt) : new Date();
}

function getProgressParts(event) {
  const now = Date.now();
  const createdAt = getEventCreatedAt(event).getTime();
  const targetAt = getTargetEndOfDay(event.date).getTime();
  const totalMs = targetAt - createdAt;

  if (totalMs <= 0) {
    return {
      progressRatio: 1,
      progressPercent: 100,
      remainingMs: targetAt - now
    };
  }

  const elapsedMs = clamp(0, now - createdAt, totalMs);
  const progressRatio = elapsedMs / totalMs;

  return {
    progressRatio,
    progressPercent: Math.round(progressRatio * 100),
    remainingMs: targetAt - now
  };
}

function getRemainingTimeParts(event) {
  const diffMs = getProgressParts(event).remainingMs;
  const future = diffMs >= 0;
  const absMs = Math.abs(diffMs);
  const dayMs = 86400000;
  const hourMs = 3600000;
  const days = Math.floor(absMs / dayMs);
  const hours = Math.max(0, Math.ceil((absMs % dayMs) / hourMs));

  return { future, days, hours };
}

function formatRelativeText(event) {
  const { future, days, hours } = getRemainingTimeParts(event);

  if (future) {
    if (days > 0 && hours > 0) return `Faltan ${days}d ${hours}h`;
    if (days > 0) return `Faltan ${days}d`;
    return `Faltan ${Math.max(1, hours)}h`;
  }

  if (days > 0 && hours > 0) return `Hace ${days}d ${hours}h`;
  if (days > 0) return `Hace ${days}d`;
  return `Hace ${Math.max(1, hours)}h`;
}

function getPixelStatus(event) {
  const { future, days, hours } = getRemainingTimeParts(event);

  if (future) {
    if (days > 0 && hours > 0) return `FALTAN ${days}D ${hours}H`;
    if (days > 0) return `FALTAN ${days}D`;
    return `FALTAN ${Math.max(1, hours)}H`;
  }

  if (days > 0 && hours > 0) return `HACE ${days}D ${hours}H`;
  if (days > 0) return `HACE ${days}D`;
  return `HACE ${Math.max(1, hours)}H`;
}

function createDefaultEventData() {
  return {
    ...DEFAULT_EVENT,
    date: getTodayISO(),
    colors: { ...DEFAULT_EVENT.colors },
    createdAt: getNowISO()
  };
}

function normalizeHexColor(value, fallback) {
  const color = String(value || "").trim();
  return /^#(?:[0-9a-fA-F]{6})$/.test(color) ? color.toLowerCase() : fallback;
}

function getLegacyColors(paletteKey) {
  const palette = legacyPalettes[paletteKey] || legacyPalettes["palette-01"];
  return {
    background: palette.bg,
    progress: palette.primary,
    text: palette.text
  };
}

function normalizeEvent(event) {
  const legacyColors = getLegacyColors(event.palette);
  const sourceColors = event.colors && typeof event.colors === "object" ? event.colors : {};

  return {
    ...event,
    colors: {
      background: normalizeHexColor(sourceColors.background, legacyColors.background),
      progress: normalizeHexColor(sourceColors.progress, legacyColors.progress),
      text: normalizeHexColor(sourceColors.text, legacyColors.text)
    }
  };
}

function ensurePersistedEventShape(event) {
  if (!event || typeof event !== "object") {
    throw new Error("La API devolvio un evento invalido.");
  }

  if (!event.theme || !event.colors || typeof event.colors !== "object") {
    throw new Error("La API devolvio un evento incompleto. Revisa la migracion de colores.");
  }

  const hasAllColors = ["background", "progress", "text"].every((key) => {
    return /^#(?:[0-9a-fA-F]{6})$/.test(String(event.colors[key] || ""));
  });

  if (!hasAllColors) {
    throw new Error("La API devolvio colores incompletos. Revisa la migracion de colores.");
  }

  return event;
}

function sortEvents(events) {
  return [...events];
}

function orderEventsBySortOrder(events) {
  return [...events].sort((left, right) => {
    const leftOrder = Number.isInteger(left.sortOrder) ? left.sortOrder : Number.MAX_SAFE_INTEGER;
    const rightOrder = Number.isInteger(right.sortOrder) ? right.sortOrder : Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

function applySequentialSortOrder(events) {
  return events.map((event, index) => ({
    ...event,
    sortOrder: index
  }));
}

async function persistEventOrder(events) {
  await Promise.all(
    events.map((event, index) =>
      requestJson(`/api/events/${encodeURIComponent(event.id)}`, {
        method: "PUT",
        body: JSON.stringify({ sortOrder: index })
      })
    )
  );
}

function moveEvent(events, draggedId, targetId) {
  const nextEvents = [...events];
  const fromIndex = nextEvents.findIndex((event) => event.id === draggedId);
  const toIndex = nextEvents.findIndex((event) => event.id === targetId);

  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
    return nextEvents;
  }

  const [movedEvent] = nextEvents.splice(fromIndex, 1);
  nextEvents.splice(toIndex, 0, movedEvent);
  return nextEvents;
}

function setAppStatus(message = "") {
  appStatus.hidden = !message;
  appStatus.textContent = message;
}

function setEditorError(message = "") {
  editorError.hidden = !message;
  editorError.textContent = message;
}

function refreshAppStatus() {
  if (state.loadError) {
    setAppStatus(`No se pudieron cargar los eventos: ${state.loadError}`);
    return;
  }

  if (state.saveNotice) {
    setAppStatus(state.saveNotice);
    return;
  }

  if (state.events.length === 0) {
    setAppStatus(state.isLoading ? "" : "No hay eventos guardados todavia. Crea uno desde el calendario.");
    return;
  }

  setAppStatus("");
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(payload?.error || "No se pudo completar la solicitud.");
    error.statusCode = response.status;
    throw error;
  }

  return payload;
}

async function loadEvents() {
  state.isLoading = true;
  state.loadError = "";
  state.saveNotice = "";
  refreshAppStatus();
  renderApp();

  try {
    const events = orderEventsBySortOrder((await requestJson("/api/events")).map(normalizeEvent));
    state.events = events;
    state.selectedEventId = events[0]?.id || null;
  } catch (error) {
    state.loadError = error.message;
  } finally {
    state.isLoading = false;
    refreshAppStatus();
    renderApp();
  }
}

function createEventForDate(date) {
  state.editingEventId = null;
  state.deletingEventId = null;
  state.activeEditorTab = "theme";
  state.activeColorField = null;
  state.saveError = "";
  state.draft = {
    ...createDefaultEventData(),
    date
  };
  state.currentMonth = getMonthStart(toDateOnly(date));
  renderApp();
  setModal(true);
}

function focusTitleCapture() {
  requestAnimationFrame(() => {
    titleInput.focus();
    titleInput.setSelectionRange(titleInput.value.length, titleInput.value.length);
  });
}

function getSelectedEvent() {
  return state.events.find((event) => event.id === state.selectedEventId) || state.events[0] || null;
}

function mixHexColors(colorA, colorB, ratio) {
  const valueA = colorA.slice(1);
  const valueB = colorB.slice(1);
  const channels = [0, 2, 4].map((offset) => {
    const channelA = parseInt(valueA.slice(offset, offset + 2), 16);
    const channelB = parseInt(valueB.slice(offset, offset + 2), 16);
    const mixed = Math.round(channelA + (channelB - channelA) * ratio);
    return mixed.toString(16).padStart(2, "0");
  });

  return `#${channels.join("")}`;
}

function getCardStyle(colors = DEFAULT_EVENT.colors) {
  const background = normalizeHexColor(colors.background, DEFAULT_EVENT.colors.background);
  const progress = normalizeHexColor(colors.progress, DEFAULT_EVENT.colors.progress);
  const text = normalizeHexColor(colors.text, DEFAULT_EVENT.colors.text);
  const surface = mixHexColors(background, text, 0.08);
  const secondary = mixHexColors(text, background, 0.22);
  const accent = mixHexColors(progress, "#ffffff", 0.18);

  return [
    `--card-bg:${background}`,
    `--card-surface:${surface}`,
    `--card-primary:${progress}`,
    `--card-secondary:${secondary}`,
    `--card-text:${text}`,
    `--card-accent:${accent}`
  ].join(";");
}

function buildBars(total, active) {
  return Array.from({ length: total }, (_, index) => {
    const className = index < active ? "bar-pill is-active" : "bar-pill";
    return `<span class="${className}"></span>`;
  }).join("");
}

function buildThemeCard(data, options = {}) {
  const variant = options.variant || "main";
  const title = escapeHtml((data.title || DEFAULT_EVENT.title).trim() || DEFAULT_EVENT.title);
  const paletteStyle = getCardStyle(data.colors);
  const { progressPercent } = getProgressParts(data);
  const progress = progressPercent;
  const relative = formatRelativeText(data);
  const pixelStatus = getPixelStatus(data);

  let content = "";

  if (data.theme === "tealSlider") {
    content = `
      <div class="card-layout slider-theme">
        <div class="card-head">
          <h3>${title}</h3>
          <p>${relative}</p>
        </div>
        <div class="slider-track">
          <span class="slider-progress" style="--fill:${progress}%;"></span>
        </div>
      </div>
    `;
  } else if (data.theme === "tealBars") {
    content = `
      <div class="card-layout bars-theme">
        <div class="card-head">
          <h3>${title}</h3>
          <p>${relative}</p>
        </div>
        <div class="bars-track">
          ${buildBars(16, Math.round((progress / 100) * 16))}
        </div>
      </div>
    `;
  } else {
    content = `
      <div class="card-layout pixel-theme">
        <div class="pixel-title">${title.toUpperCase()}</div>
        <div class="pixel-frame">
          <span class="pixel-fill" style="--fill:${progress}%;"></span>
          <span class="pixel-square"></span>
          <strong>${pixelStatus}</strong>
        </div>
      </div>
    `;
  }

  return `
    <article class="event-card event-card-${variant} theme-${data.theme}" style="${paletteStyle}">
      ${content}
    </article>
  `;
}

function renderEventStack() {
  eventStack.innerHTML = "";

  if (state.isLoading) {
    eventStack.innerHTML = `<p class="stack-empty">Preparando eventos...</p>`;
    return;
  }

  if (state.events.length === 0) {
    const message = state.loadError
      ? "No hay datos cargados. Revisa la conexion a la API."
      : "No hay eventos guardados. Usa una fecha futura para crear el primero.";
    eventStack.innerHTML = `<p class="stack-empty">${escapeHtml(message)}</p>`;
    return;
  }

  state.events.forEach((event) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `stack-item${state.selectedEventId === event.id ? " is-selected" : ""}${state.draggedEventId === event.id ? " is-dragging" : ""}`;
    button.draggable = true;
    button.dataset.eventId = event.id;
    button.innerHTML = buildThemeCard(event, { variant: "stack" });
    button.addEventListener("click", () => {
      state.selectedEventId = event.id;
      state.editingEventId = event.id;
      state.deletingEventId = null;
      state.activeColorField = null;
      state.saveError = "";
      state.draft = normalizeEvent({ ...event, colors: { ...event.colors } });
      state.activeEditorTab = "theme";
      state.currentMonth = getMonthStart(toDateOnly(event.date));
      renderApp();
      setModal(true);
    });
    button.addEventListener("dragstart", (dragEvent) => {
      state.draggedEventId = event.id;
      dragEvent.dataTransfer.effectAllowed = "move";
      dragEvent.dataTransfer.setData("text/plain", event.id);
      requestAnimationFrame(() => button.classList.add("is-dragging"));
    });
    button.addEventListener("dragend", () => {
      state.draggedEventId = null;
      renderEventStack();
    });
    button.addEventListener("dragover", (dragEvent) => {
      if (!state.draggedEventId || state.draggedEventId === event.id) return;
      dragEvent.preventDefault();
      dragEvent.dataTransfer.dropEffect = "move";
    });
    button.addEventListener("drop", (dragEvent) => {
      if (!state.draggedEventId || state.draggedEventId === event.id) return;
      dragEvent.preventDefault();
      const previousEvents = state.events;
      const reorderedEvents = applySequentialSortOrder(moveEvent(state.events, state.draggedEventId, event.id));

      state.events = reorderedEvents;
      state.draggedEventId = null;
      state.saveNotice = "";
      renderApp();

      void (async () => {
        try {
          await persistEventOrder(reorderedEvents);
        } catch (error) {
          state.events = previousEvents;
          state.saveNotice = `No se pudo guardar el orden: ${error.message}`;
          refreshAppStatus();
          renderApp();
        }
      })();
    });
    eventStack.appendChild(button);
  });
}

function renderHomeCalendar() {
  const selectedEvent = getSelectedEvent();
  const selectedDate = selectedEvent ? selectedEvent.date : null;
  const year = state.currentMonth.getFullYear();
  const month = state.currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const todayISO = getCurrentTodayISO();

  homeCalendarTitle.textContent = formatMonthTitle(state.currentMonth);
  homeCalendarDays.innerHTML = "";

  for (let index = 0; index < firstDay; index += 1) {
    const filler = document.createElement("span");
    filler.className = "calendar-filler";
    homeCalendarDays.appendChild(filler);
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const iso = toISODate(new Date(year, month, day, 12));
    const delta = daysBetween(iso, todayISO);
    const isFuture = delta > 0;
    const cell = document.createElement(isFuture ? "button" : "span");
    cell.className = "calendar-cell";
    cell.textContent = String(day);

    if (iso === todayISO) cell.classList.add("is-today");
    if (iso === selectedDate) cell.classList.add("is-selected");
    if (isFuture) {
      cell.classList.add("is-future");
      cell.setAttribute("type", "button");
      cell.addEventListener("click", () => createEventForDate(iso));
    }

    homeCalendarDays.appendChild(cell);
  }
}

function renderModalPreview() {
  modalPreview.innerHTML = buildThemeCard(state.draft, { variant: "main" });
}

function renderThemePane() {
  themePane.innerHTML = "";

  themeOrder.forEach((themeKey) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `theme-choice${state.draft.theme === themeKey ? " is-selected" : ""}`;
    button.innerHTML = `
      <span class="theme-choice-preview">${buildThemeCard({ ...state.draft, theme: themeKey }, { variant: "theme-preview" })}</span>
      <span class="theme-choice-label">${themes[themeKey].label}</span>
    `;
    button.addEventListener("click", () => {
      state.draft.theme = themeKey;
      renderThemePane();
      renderModalPreview();
      focusTitleCapture();
    });
    themePane.appendChild(button);
  });
}

function closeColorDrawer() {
  state.activeColorField = null;
}

function renderColorPane() {
  const activeField = state.activeColorField;
  const activeColor = activeField ? state.draft.colors[activeField] : null;
  const drawerTitle = activeField ? colorFieldConfig[activeField].title : "";

  colorPane.innerHTML = `
    <div class="color-panel-shell">
      <div class="color-summary-card">
        <div class="color-summary-copy">
          <p>Colores</p>
          <strong>Fondo, barra y texto</strong>
        </div>
        <div class="color-chip-row">
          ${Object.entries(colorFieldConfig).map(([field, config]) => `
            <button
              class="color-chip${activeField === field ? " is-selected" : ""}"
              type="button"
              data-color-field="${field}"
              aria-label="${config.title}"
            >
              <span class="color-chip-dot" style="--chip-fill:${state.draft.colors[field]};"></span>
              <span class="color-chip-label">${config.label}</span>
            </button>
          `).join("")}
        </div>
      </div>
      <div class="color-drawer-scrim${activeField ? " is-open" : ""}" data-close-color-drawer></div>
      <section class="color-drawer${activeField ? " is-open" : ""}" aria-hidden="${String(!activeField)}">
        <header class="color-drawer-header">
          <strong>${drawerTitle}</strong>
        </header>
        <div class="color-swatch-grid">
          ${colorSwatches.map((color) => `
            <button
              class="color-swatch${activeColor === color ? " is-selected" : ""}"
              type="button"
              data-color-value="${color}"
              style="--swatch-fill:${color};"
              aria-label="${color}"
            ></button>
          `).join("")}
        </div>
        <label class="custom-color-row">
          <span>Color personalizado</span>
          <input type="color" value="${activeColor || DEFAULT_EVENT.colors.background}" ${activeField ? "" : "disabled"}>
        </label>
      </section>
    </div>
  `;

  colorPane.querySelectorAll("[data-color-field]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeColorField = button.dataset.colorField;
      renderColorPane();
      focusTitleCapture();
    });
  });

  colorPane.querySelectorAll("[data-close-color-drawer]").forEach((element) => {
    element.addEventListener("click", () => {
      closeColorDrawer();
      renderColorPane();
    });
  });

  colorPane.querySelectorAll("[data-color-value]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!state.activeColorField) return;
      state.draft.colors[state.activeColorField] = button.dataset.colorValue;
      renderColorPane();
      renderModalPreview();
      renderThemePane();
      focusTitleCapture();
    });
  });

  const colorInput = colorPane.querySelector('input[type="color"]');
  if (colorInput) {
    colorInput.addEventListener("input", () => {
      if (!state.activeColorField) return;
      state.draft.colors[state.activeColorField] = colorInput.value.toLowerCase();
      renderColorPane();
      renderModalPreview();
      renderThemePane();
      focusTitleCapture();
    });
  }
}

function renderModalTabs() {
  const panes = {
    theme: themePane,
    colors: colorPane
  };
  const buttons = {
    theme: tabThemeButton,
    colors: tabColorsButton
  };

  Object.entries(panes).forEach(([key, pane]) => {
    pane.classList.toggle("is-active", state.activeEditorTab === key);
  });

  Object.entries(buttons).forEach(([key, button]) => {
    button.classList.toggle("is-selected", state.activeEditorTab === key);
  });
}

function renderModalChrome() {
  editorStatusLabel.textContent = state.editingEventId ? "Editando evento" : "Nuevo evento";
  titleInput.value = state.draft.title;
  saveEventButton.disabled = state.isSaving;
  saveEventButton.textContent = state.isSaving ? "Guardando..." : "Guardar";
  setEditorError(state.saveError);
  renderModalPreview();
  renderThemePane();
  renderColorPane();
  renderModalTabs();
}

function setModal(open) {
  state.isModalOpen = open;
  editorModal.classList.toggle("is-open", open);
  modalBackdrop.classList.toggle("is-open", open);
  editorModal.setAttribute("aria-hidden", String(!open));

  if (open) {
    state.deletingEventId = null;
    renderModalChrome();
    requestAnimationFrame(() => {
      titleInput.focus();
      titleInput.select();
    });
  } else {
    state.activeColorField = null;
    state.saveError = "";
    setEditorError("");
  }
}

function renderApp() {
  renderEventStack();
  renderHomeCalendar();
}

function syncToday() {
  state.today = getToday();
}

function removeEventFromState(eventId) {
  state.events = sortEvents(state.events.filter((event) => event.id !== eventId));
  state.selectedEventId = state.events[0]?.id || null;
  state.currentMonth = getMonthStart(toDateOnly(state.events[0]?.date || getCurrentTodayISO()));
}

function restoreDeletedEvent(event) {
  state.events = sortEvents([normalizeEvent(event), ...state.events]);
  state.selectedEventId = event.id;
  state.currentMonth = getMonthStart(toDateOnly(event.date));
}

function autoDeleteEvent(editingEvent) {
  if (!editingEvent || state.deletingEventId === editingEvent.id) return;

  state.deletingEventId = editingEvent.id;
  state.editingEventId = null;
  state.saveError = "";
  state.saveNotice = "";
  removeEventFromState(editingEvent.id);
  setModal(false);
  refreshAppStatus();
  renderApp();

  void (async () => {
    try {
      if (editingEvent.id.startsWith("temp-")) {
        state.discardedTempEventIds.add(editingEvent.id);
        return;
      }

      await requestJson(`/api/events/${encodeURIComponent(editingEvent.id)}`, { method: "DELETE" });
    } catch (error) {
      restoreDeletedEvent(editingEvent);
      state.saveNotice = `No se pudo borrar el evento: ${error.message}`;
    } finally {
      state.deletingEventId = null;
      refreshAppStatus();
      renderApp();
    }
  })();
}

async function saveDraft() {
  if (state.isSaving) return;

  const rawTitle = (state.draft.title || "").trim();
  const payload = {
    title: rawTitle || DEFAULT_EVENT.title,
    theme: state.draft.theme,
    colors: { ...state.draft.colors },
    date: state.draft.date
  };
  const isEditing = Boolean(state.editingEventId);
  const editingEventId = state.editingEventId;
  const previousEvent = isEditing
    ? state.events.find((event) => event.id === editingEventId) || null
    : null;
  const optimisticId = isEditing ? editingEventId : `temp-${crypto.randomUUID()}`;
  const optimisticEvent = normalizeEvent({
    ...(previousEvent || {}),
    ...payload,
    id: optimisticId,
    createdAt: previousEvent?.createdAt || state.draft.createdAt || getNowISO(),
    sortOrder: previousEvent?.sortOrder ?? 0
  });

  state.isSaving = true;
  state.saveError = "";
  state.saveNotice = "";

  if (isEditing) {
    state.events = sortEvents(
      state.events.map((event) => (event.id === editingEventId ? optimisticEvent : event))
    );
    state.selectedEventId = editingEventId;
  } else {
    state.events = applySequentialSortOrder([optimisticEvent, ...state.events]);
    state.selectedEventId = optimisticId;
  }

  state.editingEventId = null;
  setModal(false);
  refreshAppStatus();
  renderApp();
  state.isSaving = false;

  void (async () => {
    try {
      let persistedEvent;

      if (isEditing) {
        persistedEvent = normalizeEvent(
          ensurePersistedEventShape(
            await requestJson(`/api/events/${encodeURIComponent(editingEventId)}`, {
              method: "PUT",
              body: JSON.stringify(payload)
            })
          )
        );
        state.events = sortEvents(
          state.events.map((event) => (event.id === editingEventId ? persistedEvent : event))
        );
        state.selectedEventId = persistedEvent.id;
      } else {
        persistedEvent = normalizeEvent(
          ensurePersistedEventShape(
            await requestJson("/api/events", {
              method: "POST",
              body: JSON.stringify(payload)
            })
          )
        );

        if (state.discardedTempEventIds.has(optimisticId)) {
          state.discardedTempEventIds.delete(optimisticId);
          await requestJson(`/api/events/${encodeURIComponent(persistedEvent.id)}`, { method: "DELETE" });
          persistedEvent = null;
        } else {
          state.events = orderEventsBySortOrder(
            state.events.map((event) => (event.id === optimisticId ? persistedEvent : event))
          );
          if (state.selectedEventId === optimisticId) {
            state.selectedEventId = persistedEvent.id;
          }
        }
      }

      if (persistedEvent) {
        state.saveNotice = "";
      }
    } catch (error) {
      if (isEditing) {
        if (previousEvent) {
          state.events = sortEvents(
            state.events.map((event) => (event.id === editingEventId ? previousEvent : event))
          );
          state.selectedEventId = previousEvent.id;
          state.currentMonth = getMonthStart(toDateOnly(previousEvent.date));
        }
      } else {
        state.events = sortEvents(state.events.filter((event) => event.id !== optimisticId));
        state.discardedTempEventIds.delete(optimisticId);
        if (state.selectedEventId === optimisticId) {
          state.selectedEventId = state.events[0]?.id || null;
        }
      }

      state.saveNotice = `No se pudo guardar el evento: ${error.message}`;
    } finally {
      refreshAppStatus();
      renderApp();
    }
  })();
}

function closeModalWithoutSaving() {
  state.editingEventId = null;
  state.deletingEventId = null;
  state.activeColorField = null;
  setModal(false);
}

function shiftMonth(amount) {
  state.currentMonth = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth() + amount, 1);
  renderHomeCalendar();
}

function scheduleNextDayRefresh() {
  if (nextDayRefreshTimeoutId) {
    clearTimeout(nextDayRefreshTimeoutId);
  }

  nextDayRefreshTimeoutId = window.setTimeout(() => {
    syncToday();
    renderApp();
    if (state.isModalOpen) {
      renderModalChrome();
    }
    scheduleNextDayRefresh();
  }, 60000);
}

function initializeEventHandlers() {
  homePrevMonthButton.addEventListener("click", () => shiftMonth(-1));
  homeNextMonthButton.addEventListener("click", () => shiftMonth(1));

  titleInput.addEventListener("input", () => {
    state.draft.title = titleInput.value;
    const editingEvent = state.editingEventId
      ? state.events.find((event) => event.id === state.editingEventId) || null
      : null;

    if (editingEvent && !state.draft.title.trim()) {
      autoDeleteEvent(editingEvent);
      return;
    }

    renderModalPreview();
    renderThemePane();
    renderColorPane();
    renderModalChrome();
  });

  closeModalButton.addEventListener("click", closeModalWithoutSaving);
  saveEventButton.addEventListener("click", () => {
    void saveDraft();
  });
  modalBackdrop.addEventListener("click", closeModalWithoutSaving);

  [tabThemeButton, tabColorsButton].forEach((button) => {
    button.addEventListener("click", () => {
      state.activeEditorTab = button.dataset.tab;
      renderModalTabs();
      focusTitleCapture();
    });
  });

  document.addEventListener("pointerdown", (event) => {
    if (!state.isModalOpen || !state.activeColorField) return;
    const target = event.target;

    if (!(target instanceof Element)) return;
    if (target.closest(".color-drawer") || target.closest("[data-color-field]")) return;

    state.activeColorField = null;
    renderColorPane();
  });

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const isTypingTarget = target instanceof HTMLElement && (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    );

    if (!state.isModalOpen && !isTypingTarget) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        shiftMonth(-1);
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        shiftMonth(1);
      }
    }

    if (!state.isModalOpen) return;

    if (event.key === "Enter") {
      event.preventDefault();
      void saveDraft();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      if (state.activeColorField) {
        closeColorDrawer();
        renderColorPane();
        return;
      }
      closeModalWithoutSaving();
    }
  });
}

function initialize() {
  initializeEventHandlers();
  renderApp();
  void loadEvents();
  scheduleNextDayRefresh();
}

initialize();
