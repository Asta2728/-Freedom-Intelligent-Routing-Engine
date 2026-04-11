import { routing } from './i18n/routing';
import createMiddleware from 'next-intl/middleware';

// Next.js 16 `proxy.ts` convention for rewrites/middleware proxying
export default createMiddleware(routing);

export const config = {
    // Match all pathnames except for
    // - /api, /media (handled by next.config.ts)
    // - /_next (Next.js internals)
    // - /_static, /_vercel (framework-specific)
    // - Static files (e.g. favicon.ico, sitemap.xml, robots.txt, etc.)
    matcher: ['/((?!api|media|_next|_static|_vercel|[\\w-]+\\.\\w+).*)']
};
