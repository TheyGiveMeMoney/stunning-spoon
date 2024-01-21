/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
      domains: [
        'oaidalleapiprodscus.blob.core.windows.net' // if this doesn't work you need to get your own URL just check the console or web browser dev console to find the URL of the created image and copy paste the main URL here
      ],
    },
  }

module.exports = nextConfig
