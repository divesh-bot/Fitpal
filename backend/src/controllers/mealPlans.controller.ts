import type { Request, Response } from "express";
import { getRepos } from "../middleware/repositories.js";
import * as plans from "../services/mealPlans.service.js";
import { AppError } from "../utils/AppError.js";
import { parse } from "../validators/common.js";
import {
  copyMealSchema,
  dayParamsSchema,
  dayUpdateSchema,
  mealParamsSchema,
  mealSaveSchema,
  planFileV1Schema,
  prototypeFileSchema,
} from "../validators/mealPlans.validators.js";

export async function getActive(req: Request, res: Response) {
  res.json({ data: await plans.getActivePlan(getRepos(req).mealPlans) });
}

export async function saveMeal(req: Request, res: Response) {
  const { weekday, slot } = parse(mealParamsSchema, req.params);
  const input = parse(mealSaveSchema, req.body);
  res.json({ data: await plans.saveMeal(getRepos(req), weekday, slot, input) });
}

export async function deleteMeal(req: Request, res: Response) {
  const { weekday, slot } = parse(mealParamsSchema, req.params);
  res.json({ data: await plans.deleteMeal(getRepos(req).mealPlans, weekday, slot) });
}

export async function copyMeal(req: Request, res: Response) {
  const { weekday, slot } = parse(mealParamsSchema, req.params);
  const { toWeekdays } = parse(copyMealSchema, req.body);
  res.json({ data: await plans.copyMeal(getRepos(req).mealPlans, weekday, slot, toWeekdays) });
}

export async function updateDay(req: Request, res: Response) {
  const { weekday } = parse(dayParamsSchema, req.params);
  const { isStrictVeg } = parse(dayUpdateSchema, req.body);
  res.json({ data: await plans.setStrictVeg(getRepos(req).mealPlans, weekday, isStrictVeg) });
}

export async function exportPlan(req: Request, res: Response) {
  const file = await plans.exportPlan(getRepos(req));
  res.setHeader("Content-Disposition", `attachment; filename="fitpal-plan-${file.exportedAt.slice(0, 10)}.json"`);
  res.json({ data: file });
}

/** Accepts a FitPal plan file (version 1) or the HTML prototype's export (version 2). */
export async function importPlan(req: Request, res: Response) {
  const version = (req.body as { version?: unknown } | undefined)?.version;
  let file;
  if (version === 1) file = parse(planFileV1Schema, req.body);
  else if (version === 2) file = plans.fromPrototypeFile(parse(prototypeFileSchema, req.body));
  else
    throw AppError.badRequest("Unrecognised plan file. Expected a FitPal (version 1) or prototype (version 2) export.");
  res.json({ data: await plans.importPlan(getRepos(req), file) });
}

export async function reset(req: Request, res: Response) {
  res.json({ data: await plans.resetPlan(getRepos(req).mealPlans) });
}
