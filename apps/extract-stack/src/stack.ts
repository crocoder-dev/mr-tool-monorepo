import {
  Api,
  Config,
  EventBus,
  Queue,
  type StackContext,
} from "sst/constructs";
import { z } from "zod";

export function ExtractStack({ stack }: StackContext) {
  const DATABASE_URL = new Config.Secret(stack, "DATABASE_URL");
  const DATABASE_AUTH_TOKEN = new Config.Secret(stack, "DATABASE_AUTH_TOKEN");
  const CLERK_SECRET_KEY = new Config.Secret(stack, "CLERK_SECRET_KEY");

  const bus = new EventBus(stack, "ExtractBus", {
    rules: {
      repository: {
        pattern: {
          source: ["extract"],
          detailType: ["repository"],
        },
      },
        mergeRequests: {
          pattern: {
            source: ["extract"],
            detailType: ["mergeRequest"],
          },
        },
    },
    defaults: {
      retries: 10,
      function: {
        bind: [DATABASE_URL, CLERK_SECRET_KEY, DATABASE_AUTH_TOKEN],
        runtime: "nodejs18.x",
      },
    },
  });
  const mergeRequestQueue = new Queue(stack, "MRQueue");
  const membersQueue = new Queue(stack, "ExtractMemberPageQueue");
  const mergeRequestDiffQueue = new Queue(stack, "ExtractMergeRequestDiffsQueue");
  const mergeRequestCommitQueue = new Queue(stack, "ExtractMergeRequestCommitsQueue");
  membersQueue.addConsumer(stack, {
    cdk: {
      eventSource: {
        batchSize: 1,
        maxConcurrency: 20,
      },
    },
    function: {
      bind: [
        bus,
        membersQueue,
        mergeRequestQueue,
        mergeRequestDiffQueue,
        mergeRequestCommitQueue,
        DATABASE_URL,
        CLERK_SECRET_KEY,
        DATABASE_AUTH_TOKEN,
      ], // Issue: need to bind bus because same file
      handler: "src/extract-members.queueHandler",
    },
  });

  bus.addTargets(stack, "repository", {
    extractMember: {
      function: {
        bind: [bus, membersQueue, mergeRequestQueue, mergeRequestDiffQueue, mergeRequestCommitQueue],
        handler: "src/extract-members.eventHandler",
      },
    },
  });

  bus.addTargets(stack, "repository", {
    mergeRequests: {
      function: {
        bind: [bus, mergeRequestQueue, membersQueue, mergeRequestDiffQueue, mergeRequestCommitQueue],
        handler: "src/extract-merge-requests.eventHandler",
      },
    },
  });

  bus.addTargets(stack, "mergeRequests", {
    extractMergeRequestDiffs:{
      function: {
        bind: [bus, membersQueue, mergeRequestDiffQueue, mergeRequestQueue, mergeRequestCommitQueue],
        handler: "src/extract-merge-request-diffs.eventHandler",
      }
    } 
  })

  bus.addTargets(stack, "mergeRequests", {
    extractMergeRequestDiffs:{
      function: {
        bind: [bus, membersQueue, mergeRequestDiffQueue, mergeRequestQueue, mergeRequestCommitQueue],
        handler: "src/extract-merge-request-commits.eventHandler",
      }
    } 
  })

  mergeRequestQueue.addConsumer(stack, {
    cdk: {
      eventSource: {
        batchSize: 1,
        maxConcurrency: 20,
      },
    },
    function: {
      bind: [
        bus,
        mergeRequestQueue,
        mergeRequestDiffQueue,
        membersQueue,
        mergeRequestCommitQueue,
        DATABASE_URL,
        CLERK_SECRET_KEY,
        DATABASE_AUTH_TOKEN,
      ],
      handler: "src/extract-merge-requests.queueHandler",
    },
  });

  mergeRequestDiffQueue.addConsumer(stack, {
    cdk: {
      eventSource: {
        batchSize: 1,
        maxConcurrency: 20,
      },
    },
    function: {
      bind: [
        bus,
        mergeRequestQueue,
        mergeRequestDiffQueue,
        mergeRequestCommitQueue,
        membersQueue,
        DATABASE_URL,
        CLERK_SECRET_KEY,
        DATABASE_AUTH_TOKEN,
      ],
      handler: "src/extract-merge-request-diffs.queueHandler",
    },
  })

  mergeRequestCommitQueue.addConsumer(stack, {
    cdk: {
      eventSource: {
        batchSize: 1,
        maxConcurrency: 20,
      },
    },
    function: {
      bind: [
        bus,
        mergeRequestQueue,
        mergeRequestDiffQueue,
        mergeRequestCommitQueue,
        membersQueue,
        DATABASE_URL,
        CLERK_SECRET_KEY,
        DATABASE_AUTH_TOKEN,
      ],
      handler: "src/extract-merge-request-diffs.queueHandler",
    },
  })

  const ENVSchema = z.object({
    CLERK_JWT_ISSUER: z.string(),
    CLERK_JWT_AUDIENCE: z.string(),
  });

  const ENV = ENVSchema.parse(process.env);

  const api = new Api(stack, "ExtractApi", {
    defaults: {
      authorizer: "JwtAuthorizer",
      function: {
        bind: [bus, DATABASE_URL, DATABASE_AUTH_TOKEN, CLERK_SECRET_KEY],
        runtime: "nodejs18.x",
      },
    },
    authorizers: {
      JwtAuthorizer: {
        type: "jwt",
        identitySource: ["$request.header.Authorization"],
        jwt: {
          issuer: ENV.CLERK_JWT_ISSUER,
          audience: [ENV.CLERK_JWT_AUDIENCE],
        },
      },
    },
    routes: {
      "POST /start": "src/extract-repository.handler",
    },
  });

  stack.addOutputs({
    ApiEndpoint: api.url,
  });

  return {
    ExtractBus: bus,
  };
}
