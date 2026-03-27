import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";
import * as enums from "./enums.js";

const conn = postgres(process.env.DB_URL!);
export const db = drizzle(conn, { schema: { ...schema, ...enums } });
