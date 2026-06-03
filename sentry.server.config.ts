import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_ENV || "development",
  release: process.env.NEXT_PUBLIC_GIT_SHA,
  tracesSampleRate: 0.1,
});
