import { Clerk } from "@clerk/clerk-sdk-node";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { GitHubSourceControl, GitlabSourceControl } from "@acme/source-control";
import { Config } from "sst/node/config";
import type { Context, GetUserInfoEntities, GetUserInfoSourceControl } from "@acme/extract-functions";
import { members } from "@acme/extract-schema";
import { EventHandler } from "sst/node/event-bus";
import { extractMembersEvent } from "./events";
import { createMessageHandler } from "./create-message";
import { MessageKind, metadataSchema } from "./messages";
import { z } from "zod";
import { getUserInfo } from "@acme/extract-functions";

export const userInfoSenderHandler = createMessageHandler({
  kind: MessageKind.UserInfo,
  metadataShape: metadataSchema.shape,
  contentShape: z.object({
    memberId: z.number(),
  }).shape,
  handler: async (message) => {
    const { sourceControl, userId } = message.metadata;
    const { memberId } = message.content;
    context.integrations.sourceControl = await initSourceControl(userId, sourceControl);
    await getUserInfo({ memberId }, context);
  }
});

const { sender } = userInfoSenderHandler;


const clerkClient = Clerk({ secretKey: Config.CLERK_SECRET_KEY });
const client = createClient({ url: Config.DATABASE_URL, authToken: Config.DATABASE_AUTH_TOKEN });

const fetchSourceControlAccessToken = async (userId: string, forgeryIdProvider: 'oauth_github' | 'oauth_gitlab') => {
  const [userOauthAccessTokenPayload, ...rest] = await clerkClient.users.getUserOauthAccessToken(userId, forgeryIdProvider);
  if (!userOauthAccessTokenPayload) throw new Error("Failed to get token");
  if (rest.length !== 0) throw new Error("wtf ?");

  return userOauthAccessTokenPayload.token;
}

const initSourceControl = async (userId: string, sourceControl: 'github' | 'gitlab') => {
  const accessToken = await fetchSourceControlAccessToken(userId, `oauth_${sourceControl}`);
  if (sourceControl === 'github') return new GitHubSourceControl(accessToken);
  if (sourceControl === 'gitlab') return new GitlabSourceControl(accessToken);
  return null;
}

const db = drizzle(client);

const context: Context<GetUserInfoSourceControl, GetUserInfoEntities> = {
  db,
  entities: {
    members,
  },
  integrations: {
    sourceControl: null
  }
};

export const eventHandler = EventHandler(extractMembersEvent, async (ev) => {
  const { sourceControl, userId } = ev.metadata;
  const { memberIds } = ev.properties;

  await sender.sendAll(memberIds.map(memberId => ({ memberId })), {
    version: 1,
    caller: 'extract-user-info',
    sourceControl,
    userId,
    timestamp: new Date().getTime(),
  });
});
