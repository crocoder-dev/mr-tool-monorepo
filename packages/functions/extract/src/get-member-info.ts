import type { Member } from "@acme/extract-schema";
import type { ExtractFunction, Entities } from "./config";
import type { SourceControl } from "@acme/source-control";
import { eq, sql} from "drizzle-orm";

export type GetMemberInfoInput = {
  memberId: number;
};

export type GetMemberInfoOutput = {
  member: Member;
};

export type GetMemberInfoSourceControl = Pick<SourceControl, "fetchUserInfo">;
export type GetMemberInfoEntities = Pick<Entities, "members">;

export type GetMemberInfoFunction = ExtractFunction<GetMemberInfoInput, GetMemberInfoOutput, GetMemberInfoSourceControl, GetMemberInfoEntities>;

export const getMemberInfo: GetMemberInfoFunction = async (
  { memberId },
  { integrations, db, entities }
) => {

  if (!integrations.sourceControl) {
    throw new Error("Source control integration not configured");
  }

  const member = await db.select({ externalId: entities.members.externalId, username: entities.members.username }).from(entities.members).where(eq(entities.members.id, memberId)).get();

  if (!member) {
    console.error(`Member ${memberId} not found`);
    throw new Error(`Member ${memberId} not found`);
  }

  const { member: fetchedMember } = await integrations.sourceControl.fetchUserInfo(member.externalId, member.username);

  const insertedMember = await db.update(entities.members)
    .set({
      ...fetchedMember,
      _updatedAt: sql`(strftime('%s', 'now'))`,
    })
    .where(eq(entities.members.id, memberId))
    .returning()
    .get()


  return {
    member: insertedMember,
  };
};
