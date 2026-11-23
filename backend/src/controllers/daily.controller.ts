import type { Request, Response } from "express";
import { getRepos } from "../middleware/repositories.js";
import * as daily from "../services/daily.service.js";
import { parse } from "../validators/common.js";
import { idParamSchema } from "../validators/foods.validators.js";
import {
  dayParamSchema,
  dayWriteParamSchema,
  entryCreateSchema,
  entryListSchema,
  entryUpdateSchema,
  planMealBodySchema,
  planMealParamsSchema,
  snackBodySchema,
  snackParamsSchema,
} from "../validators/daily.validators.js";

// food entries
export async function listEntries(req: Request, res: Response) {
  const q = parse(entryListSchema, req.query);
  const [from, to] = "date" in q ? [q.date, q.date] : [q.from, q.to];
  res.json({ data: await daily.listEntries(getRepos(req), from, to) });
}
export async function createEntry(req: Request, res: Response) {
  const { entry, created } = await daily.createEntry(getRepos(req), parse(entryCreateSchema, req.body));
  res.status(created ? 201 : 200).json({ data: entry });
}
export async function updateEntry(req: Request, res: Response) {
  const { id } = parse(idParamSchema, req.params);
  res.json({ data: await daily.updateEntry(getRepos(req), id, parse(entryUpdateSchema, req.body)) });
}
export async function deleteEntry(req: Request, res: Response) {
  const { id } = parse(idParamSchema, req.params);
  await daily.deleteEntry(getRepos(req), id);
  res.status(204).end();
}

// nutrition + day
export async function dailyNutrition(req: Request, res: Response) {
  const { date } = parse(dayParamSchema, req.query);
  res.json({ data: await daily.dailyNutrition(getRepos(req), date) });
}
export async function daySummary(req: Request, res: Response) {
  const { date } = parse(dayParamSchema, req.params);
  res.json({ data: await daily.daySummary(getRepos(req), date) });
}
export async function setPlanMeal(req: Request, res: Response) {
  const { date, slot } = parse(planMealParamsSchema, req.params);
  const { eaten } = parse(planMealBodySchema, req.body);
  await daily.setPlanMealEaten(getRepos(req), date, slot, eaten);
  res.json({ data: await daily.daySummary(getRepos(req), date) });
}
export async function setSnack(req: Request, res: Response) {
  const { date, kind } = parse(snackParamsSchema, req.params);
  const { recipeId } = parse(snackBodySchema, req.body);
  await daily.setSnack(getRepos(req), date, kind, recipeId);
  res.json({ data: await daily.daySummary(getRepos(req), date) });
}
export async function resetDay(req: Request, res: Response) {
  const { date } = parse(dayWriteParamSchema, req.params);
  await daily.resetDay(getRepos(req), date);
  res.json({ data: await daily.daySummary(getRepos(req), date) });
}
