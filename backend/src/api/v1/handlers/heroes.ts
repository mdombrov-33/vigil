import { Request, Response } from "express";
import { db, heroes } from "@/db/index.js";
import { sendJson } from "@/utils/response";

export async function getHeroes(_req: Request, res: Response) {
  const result = await db.select().from(heroes);
  sendJson(res, 200, result);
}
