import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/database.types";

type SupabaseSchema = Omit<Database, "__InternalSupabase">;

function getSupabasePublicCredentials() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables.");
  }

  return { url, key };
}

/**
 * Stateless public client for cached public reads (Menu, Events, Commercial Site).
 * Does not read request cookies so Next.js can safely cache public queries per tenant tag.
 */
export function createSupabasePublicServerClient() {
  const { url, key } = getSupabasePublicCredentials();
  return createClient<SupabaseSchema>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Cookie-aware SSR client for authenticated Dashboard operations and user verification.
 * Always use `supabase.auth.getUser()` on the server — never `getSession()`.
 */
export async function createSupabaseAuthenticatedServerClient(): Promise<
  SupabaseClient<SupabaseSchema>
> {
  const { url, key } = getSupabasePublicCredentials();
  const cookieStore = await cookies();

  return createServerClient<SupabaseSchema>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[]
      ) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component context where cookies cannot be mutated
        }
      },
    },
  }) as unknown as SupabaseClient<SupabaseSchema>;
}
