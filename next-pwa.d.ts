declare module 'next-pwa' {
  import { NextConfig } from 'next';

  interface PwaOptions {
    dest?: string;
    register?: boolean;
    skipWaiting?: boolean;
    disable?: boolean;
    sw?: string;
    scope?: string;
    runtimeCaching?: RuntimeCaching[];
    publicExcludes?: string[];
    buildExcludes?: (string | RegExp)[];
    cacheOnFrontEndNav?: boolean;
    subdomainPrefix?: string;
    fallbacks?: {
      document?: string;
      image?: string;
      audio?: string;
      video?: string;
      font?: string;
    };
  }

  interface RuntimeCaching {
    urlPattern: RegExp | string;
    handler: 'CacheFirst' | 'CacheOnly' | 'NetworkFirst' | 'NetworkOnly' | 'StaleWhileRevalidate';
    options?: {
      cacheName?: string;
      expiration?: {
        maxEntries?: number;
        maxAgeSeconds?: number;
        purgeOnQuotaError?: boolean;
      };
      cacheableResponse?: {
        statuses?: number[];
        headers?: Record<string, string>;
      };
      rangeRequests?: boolean;
      backgroundSync?: {
        name: string;
        options?: {
          maxRetentionTime?: number;
        };
      };
      broadcastUpdate?: {
        channelName?: string;
        options?: {
          headersToCheck?: string[];
        };
      };
      matchOptions?: {
        ignoreSearch?: boolean;
        ignoreMethod?: boolean;
        ignoreVary?: boolean;
      };
      networkTimeoutSeconds?: number;
      plugins?: unknown[];
    };
  }

  function withPWA(pwaOptions: PwaOptions): (nextConfig: NextConfig) => NextConfig;
  
  export = withPWA;
}
