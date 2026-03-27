/// <reference types="node" />
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "src/*.ts",
  out: "src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DB_URL_LOCAL ?? process.env.DB_URL!,
  },
});
