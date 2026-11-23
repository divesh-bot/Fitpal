import { Router } from "express";
import * as c from "../controllers/foods.controller.js";

export function foodsRouter(): Router {
  const r = Router();
  r.get("/foods", c.search); // ?q=paneer&limit=&offset=
  r.post("/foods", c.create);
  r.get("/foods/:id", c.get);
  r.put("/foods/:id", c.update);
  r.delete("/foods/:id", c.remove);
  return r;
}
