import { Router } from "express";
import * as c from "../controllers/account.controller.js";

export function accountRouter(): Router {
  const r = Router();
  r.get("/profile", c.getProfile);
  r.put("/profile", c.updateProfile);

  r.get("/targets", c.getTargets); // ?date=YYYY-MM-DD → target in effect that day
  r.get("/targets/history", c.listTargets);
  r.put("/targets/:effectiveFrom", c.setTargets); // new version from that date

  r.get("/preferences", c.getPreferences);
  r.put("/preferences", c.updatePreferences);
  return r;
}
