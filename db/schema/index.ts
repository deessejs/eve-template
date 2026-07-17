// Barrel re-exporting every Drizzle schema in the project. drizzle-kit
// (`drizzle.config.ts`) and the runtime `db` instance both pull from this
// file so adding a new table only requires creating a new file under
// `db/schema/` and adding one `export *` line here.

export * from "./auth";
export * from "./chat";
