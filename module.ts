import { module } from "@prisma/composer";
import { bucket } from "@prisma/composer-prisma-cloud";
import { postgres } from "@prisma/composer-prisma-cloud/orm";

import { appContract } from "./src/prisma/composer.ts";
import app from "./service.ts";

export default module("support-ticket-management-system", ({ provision }) => {
  const database = provision(
    postgres({
      name: "database",
      contract: appContract,
      config: "./prisma.config.ts",
    }),
    { id: "database" },
  );

  const attachments = provision(bucket({ name: "attachments" }), {
    id: "attachments",
  });

  provision(app, { deps: { database, attachments } });
});
