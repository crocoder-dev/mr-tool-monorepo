import {
  type StackContext,
  use,
  Api,
  Queue,
  Cron,
  EventBus,
} from "sst/constructs";
import { ExtractStack } from "./ExtractStack";
import { z } from "zod";

export function TransformStack({ stack }: StackContext) {
  const ENVSchema = z.object({
    CLERK_JWT_ISSUER: z.string(),
    CLERK_JWT_AUDIENCE: z.string(),
    CRON_DISABLED: z.literal('true').optional(),
  });
  const ENV = ENVSchema.parse(process.env);

  const {
    TENANTS,
    TENANT_DATABASE_AUTH_TOKEN,
  } = use(ExtractStack);

  const transformBus = new EventBus(stack, "TransformBus", {
    rules: {
      tenant: {
        pattern:{
          source: ["transform"],
          detailType: ["tenant"],
        }
      }
    },
    defaults: {
      retries: 10,
      function: {
        bind: [
          TENANTS,
          TENANT_DATABASE_AUTH_TOKEN,
        ],
        runtime: "nodejs18.x"
      }
    }
  });

  const transformQueue = new Queue(stack, "TransformQueue");
  transformQueue.addConsumer(stack, {
    cdk: {
      eventSource: {
        batchSize: 1,
        maxConcurrency: 20,
      },
    },
    function: {
      bind: [
        TENANTS,
        TENANT_DATABASE_AUTH_TOKEN,
      ],
      handler: "src/transform/queue.handler",
    },

  });

  transformBus.addTargets(stack, 'tenant', {
    transformTimeline: {
      function: {
        bind: [transformQueue],
        handler: "src/transform/transform-timeline.eventHandler",
      }
    }
  });

  const api = new Api(stack, "TransformApi", {
    defaults: {
      authorizer: "JwtAuthorizer",
      function: {
        bind: [
          transformBus,
          TENANTS
        ],
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
      "POST /start": "src/transform/transform-tenant.apiHandler",
    },
  });

  if (ENV.CRON_DISABLED !== 'true') {
    new Cron(stack, "TransformCron", {
      schedule: "cron(00 13 * * ? *)",
      job: {
        function: {
          handler: "src/transform/transform-tenant.cronHandler",
          bind: [
            transformBus,
            TENANTS
          ],
          runtime: "nodejs18.x",
        }
      }
    });
  }

  stack.addOutputs({
    ApiEndpoint: api.url,
  });


}