// Starts an in-memory PGlite Postgres server on localhost:54329 with the Supabase stub,
// used to test scripts/migrate.mjs end-to-end. Test-only.
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { readFileSync } from "node:fs";
const db = await PGlite.create();
await db.exec(readFileSync(new URL("./supabase-stub.sql", import.meta.url), "utf8"));
const server = new PGLiteSocketServer({ db, port: 54329, host: "127.0.0.1" });
await server.start();
console.log("READY");
