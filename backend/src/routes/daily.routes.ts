import { Router } from "express";
import * as c from "../controllers/daily.controller.js";

export function dailyRouter(): Router {
  const r = Router();
  r.get("/food-entries", c.listEntries); // ?date= or ?from=&to=
  r.post("/food-entries", c.createEntry);
  r.put("/food-entries/:id", c.updateEntry);
  r.delete("/food-entries/:id", c.deleteEntry);

  r.get("/nutrition/daily", c.dailyNutrition); // ?date=
  r.get("/days/:date", c.daySummary); // everything for the Today screen
  r.put("/days/:date/plan-meals/:slot", c.setPlanMeal); // { eaten }
  r.put("/days/:date/snacks/:kind", c.setSnack); // { recipeId | null }
  r.post("/days/:date/reset", c.resetDay);
  return r;
}
