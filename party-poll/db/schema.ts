import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const responses = sqliteTable("responses", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  selfie: text("selfie"),
  answers: text("answers").notNull(),
  createdAt: integer("created_at").notNull(),
});
