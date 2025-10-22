/**
 * Cookie utilities for secure authentication
 * Uses HttpOnly, Secure, SameSite cookies to prevent XSS and CSRF attacks
 */

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const AUTH_COOKIE_NAME = 'auth_token';
const MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  maxAge?: number;
  path?: string;
}

/**
 * Set authentication cookie (server-side only)
 */
export async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  
  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true, // Cannot be accessed by JavaScript (XSS protection)
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'lax', // CSRF protection (allows navigation from external sites)
    maxAge: MAX_AGE, // 30 days
    path: '/', // Available across entire site
  });
}

/**
 * Get authentication token from cookie (server-side only)
 */
export async function getAuthCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE_NAME)?.value;
}

/**
 * Delete authentication cookie (server-side only)
 */
export async function deleteAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
}

/**
 * Set authentication cookie in a Response object
 * Use this when you need to return a response with a cookie
 */
export function setAuthCookieInResponse(response: NextResponse, token: string): NextResponse {
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  });
  
  return response;
}

/**
 * Delete authentication cookie in a Response object
 */
export function deleteAuthCookieInResponse(response: NextResponse): NextResponse {
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}
