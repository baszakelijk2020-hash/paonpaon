import { resolveAppSession } from '@paon/auth';
import { createSupabaseServerClient } from '@paon/database';
import { NextResponse, type NextRequest } from 'next/server';

import { env } from './lib/env';

const PUBLIC_PATHS = [
  '/login',
  '/auth/confirm',
  '/accept-invite',
];

const STOREFRONT_PATH_PREFIX = '/r/';  // Retailer storefront path prefix

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createSupabaseServerClient(
    env.supabaseUrl,
    env.supabaseAnonKey,
    {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  );

  const { pathname } = request.nextUrl;

  // Handle public paths
  if (pathname.startsWith(STOREFRONT_PATH_PREFIX)) {
    return response;
  }

  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    if (isPublicPath) {
      return response;
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const session = resolveAppSession(data.user);

  // Check if user is a retailer
  if (session.accountType === 'retailer_staff') {
    await supabase.auth.signOut();
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'not_a_retailer_account');
    return NextResponse.redirect(loginUrl);
  }

  // Redirect to dashboard after login
  if (pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

// Configuration for middleware

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
