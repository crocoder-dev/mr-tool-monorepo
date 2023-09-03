import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Context } from "./config";
import { type GetMergeRequestCommitsEntities, type GetMergeRequestCommitsSourceControl, getMergeRequestCommits } from "./get-merge-request-commits";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mergeRequestCommits, namespaces, repositories, mergeRequests } from "@acme/extract-schema";
import type { Repository, Namespace, MergeRequest, NewRepository, NewNamespace, NewMergeRequest } from "@acme/extract-schema";

let betterSqlite: ReturnType<typeof Database>;
let db: ReturnType<typeof drizzle>;
let context: Context<GetMergeRequestCommitsSourceControl, GetMergeRequestCommitsEntities>;
let fetchMergeRequestCommits: jest.MockedFunction<GetMergeRequestCommitsSourceControl['fetchMergeRequestCommits']>;

const TEST_REPO_1 = { id: 1, externalId: 1000, name: 'TEST_REPO_NAME' } satisfies NewRepository;
const TEST_NAMESPACE_1 = { id: 1, externalId: 2000, name: 'TEST_NAMESPACE_NAME' } satisfies NewNamespace;
const TEST_MERGE_REQUEST_1 = { id: 1, externalId: 3000, createdAt: new Date(), mergeRequestId: 1, repositoryId: 1, title: "TEST_MR", webUrl: "localhost" } satisfies NewMergeRequest;

beforeAll(() => {
  betterSqlite = new Database(':memory:');
  db = drizzle(betterSqlite);

  migrate(db, { migrationsFolder: "../../../migrations/extract" });
  db.insert(repositories).values([TEST_REPO_1]).run();
  db.insert(namespaces).values([TEST_NAMESPACE_1]).run();
  db.insert(mergeRequests).values([TEST_MERGE_REQUEST_1]).run();

  fetchMergeRequestCommits = jest.fn((repository: Repository, namespace: Namespace, mergeRequest: MergeRequest): ReturnType<GetMergeRequestCommitsSourceControl['fetchMergeRequestCommits']> => {
    switch (mergeRequest.externalId) {
      case 3000:
        return Promise.resolve({
          mergeRequestCommits: [
            {
              mergeRequestId: mergeRequest.mergeRequestId,
              externalId: '4b14eb1cb5cdb1937f17e0aafaa697f1f943f546',
              createdAt: new Date('2023-01-02'),
              authoredDate: new Date('2023-01-02'),
              committedDate: new Date('2023-01-02'),
              title: 'MOCK FIRST TITLE',
              message: 'MOCK FIRST MESSAGE',
              authorName: 'MOCK AUTHOR',
              authorEmail: 'mock@author.com'
            },
            {
              mergeRequestId: mergeRequest.mergeRequestId,
              externalId: '6c307422a2957215f63b826491dc33a51dc08f03',
              createdAt: new Date('2023-01-05'),
              authoredDate: new Date('2023-01-05'),
              committedDate: new Date('2023-01-05'),
              title: 'MOCK SECOND TITLE',
              message: 'MOCK SECOND MESSAGE',
              authorName: 'MOCK AUTHOR',
              authorEmail: 'mock@author.com'
            },
          ]
        });
      default:
        return Promise.reject(new Error('Are you mocking me?'));
    }
  });

  context = {
    db,
    entities: {
      mergeRequestCommits,
      namespaces,
      repositories,
      mergeRequests
    },
    integrations: {
      sourceControl: { fetchMergeRequestCommits }
    }
  }
});

afterAll(() => {
  betterSqlite.close();
});

describe('get-merge-request-commits:', () => {
  describe('getMergeRequestCommits', () => {
    test('should insert merge request commits data into db', async () => {
      const { mergeRequestCommits } = await getMergeRequestCommits({
        repositoryId: TEST_REPO_1.id,
        namespaceId: TEST_NAMESPACE_1.id,
        mergeRequestId: TEST_MERGE_REQUEST_1.id
      }, context);

      expect(mergeRequestCommits).toBeDefined();
      expect(fetchMergeRequestCommits).toHaveBeenCalledTimes(1);

      const mergeRequestCommitsRows = db.select().from(context.entities.mergeRequestCommits).all();
      expect(mergeRequestCommitsRows).toHaveLength(2);

      for (const mergeRequestCommit of mergeRequestCommitsRows) {
        expect(mergeRequestCommits.find(mrc => mrc.id === mergeRequestCommit.id)).toBeDefined();
        expect(mergeRequestCommits.find(mrc => mrc.externalId === mergeRequestCommit.externalId)).toBeDefined();
      }
    });
  })
})
