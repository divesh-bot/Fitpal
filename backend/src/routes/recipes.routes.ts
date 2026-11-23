import { Router } from "express";
import * as c from "../controllers/recipes.controller.js";

export function recipesRouter(): Router {
  const r = Router();
  r.get("/recipes", c.list); // ?category=meal|snack_sweet|snack_salty
  r.post("/recipes", c.create);
  r.get("/recipes/:id", c.get);
  r.put("/recipes/:id", c.replace); // full replace incl. ingredients
  r.delete("/recipes/:id", c.remove);
  return r;
}
