import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse', 'officeparser', 'mammoth'],
}

export default nextConfig
