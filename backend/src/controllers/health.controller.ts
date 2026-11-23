import type { RequestHandler } from "express";
import type { ApiSuccess } from "../types/api.js";

export const API_VERSION = "1";

interface HealthPayload {
  status: "ok";
  version: string;
  timestamp: string;
}

/** Liveness check used by Render and by the frontend connection indicator. */
export const getHealth: RequestHandler = (_req, res) => {
  const body: ApiSuccess<HealthPayload> = {
    data: { status: "ok", version: API_VERSION, timestamp: new Date().toISOString() },
  };
  res.set("Cache-Control", "no-store").json(body);
};
