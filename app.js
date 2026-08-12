const themeOrder = ["tealSlider", "tealBars", "pixelBlack"];
const allowedThemes = new Set(themeOrder);
const hexColorPattern = /^#(?:[0-9a-fA-F]{6})$/;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const LONG_PRESS_DURATION = 650;
const PALETTES_STORAGE_KEY = "organizando-custom-palettes";
const SORT_MODE_STORAGE_KEY = "organizando-event-sort-mode";

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
  palettes: [],
  sortMode: "custom",
  selectedEventId: null,
  editingEventId: null,
  isModalOpen: false,
  activeEditorTab: "theme",
  activeColorField: null,
  isPaletteModalOpen: false,
  paletteModalMode: null,
  paletteTargetIndex: null,
  draft: createDefaultEventData(),
  isLoading: true,
  isSaving: false,
  loadError: "",
  saveError: "",
  saveNotice: "",
  deletingEventId: null,
  draggedEventId: null,
  needsFolderAccess: true,
  isFolderModalOpen: false,
  isPickingFolder: false,
  folderStatus: "Verificando carpeta...",
  folderError: "",
  hasStoredHandle: false,
  browserUnsupported: false
};

const monthFormatter = new Intl.DateTimeFormat("es-AR", { month: "long" });

const appStatus = document.getElementById("appStatus");
const eventStack = document.getElementById("eventStack");
const homeCalendarTitle = document.getElementById("homeCalendarTitle");
const homeCalendarDays = document.getElementById("homeCalendarDays");
const homePrevMonthButton = document.getElementById("homePrevMonth");
const homeNextMonthButton = document.getElementById("homeNextMonth");

const folderBackdrop = document.getElementById("folderBackdrop");
const folderModal = document.getElementById("folderModal");
const folderModalTitle = document.getElementById("folderModalTitle");
const folderModalMessage = document.getElementById("folderModalMessage");
const folderModalError = document.getElementById("folderModalError");
const selectFolderButton = document.getElementById("selectFolderButton");
const retryFolderAccessButton = document.getElementById("retryFolderAccess");

const modalBackdrop = document.getElementById("modalBackdrop");
const editorModal = document.getElementById("editorModal");
const editorError = document.getElementById("editorError");
const closeModalButton = document.getElementById("closeModal");
const saveEventButton = document.getElementById("saveEvent");
const titleInput = document.getElementById("eventTitle");
const modalPreview = document.getElementById("modalPreview");
const themePane = document.getElementById("themePane");
const colorPane = document.getElementById("colorPane");
const tabThemeButton = document.getElementById("tabTheme");
const tabColorsButton = document.getElementById("tabColors");
const paletteBackdrop = document.getElementById("paletteBackdrop");
const paletteModal = document.getElementById("paletteModal");
const paletteModalTitle = document.getElementById("paletteModalTitle");
const paletteNameInput = document.getElementById("paletteNameInput");
const cancelPaletteButton = document.getElementById("cancelPalette");
const confirmPaletteButton = document.getElementById("confirmPalette");
const backupBackdrop = document.getElementById("backupBackdrop");
const backupModal = document.getElementById("backupModal");
const closeBackupButton = document.getElementById("closeBackup");
const importBackupButton = document.getElementById("importBackup");
const exportBackupButton = document.getElementById("exportBackup");
const importBackupInput = document.getElementById("importBackupInput");
const sortTrigger = document.getElementById("sortTrigger");
const sortMenu = document.getElementById("sortMenu");

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

function loadCustomPalettes() {
  try {
    const storedPalettes = JSON.parse(window.localStorage.getItem(PALETTES_STORAGE_KEY) || "[]");
    return Array.isArray(storedPalettes)
      ? storedPalettes.filter((palette) => (
        palette &&
        typeof palette.name === "string" &&
        hexColorPattern.test(String(palette.colors?.background)) &&
        hexColorPattern.test(String(palette.colors?.progress)) &&
        hexColorPattern.test(String(palette.colors?.text))
      ))
      : [];
  } catch {
    return [];
  }
}

function saveCustomPalettes() {
  window.localStorage.setItem(PALETTES_STORAGE_KEY, JSON.stringify(state.palettes));
}

function getDisplayedEvents() {
  if (state.sortMode !== "remaining") return state.events;

  return [...state.events].sort((left, right) => {
    const dateDifference = getTargetEndOfDay(left.date).getTime() - getTargetEndOfDay(right.date).getTime();
    return dateDifference || left.sortOrder - right.sortOrder;
  });
}

function setSortMode(mode) {
  state.sortMode = mode === "remaining" ? "remaining" : "custom";
  window.localStorage.setItem(SORT_MODE_STORAGE_KEY, state.sortMode);
  sortMenu.hidden = true;
  sortTrigger.setAttribute("aria-expanded", "false");
  renderEventStack();
}

