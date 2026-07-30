"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, hasAuth } from "@/lib/auth";
import { showWitusSignIn } from "@/lib/witus-sso";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Requests a magic link and lands back on the form with a status flag.
 * Always redirects to "sent" for valid addresses — whether or not an account
 * exists — so the form never leaks who has one.
 */
export async function requestMagicLink(formData: FormData): Promise<void> {
  const lang = String(formData.get("lang") ?? "en");
  const email = String(formData.get("email") ?? "").trim();

  if (!EMAIL_RE.test(email)) {
    redirect(`/${lang}/sign-in?status=invalid`);
  }
  if (!hasAuth()) {
    redirect(`/${lang}/sign-in?status=unavailable`);
  }

  await auth().api.signInMagicLink({
    body: { email, callbackURL: `/${lang}` },
    headers: await headers(),
  });

  redirect(`/${lang}/sign-in?status=sent`);
}

/**
 * Starts the "Sign in with WitUS" OIDC flow and redirects to accounts.witus.online.
 *
 * Server action rather than the Better Auth browser client on purpose: this page is a
 * plain form that works without client JS, and adding an OAuth button should not be
 * what breaks that.
 *
 * Re-checks showWitusSignIn() even though the page already did. A server action is a
 * public POST endpoint — anyone can invoke it from a tenant host regardless of what was
 * rendered — so the host gate has to live here too, not only where the button is drawn.
 */
export async function signInWithWitus(formData: FormData): Promise<void> {
  const lang = String(formData.get("lang") ?? "en");

  if (!hasAuth() || !(await showWitusSignIn())) {
    redirect(`/${lang}/sign-in?status=unavailable`);
  }

  const result = await auth().api.signInWithOAuth2({
    body: { providerId: "witus", callbackURL: `/${lang}` },
    headers: await headers(),
  });

  // No URL means the provider did not resolve (misconfigured discovery, bad
  // credentials). Send the operator back to the magic-link form rather than a
  // stack trace, and let the IdP's own error page handle anything past this point.
  if (!result?.url) {
    redirect(`/${lang}/sign-in?status=unavailable`);
  }

  redirect(result.url);
}
