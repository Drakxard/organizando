const { createHttpError, deleteEvent, updateEvent } = require("../../lib/events-store");

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw createHttpError(400, "El body JSON es invalido.");
  }
}

function sendJson(res, statusCode, payload) {
  res.status(statusCode).setHeader("Content-Type", "application/json; charset=utf-8");
  res.send(JSON.stringify(payload));
}

module.exports = async (req, res) => {
  try {
    if (req.method === "PUT") {
      return sendJson(res, 200, await updateEvent(req.query.id, await readJsonBody(req)));
    }

    if (req.method === "DELETE") {
      return sendJson(res, 200, await deleteEvent(req.query.id));
    }

    res.setHeader("Allow", "PUT, DELETE");
    return sendJson(res, 405, { error: "Metodo no permitido." });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      error: error.message || "No se pudo procesar la solicitud."
    });
  }
};
