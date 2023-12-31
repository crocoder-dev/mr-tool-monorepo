import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { integer } from 'drizzle-orm/sqlite-core';
import { repositories } from './repositories';
import { mergeRequests } from './merge-requests';
import { mergeRequestUsersJunk } from './merge-request-users-junk';
import { mergeRequestDatesJunk } from './merge-request-dates-junk';
import { sqliteTable } from './transform-table';

export const mergeRequestMetrics = sqliteTable('merge_request_metrics', {
  id: integer('id').primaryKey(),

  usersJunk: integer('users_junk').notNull().references(() => mergeRequestUsersJunk.id),

  repository: integer('repository').notNull().references(() => repositories.id),

  mergeRequest: integer('merge_request').notNull().references(() => mergeRequests.id),

  datesJunk: integer('dates_junk').notNull().references(() => mergeRequestDatesJunk.id),

  mrSize: integer('mr_size').notNull(),
  codingDuration: integer('coding_duration').notNull(),
  pickupDuration: integer('review_start_delay').notNull(),
  reviewDuration: integer('review_duration').notNull(),
  handover: integer('handover').notNull(),
  reviewDepth: integer('review_depth').notNull(),

  merged: integer('merged', { mode: 'boolean' }).notNull(),
  closed: integer('closed', { mode: 'boolean' }).notNull(),
  approved: integer('approved', { mode: 'boolean' }).notNull(),
  reviewed: integer('reviewed', { mode: 'boolean' }).notNull(),

  _createdAt: integer('__created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  _updatedAt: integer('__updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export type MergeRequestMetric = InferSelectModel<typeof mergeRequestMetrics>;
export type NewMergeRequestMetric = InferInsertModel<typeof mergeRequestMetrics>;