function setPaletteModal(open, mode = null, targetIndex = null) {
  state.isPaletteModalOpen = open;
  state.paletteModalMode = open ? mode : null;
  state.paletteTargetIndex = open ? targetIndex : null;
  paletteBackdrop.classList.toggle("is-open", open);
  paletteModal.classList.toggle("is-open", open);
  paletteModal.setAttribute("aria-hidden", String(!open));

  if (!open) return;

  const isDeleting = mode === "delete";
  const palette = isDeleting ? state.palettes[targetIndex] : null;
  paletteModalTitle.textContent = isDeleting ? "¿Borrar paleta?" : "Guardar colores";
  paletteModalTitle.textContent = isDeleting ? `¿Borrar “${palette?.name || ""}”?` : "Nombre de la paleta";
  paletteNameInput.hidden = isDeleting;
  confirmPaletteButton.textContent = isDeleting ? "Borrar paleta" : "Guardar paleta";
  confirmPaletteButton.classList.toggle("danger-button", isDeleting);

  if (isDeleting) {
    paletteNameInput.value = "";
  } else {
    paletteNameInput.value = "";
    requestAnimationFrame(() => paletteNameInput.focus());
  }
}

function setBackupModal(open) {
  backupBackdrop.classList.toggle("is-open", open);
  backupModal.classList.toggle("is-open", open);
  backupModal.setAttribute("aria-hidden", String(!open));
}

