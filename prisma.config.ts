import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Optional at config-load time so validate/generate work without credentials.
  // Migration commands still require the real direct Neon connection URL.
  datasource: { url: process.env.DIRECT_URL },
});
