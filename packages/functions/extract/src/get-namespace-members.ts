import type { Member } from "@acme/extract-schema";
import type { ExtractFunction, Entities } from "./config";
import type { Pagination, SourceControl } from "@acme/source-control";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

export type GetNamespaceMembersInput = {
  externalNamespaceId: number;
  namespaceName: string;
  repositoryId: number;
  page?: number;
  perPage?: number;
};

export type GetNamespaceMembersOutput = {
  members: Member[];
  paginationInfo: Pagination;
};

export type GetNamespaceMembersSourceControl = Pick<SourceControl, "fetchNamespaceMembers">;
export type GetNamespaceMembersEntities = Pick<Entities, "members" | "repositoriesToMembers">;

export type GetNamespaceMembersFunction = ExtractFunction<GetNamespaceMembersInput, GetNamespaceMembersOutput, GetNamespaceMembersSourceControl, GetNamespaceMembersEntities>;

export const getNamespaceMembers: GetNamespaceMembersFunction = async (
  { externalNamespaceId, namespaceName, repositoryId, perPage, page },
  { integrations, db, entities }
) => {

  if (!integrations.sourceControl) {
    throw new Error("Source control integration not configured");
  }


  const { members, pagination } = await integrations.sourceControl.fetchNamespaceMembers(externalNamespaceId, namespaceName, page, perPage);

  // TODO: Deki is not a wizard
  const insertedMembers = await (db as (LibSQLDatabase & BetterSQLite3Database)).transaction(async (tx) => {
    return Promise.all(members.map(member =>
      tx.insert(entities.members).values(member)
        .onConflictDoUpdate({ target: entities.members.externalId, set: { username: member.username } })
        .returning()
        .get()
    ));
  });

  await db.insert(entities.repositoriesToMembers)
    .values(insertedMembers.map(member => ({ memberId: member.id, repositoryId })))
    .onConflictDoNothing()
    .run();

  return {
    members: insertedMembers,
    paginationInfo: pagination,
  };
};
