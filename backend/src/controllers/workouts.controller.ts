import type { Request, Response } from "express";
import { getRepos } from "../middleware/repositories.js";
import * as w from "../services/workouts.service.js";
import { parse } from "../validators/common.js";
import { idParamSchema } from "../validators/foods.validators.js";
import { progressionQuerySchema, workoutListSchema, workoutSaveSchema } from "../validators/workouts.validators.js";

export async function list(req: Request, res: Response) {
  res.json({ data: await w.listWorkouts(getRepos(req).workouts, parse(workoutListSchema, req.query)) });
}
export async function get(req: Request, res: Response) {
  const { id } = parse(idParamSchema, req.params);
  res.json({ data: await w.getWorkout(getRepos(req).workouts, id) });
}
export async function create(req: Request, res: Response) {
  res.status(201).json({ data: await w.saveWorkout(getRepos(req).workouts, null, parse(workoutSaveSchema, req.body)) });
}
export async function replace(req: Request, res: Response) {
  const { id } = parse(idParamSchema, req.params);
  res.json({ data: await w.saveWorkout(getRepos(req).workouts, id, parse(workoutSaveSchema, req.body)) });
}
export async function remove(req: Request, res: Response) {
  const { id } = parse(idParamSchema, req.params);
  await w.deleteWorkout(getRepos(req).workouts, id);
  res.status(204).end();
}
export async function exercises(req: Request, res: Response) {
  res.json({ data: await w.exerciseNames(getRepos(req).workouts) });
}
export async function progression(req: Request, res: Response) {
  const { exercise } = parse(progressionQuerySchema, req.query);
  res.json({ data: await w.progression(getRepos(req).workouts, exercise) });
}
