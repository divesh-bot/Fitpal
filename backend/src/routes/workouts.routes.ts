import { Router } from "express";
import * as c from "../controllers/workouts.controller.js";

export function workoutsRouter(): Router {
  const r = Router();
  // Static paths before "/workouts/:id" so they aren't treated as ids.
  r.get("/workouts/exercises", c.exercises);
  r.get("/workouts/progression", c.progression); // ?exercise=Bench press
  r.get("/workouts", c.list); // ?from=&to=&limit=
  r.post("/workouts", c.create);
  r.get("/workouts/:id", c.get);
  r.put("/workouts/:id", c.replace);
  r.delete("/workouts/:id", c.remove);
  return r;
}
