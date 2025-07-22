/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  swcMinify: true,
  images: {
    domains: ["storage.googleapis.com"],
  },
  webpack: (config, { isServer }) => {
    // npm run build chauses module not found error for fs and pg-hstore
    // Fixes npm packages that depend on `fs` module
    // Fixes npm packages that depend on `pg-hstore` module
    if (!isServer) {
        config.resolve.fallback.fs = false;
        config.resolve.fallback['pg-hstore'] = false;
    }

    return config
  }
}

module.exports = nextConfig

// Injected content via Sentry wizard below

const { withSentryConfig } = require("@sentry/nextjs");

module.exports = withSentryConfig(
  module.exports,
  {
    // For all available options, see:
    // https://github.com/getsentry/sentry-webpack-plugin#options

    // Suppresses source map uploading logs during build
    silent: true,
    org: "castle-digital-pty-l-c230df19b",
    project: "sargood",
  },
  {
    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    // Transpiles SDK to be compatible with IE11 (increases bundle size)
    transpileClientSDK: true,

    // Routes browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers (increases server load)
    // tunnelRoute: "/monitoring",

    // Hides source maps from generated client bundles
    hideSourceMaps: true,

    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,
  }
);