async function exportBackup() {
  if (state.needsFolderAccess) return;

  try {
    const events = await localEventsStore.readEventsFile();
    const backup = {
      version: 1,
      exportedAt: getNowISO(),
      events,
      palettes: state.palettes,
      sortMode: state.sortMode
    };
    const blob = new Blob([`${JSON.stringify(backup, null, 2)}\n`], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `organizando-respaldo-${getCurrentTodayISO()}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    setBackupModal(false);
  } catch (error) {
    state.saveNotice = `No se pudo exportar: ${error.message}`;
    refreshAppStatus();
  }
}

async function importBackup(file) {
  if (!file || state.needsFolderAccess) return;

  try {
    const backup = JSON.parse(await file.text());
    if (!backup || !Array.isArray(backup.events) || !Array.isArray(backup.palettes)) {
      throw createAppError("El archivo no es un respaldo válido.");
    }

    const restoredEvents = backup.events.map((event, index) => ensurePersistedEventShape(event, index));
    const restoredPalettes = backup.palettes.filter((palette) => (
      palette && typeof palette.name === "string" &&
      hexColorPattern.test(String(palette.colors?.background)) &&
      hexColorPattern.test(String(palette.colors?.progress)) &&
      hexColorPattern.test(String(palette.colors?.text))
    ));
    state.events = await localEventsStore.writeEventsFile(restoredEvents);
    state.palettes = restoredPalettes;
    state.sortMode = backup.sortMode === "remaining" ? "remaining" : "custom";
    saveCustomPalettes();
    window.localStorage.setItem(SORT_MODE_STORAGE_KEY, state.sortMode);
    state.selectedEventId = state.events[0]?.id || null;
    setBackupModal(false);
    refreshAppStatus();
    renderApp();
  } catch (error) {
    state.saveNotice = `No se pudo importar: ${error.message}`;
    refreshAppStatus();
  } finally {
    importBackupInput.value = "";
  }
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
  return hexColorPattern.test(color) ? color.toLowerCase() : fallback;
}

function getLegacyColors(paletteKey) {
  const palette = legacyPalettes[paletteKey] || legacyPalettes["palette-01"];
  return {
    background: palette.bg,
    progress: palette.primary,
    text: palette.text
  };
}

function normalizeTitle(value) {
  const title = String(value || "").trim();
  return title || DEFAULT_EVENT.title;
}

function normalizeEvent(event) {
  const legacyColors = getLegacyColors(event.palette);
  const sourceColors = event.colors && typeof event.colors === "object" ? event.colors : {};

  return {
    ...event,
    title: normalizeTitle(event.title),
    palette: typeof event.palette === "string" ? event.palette : "palette-01",
    colors: {
      background: normalizeHexColor(sourceColors.background, legacyColors.background),
      progress: normalizeHexColor(sourceColors.progress, legacyColors.progress),
      text: normalizeHexColor(sourceColors.text, legacyColors.text)
    }
  };
}

function ensurePersistedEventShape(event, index = null) {
  const prefix = index === null
    ? "El archivo events.json contiene un evento invalido."
    : `El archivo events.json contiene un evento invalido en la posicion ${index + 1}.`;

  if (!event || typeof event !== "object") {
    throw createAppError(prefix);
  }

  if (typeof event.id !== "string" || !event.id.trim()) {
    throw createAppError(`${prefix} Falta el id.`);
  }

  if (!allowedThemes.has(String(event.theme || ""))) {
    throw createAppError(`${prefix} El tema no es valido.`);
  }

  if (!isoDatePattern.test(String(event.date || ""))) {
    throw createAppError(`${prefix} La fecha debe tener formato YYYY-MM-DD.`);
  }

  if (!event.colors || typeof event.colors !== "object") {
    throw createAppError(`${prefix} Faltan los colores.`);
  }

  const hasAllColors = ["background", "progress", "text"].every((key) => {
    return hexColorPattern.test(String(event.colors[key] || ""));
  });

  if (!hasAllColors) {
    throw createAppError(`${prefix} Los colores deben tener formato hexadecimal completo.`);
  }

  const createdAt = new Date(event.createdAt || "");
  if (Number.isNaN(createdAt.getTime())) {
    throw createAppError(`${prefix} El campo createdAt no es valido.`);
  }

  const sortOrder = Number(event.sortOrder);
  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    throw createAppError(`${prefix} El sortOrder no es valido.`);
  }

  return normalizeEvent({
    ...event,
    createdAt: createdAt.toISOString(),
    sortOrder
  });
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

function createAppError(message, options = {}) {
  const error = new Error(message);
  error.requiresFolderAccess = Boolean(options.requiresFolderAccess);
  error.permissionDenied = Boolean(options.permissionDenied);
  error.unsupported = Boolean(options.unsupported);
  return error;
}

function isFileSystemAccessSupported() {
  return (
    typeof window.showDirectoryPicker === "function" &&
    typeof window.indexedDB !== "undefined"
  );
}

function isPermissionError(error) {
  return Boolean(error?.requiresFolderAccess || error?.permissionDenied);
}

function isAbortError(error) {
  return error?.name === "AbortError";
}

const localEventsStore = (() => {
  const DB_NAME = "organizando-folder-access";
  const STORE_NAME = "handles";
  const DIRECTORY_KEY = "events-directory";
  const EVENTS_FILENAME = "events.json";
  let directoryHandle = null;

  function openHandlesDb() {
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, 1);

      request.onerror = () => reject(request.error || createAppError("No se pudo abrir IndexedDB."));
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
    });
  }

  async function readHandleFromDb() {
    const db = await openHandlesDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(DIRECTORY_KEY);

      request.onerror = () => reject(request.error || createAppError("No se pudo leer la carpeta guardada."));
      request.onsuccess = () => resolve(request.result || null);
      transaction.oncomplete = () => db.close();
      transaction.onerror = () => {
        reject(transaction.error || createAppError("No se pudo completar la lectura de la carpeta guardada."));
        db.close();
      };
    });
  }

  async function writeHandleToDb(handle) {
    const db = await openHandlesDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(handle, DIRECTORY_KEY);

      request.onerror = () => reject(request.error || createAppError("No se pudo guardar la carpeta elegida."));
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        reject(transaction.error || createAppError("No se pudo guardar la carpeta elegida."));
        db.close();
      };
    });
  }

  async function clearHandleFromDb() {
    const db = await openHandlesDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(DIRECTORY_KEY);

      request.onerror = () => reject(request.error || createAppError("No se pudo limpiar la carpeta guardada."));
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        reject(transaction.error || createAppError("No se pudo limpiar la carpeta guardada."));
        db.close();
      };
    });
  }

  async function getStoredDirectoryHandle() {
    if (!isFileSystemAccessSupported()) {
      return null;
    }

    try {
      return await readHandleFromDb();
    } catch {
      return null;
    }
  }

  async function queryReadWritePermission(handle) {
    if (!handle || typeof handle.queryPermission !== "function") {
      return "denied";
    }

    try {
      return await handle.queryPermission({ mode: "readwrite" });
    } catch {
      return "denied";
    }
  }

  async function ensureEventsFileHandle(handle) {
    try {
      const fileHandle = await handle.getFileHandle(EVENTS_FILENAME, { create: true });
      const file = await fileHandle.getFile();

      if (!file.size) {
        await writeTextFile(fileHandle, "[]\n");
      }

      return fileHandle;
    } catch (error) {
      throw normalizeWorkspaceError(error, "No se pudo abrir el archivo events.json.");
    }
  }

  async function writeTextFile(fileHandle, contents) {
    try {
      const writable = await fileHandle.createWritable();
      await writable.write(contents);
      await writable.close();
    } catch (error) {
      throw normalizeWorkspaceError(error, "No se pudo escribir el archivo events.json.");
    }
  }

  function normalizeWorkspaceError(error, fallbackMessage) {
    if (error?.requiresFolderAccess || error?.unsupported) {
      return error;
    }

    if (error?.name === "NotAllowedError" || error?.name === "SecurityError") {
      return createAppError(
        "La web ya no tiene permiso para leer y escribir la carpeta seleccionada.",
        { requiresFolderAccess: true, permissionDenied: true }
      );
    }

    if (error?.name === "NotFoundError" || error?.name === "InvalidStateError") {
      return createAppError(
        "La carpeta configurada ya no esta disponible desde esta web.",
        { requiresFolderAccess: true }
      );
    }

    return createAppError(fallbackMessage || error?.message || "No se pudo acceder a la carpeta.");
  }

  async function setActiveDirectoryHandle(handle, options = {}) {
    await ensureEventsFileHandle(handle);
    directoryHandle = handle;

    if (options.persist) {
      await writeHandleToDb(handle);
    }

    return handle;
  }

  async function tryRestoreWorkspaceAccess() {
    const storedHandle = await getStoredDirectoryHandle();
    if (!storedHandle) {
      directoryHandle = null;
      return false;
    }

    const permission = await queryReadWritePermission(storedHandle);
    if (permission !== "granted") {
      directoryHandle = null;
      return false;
    }

    await setActiveDirectoryHandle(storedHandle);
    return true;
  }

  async function ensureWorkspaceAccess() {
    if (!isFileSystemAccessSupported()) {
      throw createAppError(
        "Esta app necesita Chrome o Edge con File System Access API habilitada.",
        { requiresFolderAccess: true, unsupported: true }
      );
    }

    if (directoryHandle) {
      const permission = await queryReadWritePermission(directoryHandle);
      if (permission === "granted") {
        return directoryHandle;
      }

      directoryHandle = null;
    }

    const restored = await tryRestoreWorkspaceAccess();
    if (restored) {
      return directoryHandle;
    }

    throw createAppError(
      "Selecciona una carpeta para seguir usando la app.",
      { requiresFolderAccess: true, permissionDenied: true }
    );
  }

  async function pickDirectory() {
    if (!isFileSystemAccessSupported()) {
      throw createAppError(
        "Esta app necesita Chrome o Edge con File System Access API habilitada.",
        { requiresFolderAccess: true, unsupported: true }
      );
    }

    const handle = await window.showDirectoryPicker({ mode: "readwrite" });
    const permission = await handle.requestPermission({ mode: "readwrite" });

    if (permission !== "granted") {
      throw createAppError(
        "Necesitas conceder permiso de lectura y escritura para usar esa carpeta.",
        { requiresFolderAccess: true, permissionDenied: true }
      );
    }

    await setActiveDirectoryHandle(handle, { persist: true });
    return handle;
  }

  async function readEventsFile() {
    const handle = await ensureWorkspaceAccess();
    const fileHandle = await ensureEventsFileHandle(handle);

    try {
      const file = await fileHandle.getFile();
      const text = await file.text();
      const rawEvents = text.trim() ? JSON.parse(text) : [];

      if (!Array.isArray(rawEvents)) {
        throw createAppError("El archivo events.json debe contener un array de eventos.");
      }

      return orderEventsBySortOrder(rawEvents.map((event, index) => ensurePersistedEventShape(event, index)));
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw createAppError("El archivo events.json no contiene JSON valido.");
      }

      throw normalizeWorkspaceError(error, error?.message || "No se pudo leer el archivo events.json.");
    }
  }

  async function writeEventsFile(events) {
    const handle = await ensureWorkspaceAccess();
    const fileHandle = await ensureEventsFileHandle(handle);
    const normalizedEvents = applySequentialSortOrder(events).map((event, index) => {
      return ensurePersistedEventShape({
        ...normalizeEvent(event),
        sortOrder: index
      });
    });

    await writeTextFile(fileHandle, `${JSON.stringify(normalizedEvents, null, 2)}\n`);
    return normalizedEvents;
  }

  async function listEvents() {
    return readEventsFile();
  }

  async function createEvent(payload) {
    const currentEvents = await readEventsFile();
    const createdEvent = ensurePersistedEventShape({
      id: crypto.randomUUID(),
      title: normalizeTitle(payload.title),
      theme: payload.theme,
      palette: "palette-01",
      colors: {
        background: normalizeHexColor(payload.colors?.background, DEFAULT_EVENT.colors.background),
        progress: normalizeHexColor(payload.colors?.progress, DEFAULT_EVENT.colors.progress),
        text: normalizeHexColor(payload.colors?.text, DEFAULT_EVENT.colors.text)
      },
      date: String(payload.date || ""),
      createdAt: getNowISO(),
      sortOrder: 0
    });
    const nextEvents = await writeEventsFile([createdEvent, ...currentEvents]);

    return nextEvents.find((event) => event.id === createdEvent.id);
  }

  async function updateEvent(id, payload) {
    const currentEvents = await readEventsFile();
    const eventIndex = currentEvents.findIndex((event) => event.id === id);

    if (eventIndex === -1) {
      throw createAppError("Evento no encontrado.");
    }

    const previousEvent = currentEvents[eventIndex];
    const nextEvent = ensurePersistedEventShape({
      ...previousEvent,
      ...payload,
      title: payload.title !== undefined ? normalizeTitle(payload.title) : previousEvent.title,
      colors: payload.colors
        ? {
            background: normalizeHexColor(payload.colors.background, previousEvent.colors.background),
            progress: normalizeHexColor(payload.colors.progress, previousEvent.colors.progress),
            text: normalizeHexColor(payload.colors.text, previousEvent.colors.text)
          }
        : previousEvent.colors,
      sortOrder: payload.sortOrder ?? previousEvent.sortOrder
    });
    const nextEvents = [...currentEvents];
    nextEvents[eventIndex] = nextEvent;
    const persistedEvents = await writeEventsFile(nextEvents);

    return persistedEvents.find((event) => event.id === id);
  }

  async function deleteEvent(id) {
    const currentEvents = await readEventsFile();
    const eventToDelete = currentEvents.find((event) => event.id === id);

    if (!eventToDelete) {
      throw createAppError("Evento no encontrado.");
    }

    await writeEventsFile(currentEvents.filter((event) => event.id !== id));
    return eventToDelete;
  }

  async function persistEventOrder(events) {
    return writeEventsFile(events);
  }

  async function forgetWorkspaceHandle() {
    directoryHandle = null;
    await clearHandleFromDb();
  }

  async function hasSavedHandle() {
    return Boolean(await getStoredDirectoryHandle());
  }

  return {
    createEvent,
    deleteEvent,
    ensureWorkspaceAccess,
    forgetWorkspaceHandle,
    hasSavedHandle,
    listEvents,
    persistEventOrder,
    pickDirectory,
    readEventsFile,
    tryRestoreWorkspaceAccess,
    updateEvent,
    writeEventsFile
  };
})();

function refreshAppStatus() {
  if (state.needsFolderAccess) {
    setAppStatus("");
    return;
  }

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

function setFolderAccessState(nextState = {}) {
  if (nextState.needsFolderAccess !== undefined) {
    state.needsFolderAccess = nextState.needsFolderAccess;
  }

  if (nextState.isFolderModalOpen !== undefined) {
    state.isFolderModalOpen = nextState.isFolderModalOpen;
  } else {
    state.isFolderModalOpen = state.needsFolderAccess;
  }

  if (nextState.folderStatus !== undefined) {
    state.folderStatus = nextState.folderStatus;
  }

  if (nextState.folderError !== undefined) {
    state.folderError = nextState.folderError;
  }

  if (nextState.browserUnsupported !== undefined) {
    state.browserUnsupported = nextState.browserUnsupported;
  }

  if (nextState.hasStoredHandle !== undefined) {
    state.hasStoredHandle = nextState.hasStoredHandle;
  }

  renderFolderAccessModal();
}

function renderFolderAccessModal() {
  const open = state.isFolderModalOpen;
  folderBackdrop.classList.toggle("is-open", open);
  folderModal.classList.toggle("is-open", open);
  folderModal.setAttribute("aria-hidden", String(!open));

  const title = state.browserUnsupported
    ? "Navegador no compatible"
    : state.hasStoredHandle
      ? "Recuperar acceso a la carpeta"
      : "Elegi una carpeta local";
  const message = state.browserUnsupported
    ? "Abre esta web en Chrome o Edge para usar lectura y escritura directa sobre una carpeta local."
    : state.folderStatus
      ? state.folderStatus
      : "La app guarda todo en un archivo events.json dentro de una carpeta local.";

  folderModalTitle.textContent = title;
  folderModalMessage.textContent = message;
  folderModalError.hidden = !state.folderError;
  folderModalError.textContent = state.folderError;
  selectFolderButton.disabled = state.isPickingFolder || state.browserUnsupported;
  selectFolderButton.textContent = state.isPickingFolder ? "Abriendo selector..." : "Seleccionar carpeta";
  retryFolderAccessButton.disabled = state.isPickingFolder;
  retryFolderAccessButton.hidden = state.browserUnsupported || !state.hasStoredHandle;
}

async function loadEvents() {
  state.isLoading = true;
  state.loadError = "";
  state.saveNotice = "";
  refreshAppStatus();
  renderApp();

  try {
    const events = orderEventsBySortOrder((await localEventsStore.listEvents()).map(normalizeEvent));
    state.events = events;
    state.selectedEventId = events[0]?.id || null;
  } catch (error) {
    if (isPermissionError(error)) {
      await handleWorkspaceAccessLoss(error);
      return;
    }

    state.loadError = error.message;
    setFolderAccessState({
      needsFolderAccess: true,
      folderStatus: "",
      folderError: error.message,
      hasStoredHandle: await localEventsStore.hasSavedHandle()
    });
  } finally {
    state.isLoading = false;
    refreshAppStatus();
    renderApp();
  }
}

function createEventForDate(date) {
  if (state.needsFolderAccess) {
    return;
  }

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

function openEventForEditing(event) {
  if (!event) return;

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

  if (state.needsFolderAccess) {
    eventStack.innerHTML = `<p class="stack-empty">Selecciona una carpeta local para leer y guardar eventos.</p>`;
    return;
  }

  if (state.events.length === 0) {
    const message = state.loadError
      ? "No se pudieron leer los datos guardados. Revisa el modal de carpeta."
      : "No hay eventos guardados. Usa una fecha futura para crear el primero.";
    eventStack.innerHTML = `<p class="stack-empty">${escapeHtml(message)}</p>`;
    return;
  }

  getDisplayedEvents().forEach((event) => {
    const button = document.createElement("button");
    let longPressTimerId = null;
    let longPressTriggered = false;
    button.type = "button";
    button.className = `stack-item${state.selectedEventId === event.id ? " is-selected" : ""}${state.draggedEventId === event.id ? " is-dragging" : ""}`;
    button.draggable = true;
    button.dataset.eventId = event.id;
    button.innerHTML = buildThemeCard(event, { variant: "stack" });
    button.addEventListener("click", () => {
      if (longPressTriggered) {
        return;
      }

      openEventForEditing(event);
    });
    button.addEventListener("pointerdown", (pointerEvent) => {
      if (pointerEvent.button !== 0 || state.isSaving || state.needsFolderAccess) return;

      longPressTriggered = false;
      longPressTimerId = window.setTimeout(() => {
        longPressTimerId = null;
        longPressTriggered = true;
        void requestEventDeletion(event);
      }, LONG_PRESS_DURATION);
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach((eventName) => {
      button.addEventListener(eventName, () => {
        if (longPressTimerId !== null) {
          clearTimeout(longPressTimerId);
          longPressTimerId = null;
        }
      });
    });
    button.addEventListener("dragstart", (dragEvent) => {
      if (longPressTimerId !== null) {
        clearTimeout(longPressTimerId);
        longPressTimerId = null;
      }
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
          state.events = await localEventsStore.persistEventOrder(reorderedEvents);
        } catch (error) {
          if (isPermissionError(error)) {
            await handleWorkspaceAccessLoss(error);
            return;
          }

          state.events = previousEvents;
          state.saveNotice = `No se pudo guardar el orden: ${error.message}`;
        } finally {
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
  const eventsByDate = state.events.reduce((events, event) => {
    const eventsForDate = events.get(event.date) || [];
    eventsForDate.push(event);
    events.set(event.date, eventsForDate);
    return events;
  }, new Map());

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
    const canCreate = isFuture && !state.needsFolderAccess;
    const eventsForDate = eventsByDate.get(iso) || [];
    const eventCount = eventsForDate.length;
    const cell = document.createElement(canCreate || eventCount > 0 ? "button" : "span");
    cell.className = "calendar-cell";
    cell.textContent = String(day);

    if (iso === todayISO) cell.classList.add("is-today");
    if (iso === selectedDate) cell.classList.add("is-selected");
    if (isFuture) {
      cell.classList.add("is-future");
    }

    if (eventCount > 0) {
      cell.classList.add("has-events");
      cell.classList.add("has-event-preview");
      if ((firstDay + day - 1) % 7 >= 4) {
        cell.classList.add("preview-left");
      }
      const eventPreview = eventCount === 1
        ? eventsForDate[0].title
        : `${eventsForDate[0].title} +${eventCount - 1}`;
      cell.dataset.eventPreview = eventPreview;
      cell.setAttribute("aria-label", `${day}: ${eventCount} evento${eventCount === 1 ? "" : "s"}`);
    }
    if (eventCount > 1) {
      cell.classList.add("has-conflict");
    }

    if (canCreate || eventCount > 0) {
      cell.setAttribute("type", "button");
      cell.addEventListener("click", () => {
        if (eventCount > 0) {
          openEventForEditing(eventsForDate[0]);
          return;
        }

        createEventForDate(iso);
      });
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
      <div class="palette-chip-column">
          ${state.palettes.map((palette, index) => `
            <button class="color-chip palette-chip" type="button" data-palette-index="${index}" aria-label="Aplicar paleta ${escapeHtml(palette.name)}">
              <span class="color-chip-dot palette-dot" style="--palette-background:${palette.colors.background};--palette-progress:${palette.colors.progress};--palette-text:${palette.colors.text};"></span>
              <span class="color-chip-label">${escapeHtml(palette.name)}</span>
            </button>
          `).join("")}
          <button class="color-chip palette-chip palette-add" type="button" data-save-palette aria-label="Guardar la paleta actual">
            <span class="color-chip-dot">+</span>
          </button>
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
      const drawer = colorPane.querySelector(".color-drawer");
      const shell = colorPane.querySelector(".color-panel-shell");
      if (drawer && shell) {
        drawer.style.setProperty("--drawer-top", `${button.offsetTop}px`);
      }
      focusTitleCapture();
    });
  });

  colorPane.querySelectorAll("[data-palette-index]").forEach((button) => {
    let longPressTimerId = null;
    let longPressTriggered = false;
    button.addEventListener("click", () => {
      if (longPressTriggered) return;
      const palette = state.palettes[Number(button.dataset.paletteIndex)];
      if (!palette) return;

      state.draft.colors = { ...palette.colors };
      closeColorDrawer();
      renderColorPane();
      renderModalPreview();
      renderThemePane();
      focusTitleCapture();
    });
    button.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      longPressTriggered = false;
      longPressTimerId = window.setTimeout(() => {
        longPressTimerId = null;
        longPressTriggered = true;
        setPaletteModal(true, "delete", Number(button.dataset.paletteIndex));
      }, LONG_PRESS_DURATION);
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach((eventName) => {
      button.addEventListener(eventName, () => {
        if (longPressTimerId !== null) {
          clearTimeout(longPressTimerId);
          longPressTimerId = null;
        }
      });
    });
  });

  colorPane.querySelector("[data-save-palette]")?.addEventListener("click", () => {
    setPaletteModal(true, "create");
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
  titleInput.value = state.draft.title;
  saveEventButton.disabled = state.isSaving || state.needsFolderAccess;
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
  state.events = orderEventsBySortOrder(applySequentialSortOrder([normalizeEvent(event), ...state.events]));
  state.selectedEventId = event.id;
  state.currentMonth = getMonthStart(toDateOnly(event.date));
}

async function handleWorkspaceAccessLoss(error) {
  state.isSaving = false;
  state.loadError = "";
  state.saveError = "";
  state.saveNotice = "";
  setModal(false);
  setFolderAccessState({
    needsFolderAccess: true,
    folderStatus: "",
    folderError: error.message,
    hasStoredHandle: await localEventsStore.hasSavedHandle()
  });
  refreshAppStatus();
  renderApp();
}

async function requestEventDeletion(event) {
  if (!event || state.deletingEventId === event.id) return;

  const confirmed = window.confirm(`¿Querés borrar el evento "${event.title}"?`);
  if (!confirmed) return;

  await deleteEvent(event);
}

async function deleteEvent(event) {
  if (!event || state.deletingEventId === event.id) return;

  state.deletingEventId = event.id;
  state.editingEventId = null;
  state.saveError = "";
  state.saveNotice = "";
  removeEventFromState(event.id);
  setModal(false);
  refreshAppStatus();
  renderApp();

  try {
    await localEventsStore.deleteEvent(event.id);
  } catch (error) {
    if (isPermissionError(error)) {
      await handleWorkspaceAccessLoss(error);
      return;
    }

    restoreDeletedEvent(event);
    state.saveNotice = `No se pudo borrar el evento: ${error.message}`;
  } finally {
    state.deletingEventId = null;
    refreshAppStatus();
    renderApp();
  }
}

async function saveDraft() {
  if (state.isSaving || state.needsFolderAccess) return;

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

  state.isSaving = true;
  state.saveError = "";
  state.saveNotice = "";
  renderModalChrome();

  try {
    let persistedEvent;

    if (isEditing) {
      persistedEvent = normalizeEvent(await localEventsStore.updateEvent(editingEventId, payload));
      state.events = sortEvents(
        state.events.map((event) => (event.id === editingEventId ? persistedEvent : event))
      );
      state.selectedEventId = persistedEvent.id;
    } else {
      persistedEvent = normalizeEvent(await localEventsStore.createEvent(payload));
      state.events = orderEventsBySortOrder([persistedEvent, ...state.events]);
      state.selectedEventId = persistedEvent.id;
    }

    state.editingEventId = null;
    setModal(false);
  } catch (error) {
    if (isPermissionError(error)) {
      await handleWorkspaceAccessLoss(error);
      return;
    }

    if (isEditing && previousEvent) {
      state.events = sortEvents(
        state.events.map((event) => (event.id === editingEventId ? previousEvent : event))
      );
      state.selectedEventId = previousEvent.id;
      state.currentMonth = getMonthStart(toDateOnly(previousEvent.date));
    }

    state.saveError = error.message;
    setModal(true);
  } finally {
    state.isSaving = false;
    refreshAppStatus();
    renderApp();
    if (state.isModalOpen) {
      renderModalChrome();
    }
  }
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

async function retryStoredFolderAccess() {
  if (state.isPickingFolder || state.browserUnsupported) return;

  setFolderAccessState({
    folderStatus: "Verificando carpeta guardada...",
    folderError: ""
  });

  try {
    const restored = await localEventsStore.tryRestoreWorkspaceAccess();

    if (!restored) {
      setFolderAccessState({
        needsFolderAccess: true,
        folderStatus: "",
        folderError: "La web no tiene acceso vigente a la carpeta guardada.",
        hasStoredHandle: await localEventsStore.hasSavedHandle()
      });
      return;
    }

    setFolderAccessState({
      needsFolderAccess: false,
      folderStatus: "",
      folderError: "",
      hasStoredHandle: true
    });
    await loadEvents();
  } catch (error) {
    setFolderAccessState({
      needsFolderAccess: true,
      folderStatus: "",
      folderError: error.message,
      hasStoredHandle: await localEventsStore.hasSavedHandle()
    });
    state.isLoading = false;
    refreshAppStatus();
    renderApp();
  }
}

async function selectWorkspaceFolder() {
  if (state.isPickingFolder || state.browserUnsupported) return;

  state.isPickingFolder = true;
  setFolderAccessState({
    folderStatus: "Esperando seleccion de carpeta...",
    folderError: ""
  });

  try {
    await localEventsStore.pickDirectory();
    setFolderAccessState({
      needsFolderAccess: false,
      folderStatus: "",
      folderError: "",
      hasStoredHandle: true
    });
    await loadEvents();
  } catch (error) {
    const folderError = isAbortError(error)
      ? "No se selecciono ninguna carpeta."
      : error.message;

    setFolderAccessState({
      needsFolderAccess: true,
      folderStatus: "",
      folderError,
      hasStoredHandle: await localEventsStore.hasSavedHandle()
    });
  } finally {
    state.isPickingFolder = false;
    renderFolderAccessModal();
  }
}

async function bootstrapWorkspace() {
  state.isLoading = true;
  state.loadError = "";
  state.saveNotice = "";
  state.browserUnsupported = !isFileSystemAccessSupported();
  state.hasStoredHandle = await localEventsStore.hasSavedHandle();
  refreshAppStatus();
  renderApp();

  if (state.browserUnsupported) {
    state.isLoading = false;
    setFolderAccessState({
      needsFolderAccess: true,
      browserUnsupported: true,
      folderStatus: "",
      folderError: "Esta app necesita Chrome o Edge para acceder a una carpeta local.",
      hasStoredHandle: false
    });
    refreshAppStatus();
    renderApp();
    return;
  }

  try {
    const restored = await localEventsStore.tryRestoreWorkspaceAccess();

    if (!restored) {
      state.isLoading = false;
      setFolderAccessState({
        needsFolderAccess: true,
        folderStatus: "",
        folderError: state.hasStoredHandle
          ? "La web necesita que vuelvas a autorizar la carpeta guardada."
          : "Selecciona una carpeta para guardar los eventos.",
        hasStoredHandle: await localEventsStore.hasSavedHandle()
      });
      refreshAppStatus();
      renderApp();
      return;
    }

    setFolderAccessState({
      needsFolderAccess: false,
      folderStatus: "",
      folderError: "",
      hasStoredHandle: true
    });
    await loadEvents();
  } catch (error) {
    state.isLoading = false;
    setFolderAccessState({
      needsFolderAccess: true,
      folderStatus: "",
      folderError: error.message,
      hasStoredHandle: await localEventsStore.hasSavedHandle()
    });
    refreshAppStatus();
    renderApp();
  }
}

function initializeEventHandlers() {
  homePrevMonthButton.addEventListener("click", () => shiftMonth(-1));
  homeNextMonthButton.addEventListener("click", () => shiftMonth(1));

  titleInput.addEventListener("input", () => {
    state.draft.title = titleInput.value;
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
  selectFolderButton.addEventListener("click", () => {
    void selectWorkspaceFolder();
  });
  retryFolderAccessButton.addEventListener("click", () => {
    void retryStoredFolderAccess();
  });
  sortTrigger.addEventListener("click", () => {
    const open = sortMenu.hidden;
    sortMenu.hidden = !open;
    sortTrigger.setAttribute("aria-expanded", String(open));
  });
  sortMenu.querySelectorAll("[data-sort-mode]").forEach((button) => {
    button.addEventListener("click", () => setSortMode(button.dataset.sortMode));
  });
  cancelPaletteButton.addEventListener("click", () => setPaletteModal(false));
  paletteBackdrop.addEventListener("click", () => setPaletteModal(false));
  confirmPaletteButton.addEventListener("click", () => {
    if (state.paletteModalMode === "delete") {
      state.palettes.splice(state.paletteTargetIndex, 1);
      saveCustomPalettes();
      setPaletteModal(false);
      renderColorPane();
      return;
    }

    const name = paletteNameInput.value.trim();
    if (!name) {
      paletteNameInput.focus();
      return;
    }

    state.palettes.push({ name, colors: { ...state.draft.colors } });
    saveCustomPalettes();
    setPaletteModal(false);
    renderColorPane();
  });
  closeBackupButton.addEventListener("click", () => setBackupModal(false));
  backupBackdrop.addEventListener("click", () => setBackupModal(false));
  exportBackupButton.addEventListener("click", () => {
    void exportBackup();
  });
  importBackupButton.addEventListener("click", () => importBackupInput.click());
  importBackupInput.addEventListener("change", () => {
    void importBackup(importBackupInput.files?.[0]);
  });

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

    if (event.key === "|" && !isTypingTarget && !state.isModalOpen && !state.isFolderModalOpen) {
      event.preventDefault();
      setBackupModal(!backupModal.classList.contains("is-open"));
      return;
    }

    if (!state.isModalOpen && !state.needsFolderAccess && !isTypingTarget) {
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

    if (state.needsFolderAccess) {
      return;
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
  state.palettes = loadCustomPalettes();
  state.sortMode = window.localStorage.getItem(SORT_MODE_STORAGE_KEY) === "remaining" ? "remaining" : "custom";
  initializeEventHandlers();
  renderApp();
  renderFolderAccessModal();
  void bootstrapWorkspace();
  scheduleNextDayRefresh();
}

initialize();
