import type { Request, Response } from "express";
import { getRepos } from "../middleware/repositories.js";
import * as t from "../services/tracking.service.js";
import { parse } from "../validators/common.js";
import { idParamSchema } from "../validators/foods.validators.js";
import {
  checkinSchema,
  dateParamSchema,
  dateRangeSchema,
  habitCreateSchema,
  habitListSchema,
  habitLogBodySchema,
  habitLogParamsSchema,
  habitUpdateSchema,
} from "../validators/tracking.validators.js";

const range366 = dateRangeSchema(366);

// check-ins
export async function listCheckins(req: Request, res: Response) {
  const { from, to } = parse(range366, req.query);
  res.json({ data: await t.listCheckins(getRepos(req).checkins, from, to) });
}
export async function getCheckin(req: Request, res: Response) {
  const { date } = parse(dateParamSchema, req.params);
  res.json({ data: await t.getCheckin(getRepos(req).checkins, date) });
}
export async function saveCheckin(req: Request, res: Response) {
  const { date } = parse(dateParamSchema, req.params);
  const input = parse(checkinSchema, req.body);
  res.json({ data: await t.saveCheckin(getRepos(req).checkins, date, input) });
}
export async function deleteCheckin(req: Request, res: Response) {
  const { date } = parse(dateParamSchema, req.params);
  await t.deleteCheckin(getRepos(req).checkins, date);
  res.status(204).end();
}
export async function weightProgress(req: Request, res: Response) {
  const { from, to } = parse(range366, req.query);
  res.json({ data: await t.weightProgress(getRepos(req).checkins, from, to) });
}

// habits
export async function listHabits(req: Request, res: Response) {
  const { includeInactive } = parse(habitListSchema, req.query);
  res.json({ data: await t.listHabits(getRepos(req).habits, includeInactive === "true") });
}
export async function createHabit(req: Request, res: Response) {
  const input = parse(habitCreateSchema, req.body);
  res.status(201).json({ data: await t.createHabit(getRepos(req).habits, input) });
}
export async function updateHabit(req: Request, res: Response) {
  const { id } = parse(idParamSchema, req.params);
  const input = parse(habitUpdateSchema, req.body);
  res.json({ data: await t.updateHabit(getRepos(req).habits, id, input) });
}
export async function deleteHabit(req: Request, res: Response) {
  const { id } = parse(idParamSchema, req.params);
  await t.deleteHabit(getRepos(req).habits, id);
  res.status(204).end();
}
export async function habitLogs(req: Request, res: Response) {
  const { from, to } = parse(range366, req.query);
  res.json({ data: await t.habitLogs(getRepos(req).habits, from, to) });
}
export async function setHabitLog(req: Request, res: Response) {
  const { habitId, date } = parse(habitLogParamsSchema, req.params);
  const { completed } = parse(habitLogBodySchema, req.body);
  res.json({ data: await t.setHabitLog(getRepos(req).habits, habitId, date, completed) });
}
