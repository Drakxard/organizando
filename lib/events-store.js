const { randomUUID } = require("node:crypto");
const { getSql } = require("./db");

const allowedThemes = new Set(["tealSlider", "tealBars", "pixelBlack"]);
const allowedPalettes = new Set([
  "palette-01",
  "palette-02",
  "palette-03",
  "palette-04",
  "palette-05",
  "palette-06",
  "palette-07",
  "palette-08"
]);
const hexColorPattern = /^#(?:[0-9a-fA-F]{6})$/;

const paletteDefaults = {
  "palette-01": {
    background: "#dff7df",
    progress: "#6bdd43",
    text: "#162015"
  },
  "palette-02": {
    background: "#ffe6c8",
    progress: "#ff9640",
    text: "#2e2118"
  },
  "palette-03": {
    background: "#d9ecff",
    progress: "#4e9fff",
    text: "#152235"
  },
  "palette-04": {
    background: "#ede2ff",
    progress: "#8a63d8",
    text: "#241c36"
  },
  "palette-05": {
    background: "#151b13",
    progress: "#75df46",
    text: "#dfffd5"
  },
  "palette-06": {
    background: "#ffe0ee",
    progress: "#ea5ba4",
    text: "#331224"
  },
  "palette-07": {
    background: "#d8f8f3",
    progress: "#36bfa5",
    text: "#142a26"
  },
  "palette-08": {
    background: "#d6d8df",
    progress: "#515d79",
    text: "#1a1f28"
  }
};

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function wrapDatabaseError(error) {
  if (error?.statusCode) {
    throw error;
  }

  if (error?.code === "42703" || error?.code === "23502") {
    throw createHttpError(
      500,
      "La base no tiene el esquema esperado. Ejecuta `npm run db:init` y vuelve a intentar."
    );
  }

  throw error;
}

function isIsoDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toIsoDate(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw createHttpError(500, "La base devolvio una fecha invalida.");
  }

  return date.toISOString().slice(0, 10);
}

function toIsoDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw createHttpError(500, "La base devolvio un timestamp invalido.");
  }

  return date.toISOString();
}

function serializeEvent(row) {
  const legacyPalette = allowedPalettes.has(row.palette) ? row.palette : "palette-01";
  const fallbackColors = paletteDefaults[legacyPalette];
  return {
    id: row.id,
    title: row.title,
    theme: row.theme,
    palette: row.palette,
    colors: {
      background: row.background_color || fallbackColors.background,
      progress: row.progress_color || fallbackColors.progress,
      text: row.text_color || fallbackColors.text
    },
    date: toIsoDate(row.date),
    createdAt: toIsoDateTime(row.created_at),
    sortOrder: Number(row.sort_order)
  };
}

function normalizeTitle(value) {
  const title = String(value || "").trim();
  return title || "Titulo";
}

function normalizeCreatePayload(payload = {}) {
  const title = normalizeTitle(payload.title);
  const theme = String(payload.theme || "");
  const date = String(payload.date || "");
  const colors = normalizeColors(payload.colors, payload.palette);

  if (!allowedThemes.has(theme)) {
    throw createHttpError(400, "Tema invalido.");
  }

  if (!isIsoDate(date)) {
    throw createHttpError(400, "La fecha debe tener formato YYYY-MM-DD.");
  }

  return {
    id: randomUUID(),
    title,
    theme,
    palette: String(payload.palette || "palette-01"),
    colors,
    date
  };
}

function normalizeUpdatePayload(payload = {}) {
  const next = {};

  if (payload.title !== undefined) {
    next.title = normalizeTitle(payload.title);
  }

  if (payload.theme !== undefined) {
    const theme = String(payload.theme || "");

    if (!allowedThemes.has(theme)) {
      throw createHttpError(400, "Tema invalido.");
    }

    next.theme = theme;
  }

  if (payload.colors !== undefined || payload.palette !== undefined) {
    next.colors = normalizeColors(payload.colors, payload.palette);
    if (payload.palette !== undefined) {
      next.palette = String(payload.palette || "palette-01");
    }
  }

  if (payload.date !== undefined) {
    const date = String(payload.date || "");

    if (!isIsoDate(date)) {
      throw createHttpError(400, "La fecha debe tener formato YYYY-MM-DD.");
    }

    next.date = date;
  }

  if (payload.sortOrder !== undefined) {
    const sortOrder = Number(payload.sortOrder);

    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      throw createHttpError(400, "El orden debe ser un entero mayor o igual a 0.");
    }

    next.sortOrder = sortOrder;
  }

  if (Object.keys(next).length === 0) {
    throw createHttpError(400, "No hay cambios para guardar.");
  }

  return next;
}

