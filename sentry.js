const Sentry = require('@sentry/node');
const { nodeProfilingIntegration } = require('@sentry/profiling-node');

function initializeSentry() {
  Sentry.init({
    dsn: 'https://274d35a8eb23cfbb67505d487b3fe872@o4507706118635520.ingest.us.sentry.io/4507725547765760',
    environment: process.env.NODE_ENV,
    release: 'version_1/12-08-2024',
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
  });
}

module.exports = {
  initializeSentry,
  Sentry,
};
