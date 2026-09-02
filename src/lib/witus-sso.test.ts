import { describe, expect, it } from "vitest";
import { brandedHostFrom, shouldShowWitusSignIn, showWitusSignIn, witusEcosystemEnabled } from "./witus-sso";

// The gate that keeps "Sign in with WitUS" off hotel tenant domains. A false positive
// here redirects a hotel's guests to accounts.witus.online and reveals the shared
// backend, so every uncertain input must fail closed.

const base = {
  hasCredentials: true,
  brandedHost: "stay.witus.online",
  requestHost: "stay.witus.online",
  tenantOutcome: "none" as const,
};

describe("brandedHostFrom", () => {
  it("takes the host from BETTER_AUTH_URL, normalized", () => {
    expect(brandedHostFrom("https://stay.witus.online")).toBe("stay.witus.online");
    expect(brandedHostFrom("https://STAY.WitUS.online/")).toBe("stay.witus.online");
    expect(brandedHostFrom("http://localhost:3000")).toBe("localhost");
  });

  it("returns null for missing or malformed values so callers fail closed", () => {
    expect(brandedHostFrom(undefined)).toBeNull();
    expect(brandedHostFrom("")).toBeNull();
    expect(brandedHostFrom("stay.witus.online")).toBeNull(); // no scheme, not a URL
  });
});

describe("shouldShowWitusSignIn", () => {
  it("shows on the branded host with no tenant", () => {
    expect(shouldShowWitusSignIn(base)).toBe(true);
  });

  it("ignores case and port when comparing hosts", () => {
    expect(shouldShowWitusSignIn({ ...base, requestHost: "STAY.witus.online" })).toBe(true);
    expect(shouldShowWitusSignIn({ ...base, requestHost: "stay.witus.online:443" })).toBe(true);
    expect(shouldShowWitusSignIn({ ...base, requestHost: "stay.witus.online." })).toBe(true);
  });

  it("HIDES on a hotel tenant domain — the white-label rule", () => {
    expect(shouldShowWitusSignIn({ ...base, requestHost: "www.bamhotel.com" })).toBe(false);
    expect(shouldShowWitusSignIn({ ...base, requestHost: "demo.stay.witus.online" })).toBe(false);
  });

  it("HIDES when a tenant resolves on the branded host", () => {
    // Defends the case where the branded host is itself added to tenant_domains: the
    // button must vanish rather than appear on a white-labelled page.
    expect(shouldShowWitusSignIn({ ...base, tenantOutcome: "tenant" })).toBe(false);
  });

  it("HIDES when the tenant lookup failed, rather than assuming no tenant", () => {
    expect(shouldShowWitusSignIn({ ...base, tenantOutcome: "unknown" })).toBe(false);
  });

  it("HIDES without client credentials", () => {
    expect(shouldShowWitusSignIn({ ...base, hasCredentials: false })).toBe(false);
  });

  it("HIDES when the branded host is unknown, so a bad BETTER_AUTH_URL cannot open it up", () => {
    expect(shouldShowWitusSignIn({ ...base, brandedHost: null })).toBe(false);
  });

  it("HIDES when the request carries no Host header", () => {
    expect(shouldShowWitusSignIn({ ...base, requestHost: null })).toBe(false);
  });

  it("a near-miss hostname does not pass — exact match only, no suffix logic", () => {
    expect(shouldShowWitusSignIn({ ...base, requestHost: "stay.witus.online.evil.com" })).toBe(
      false,
    );
    expect(shouldShowWitusSignIn({ ...base, requestHost: "notstay.witus.online" })).toBe(false);
    expect(shouldShowWitusSignIn({ ...base, requestHost: "stay.witus.onlin" })).toBe(false);
  });
});

describe("witusEcosystemEnabled", () => {
  it("IS showWitusSignIn — one gate, not two that can drift apart", () => {
    // Three surfaces cross to accounts.witus.online: the sign-in button, the silent
    // "Continue as ..." probe, and global sign-out. They read the gate under two names
    // because "showWitusSignIn" does not describe a logout redirect, but they must never
    // become two implementations: the failure mode is someone tightening one host check
    // and leaving the other, so a hotel's guests stop seeing the button but still get
    // redirected to the IdP on sign-out. Identity, not equivalence, is what rules that out.
    expect(witusEcosystemEnabled).toBe(showWitusSignIn);
  });
});