function normalizeHexColor(value, label) {
  const color = String(value || "").trim();

  if (!hexColorPattern.test(color)) {
    throw createHttpError(400, `${label} invalido.`);
  }

  return color.toLowerCase();
}

function normalizeColors(colors, paletteKey) {
  const fallback = paletteDefaults[allowedPalettes.has(String(paletteKey || "")) ? String(paletteKey) : "palette-01"];
  const source = colors && typeof colors === "object" ? colors : {};

  return {
    background: normalizeHexColor(source.background || fallback.background, "Color de fondo"),
    progress: normalizeHexColor(source.progress || fallback.progress, "Color de barra"),
    text: normalizeHexColor(source.text || fallback.text, "Color de texto")
  };
}

async function listEvents() {
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT id, title, theme, palette, background_color, progress_color, text_color, date, created_at, sort_order
      FROM events
      ORDER BY sort_order ASC, created_at DESC
    `;

    return rows.map(serializeEvent);
  } catch (error) {
    wrapDatabaseError(error);
  }
}

async function createEvent(payload) {
  try {
    const sql = getSql();
    const input = normalizeCreatePayload(payload);
    const [{ next_sort_order: nextSortOrder = 0 } = {}] = await sql`
      SELECT COALESCE(MIN(sort_order), 0) - 1 AS next_sort_order
      FROM events
    `;
    const rows = await sql`
      INSERT INTO events (id, title, theme, palette, background_color, progress_color, text_color, date, sort_order)
      VALUES (
        ${input.id},
        ${input.title},
        ${input.theme},
        ${input.palette},
        ${input.colors.background},
        ${input.colors.progress},
        ${input.colors.text},
        ${input.date},
        ${nextSortOrder}
      )
      RETURNING id, title, theme, palette, background_color, progress_color, text_color, date, created_at, sort_order
    `;

    return serializeEvent(rows[0]);
  } catch (error) {
    wrapDatabaseError(error);
  }
}

async function updateEvent(id, payload) {
  if (!id) {
    throw createHttpError(400, "Falta el id del evento.");
  }

  try {
    const sql = getSql();
    const input = normalizeUpdatePayload(payload);
    const updates = {};

    if (input.title !== undefined) updates.title = input.title;
    if (input.theme !== undefined) updates.theme = input.theme;
    if (input.palette !== undefined) updates.palette = input.palette;
    if (input.colors !== undefined) {
      updates.background_color = input.colors.background;
      updates.progress_color = input.colors.progress;
      updates.text_color = input.colors.text;
    }
    if (input.date !== undefined) updates.date = input.date;
    if (input.sortOrder !== undefined) updates.sort_order = input.sortOrder;

    const rows = await sql`
      UPDATE events
      SET ${sql(updates)}
      WHERE id = ${id}
      RETURNING id, title, theme, palette, background_color, progress_color, text_color, date, created_at, sort_order
    `;

    if (!rows[0]) {
      throw createHttpError(404, "Evento no encontrado.");
    }

    return serializeEvent(rows[0]);
  } catch (error) {
    wrapDatabaseError(error);
  }
}

async function deleteEvent(id) {
  if (!id) {
    throw createHttpError(400, "Falta el id del evento.");
  }

  try {
    const sql = getSql();
    const rows = await sql`
      DELETE FROM events
      WHERE id = ${id}
      RETURNING id, title, theme, palette, background_color, progress_color, text_color, date, created_at, sort_order
    `;

    if (!rows[0]) {
      throw createHttpError(404, "Evento no encontrado.");
    }

    return serializeEvent(rows[0]);
  } catch (error) {
    wrapDatabaseError(error);
  }
}

module.exports = {
  deleteEvent,
  createEvent,
  createHttpError,
  listEvents,
  updateEvent
};
