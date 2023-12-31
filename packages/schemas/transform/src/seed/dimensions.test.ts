import fs from "fs";
import { describe, expect, test } from "@jest/globals";
import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import { seed } from "./dimensions";
import { forgeUsers } from "../forge-users";
import { dates } from "../dates";
import { mergeRequests } from "../merge-requests";
import { repositories } from "../repositories";

let db: LibSQLDatabase;
let sqlite: ReturnType<typeof createClient>;

const testStartDate = new Date("1995-10-18");
const testEndDate = new Date("1996-01-01");

const testSeedDays = (testEndDate.getTime() - testStartDate.getTime()) / (24*60*60*1000) + 1

const dbName = "dimensions";

beforeAll(async () => {
  sqlite = createClient({
    url: `file:${dbName}`,
  });
  db = drizzle(sqlite);
  await migrate(db, { migrationsFolder: "../../../migrations/tenant-db" });
});

afterAll(() => {
  sqlite.close();
  fs.unlinkSync(dbName);
});

describe("dimensions", () => {
  describe("seed", () => {
    test("should insert values into db", async () => {
      await seed(db, testStartDate, testEndDate);
      const seededUsers = await db.select().from(forgeUsers).all();
      expect(seededUsers).toBeDefined();
      expect(seededUsers).toHaveLength(1);
      expect(seededUsers[0]).toEqual(expect.objectContaining({
        id: 1,
        forgeType: 'unknown',
      }))

      const seededDates = await db.select().from(dates).all();
      expect(seededDates).toBeDefined();
      expect(seededDates).toHaveLength(testSeedDays + 1);

      const seedMergeRequests = await db.select().from(mergeRequests).all();
      expect(seedMergeRequests).toBeDefined();
      expect(seedMergeRequests).toHaveLength(1);
      expect(seedMergeRequests[0]).toEqual(expect.objectContaining({
        id: 1,
        forgeType: 'unknown',
      }))

      const seedRepositories = await db.select().from(repositories).all();
      expect(seedRepositories).toBeDefined();
      expect(seedRepositories).toHaveLength(1);
      expect(seedRepositories[0]).toEqual(expect.objectContaining({
        id: 1,
        forgeType: 'unknown',
      }))
    });
  });
});
