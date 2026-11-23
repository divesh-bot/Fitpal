import { Router } from "express";
import * as c from "../controllers/mealPlans.controller.js";

export function mealPlansRouter(): Router {
  const r = Router();
  const base = "/meal-plans/active";
  r.get(base, c.getActive);
  r.get(`${base}/export`, c.exportPlan);
  r.post(`${base}/import`, c.importPlan);
  r.post(`${base}/reset`, c.reset);
  r.patch(`${base}/days/:weekday`, c.updateDay); // { isStrictVeg }
  r.put(`${base}/days/:weekday/meals/:slot`, c.saveMeal);
  r.delete(`${base}/days/:weekday/meals/:slot`, c.deleteMeal);
  r.post(`${base}/days/:weekday/meals/:slot/copy`, c.copyMeal); // { toWeekdays: [..] }
  return r;
}
