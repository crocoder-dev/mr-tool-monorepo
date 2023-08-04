import type { InferModel } from 'drizzle-orm';
import { sqliteTable, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const mergeRequests = sqliteTable('merge_requests', {
  id: integer('id').primaryKey(),
  /* Gitlab -> id */
  externalId: integer('external_id').notNull(),
  /* Gitlab -> iid, GitHub -> number */
  mergeRequestId: integer('merge_request_id').notNull(),
  repositoryId: integer('repository_id').notNull(),
}, (mergeRequests) => ({
  uniqueExternalId: uniqueIndex('merge_requests_external_id_idx').on(mergeRequests.externalId),
}));

export type MergeRequest = InferModel<typeof mergeRequests>;
export type NewMergeRequest = InferModel<typeof mergeRequests, 'insert'>;

