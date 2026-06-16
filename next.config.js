/** @type {import("next").NextConfig} */
module.exports = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  outputFileTracingIncludes: {
    '/api/aga/chat': ['./knowledge/**'],
  },
}
