import { Router } from "express";
import * as c from "../controllers/tracking.controller.js";

export function trackingRouter(): Router {
  const r = Router();
  r.get("/checkins", c.listCheckins); // ?from=&to=
  r.get("/checkins/:date", c.getCheckin);
  r.put("/checkins/:date", c.saveCheckin); // partial upsert
  r.delete("/checkins/:date", c.deleteCheckin);
  r.get("/progress/weight", c.weightProgress); // ?from=&to=

  r.get("/habits", c.listHabits);
  r.post("/habits", c.createHabit);
  r.put("/habits/:id", c.updateHabit);
  r.delete("/habits/:id", c.deleteHabit);
  r.get("/habit-logs", c.habitLogs); // ?from=&to=
  r.put("/habit-logs/:habitId/:date", c.setHabitLog); // { completed }
  return r;
}
