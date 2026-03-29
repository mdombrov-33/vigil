import { Router } from "express";
import { getHeroes } from "@/api/v1/handlers/heroes";

export const heroesRouter = Router();

heroesRouter.get("/", getHeroes);
