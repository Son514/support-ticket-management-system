import nextjs from "@prisma/composer/nextjs";
import { bucket, compute } from "@prisma/composer-prisma-cloud";
import { postgres } from "@prisma/composer-prisma-cloud/orm";

import { appContract } from "./src/prisma/composer.ts";

export default compute({
  name: "app",
  deps: {
    database: postgres(appContract),
    attachments: bucket(),
  },
  build: nextjs({ module: import.meta.url, appDir: "." }),
});
