import { describe, expect, it } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";
import { isSensitiveUrl, redactQueryString, redactText, scrubEvent } from "./sentry-scrub";

// The contract these tests defend: nothing that reaches Sentry may contain a live credential or a
// guest's identity. Each assertion names a real leak path in this app rather than a generic one.

const INVITE_TOKEN = "Zx9Qr7Lm2Kt4Wb8Nc1Vd5Hs3Jf6Ap0G";
const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJndWVzdCJ9.C2S4Yc9Q1n8mTfR0aLpXvKdJ7uHb3ZgE";

function eventWith(patch: Partial<ErrorEvent>): ErrorEvent {
  return patch as ErrorEvent;
}

describe("isSensitiveUrl", () => {
  it("flags this app's token-redemption routes", () => {
    expect(isSensitiveUrl(`https://osu.example.com/en/invite/${INVITE_TOKEN}`)).toBe(true);
    expect(isSensitiveUrl(`https://osu.example.com/en/partner/${INVITE_TOKEN}`)).toBe(true);
    expect(isSensitiveUrl("https://osu.example.com/api/auth/magic-link/verify")).toBe(true);
    expect(isSensitiveUrl("https://osu.example.com/api/cron/sweep-holds")).toBe(true);
    expect(isSensitiveUrl("https://osu.example.com/api/media/sign")).toBe(true);
    expect(isSensitiveUrl("https://osu.example.com/api/webhooks/paystack/osu")).toBe(true);
  });

  it("flags secret-bearing and PII-bearing query params", () => {
    expect(isSensitiveUrl("https://osu.example.com/en/book?token=abc123")).toBe(true);
    expect(isSensitiveUrl("https://osu.example.com/api/unsubscribe?email=ama@example.com")).toBe(true);
    expect(isSensitiveUrl("https://osu.example.com/en/book/done?reference=PSK_9931")).toBe(true);
  });

  it("redacts when it cannot parse the URL", () => {
    expect(isSensitiveUrl("not-a-url")).toBe(true);
  });

  it("leaves ordinary guest-facing pages alone", () => {
    expect(isSensitiveUrl("https://osu.example.com/en/rooms/garden-suite")).toBe(false);
    expect(isSensitiveUrl("https://osu.example.com/en/events")).toBe(false);
  });
});

describe("redactText", () => {
  it("keeps the route shape but removes the invite token", () => {
    const out = redactText(`Failed on https://osu.example.com/en/invite/${INVITE_TOKEN} while accepting`);
    expect(out).not.toContain(INVITE_TOKEN);
    expect(out).toContain("/en/invite/<token>");
  });

  it("removes guest emails from free text", () => {
    const out = redactText('duplicate key value violates unique constraint: guest_email=(ama.mensah@example.com)');
    expect(out).not.toContain("ama.mensah@example.com");
    expect(out).toContain("[redacted email]");
  });

  it("removes JWTs and vendor keys", () => {
    expect(redactText(`session=${JWT}`)).not.toContain(JWT);
    expect(redactText("Paystack rejected sk_live_9f3a2b7c1d8e")).not.toContain("sk_live_9f3a2b7c1d8e");
    expect(redactText("Stripe key pk_test_abcdef123456 invalid")).not.toContain("pk_test_abcdef123456");
  });

  it("removes labelled secrets and payment references", () => {
    expect(redactText("CRON_SECRET=9c1f0aa2b8")).not.toContain("9c1f0aa2b8");
    expect(redactText("reference is PSK_REF_88213")).not.toContain("PSK_REF_88213");
    expect(redactText("password: hunter2xyz")).not.toContain("hunter2xyz");
  });

  it("leaves ordinary prose and public URLs readable", () => {
    const out = redactText("Room https://osu.example.com/en/rooms/garden-suite failed to render");
    expect(out).toContain("https://osu.example.com/en/rooms/garden-suite");
    expect(out).toContain("failed to render");
  });
});

describe("redactQueryString", () => {
  // Sentry ships query_string as a field of its own, separate from the URL, so it is its own
  // leak path. This suite exists because that field leaked the token until a test said so.
  it("blanks secret-named params but keeps the harmless ones", () => {
    const out = redactQueryString("from=2026-08-01&to=2026-08-04&token=abc123def456");
    expect(out).not.toContain("abc123def456");
    expect(out).toContain("from=2026-08-01");
    expect(out).toContain("to=2026-08-04");
  });

  it("blanks guest PII params on the booking flow", () => {
    const out = redactQueryString("?email=ama@example.com&reference=PSK_REF_88213&adults=2");
    expect(out).not.toContain("ama@example.com");
    expect(out).not.toContain("PSK_REF_88213");
    expect(out).toContain("adults=2");
    expect(out.startsWith("?")).toBe(true);
  });
});

describe("scrubEvent", () => {
  it("strips identity, cookies, auth headers and the whole request body", () => {
    const event = eventWith({
      user: { id: "u_1", email: "ama@example.com", ip_address: "41.66.1.9", username: "ama" },
      request: {
        url: `https://osu.example.com/en/partner/${INVITE_TOKEN}`,
        query_string: "token=abc123def456",
        cookies: { "better-auth.session_token": JWT },
        headers: {
          cookie: `better-auth.session_token=${JWT}`,
          authorization: `Bearer ${JWT}`,
          "set-cookie": "session=abc",
          "x-paystack-signature": "8fa1c0",
          host: "osu.example.com",
        },
        data: {
          guestName: "Ama Mensah",
          guestEmail: "ama@example.com",
          guestPhone: "+233241234567",
          address: "12 Oxford St, Osu, Accra",
          reference: "PSK_REF_88213",
        },
      },
    });

    const out = scrubEvent(event);
    const serialized = JSON.stringify(out);

    expect(out.user?.email).toBeUndefined();
    expect(out.user?.ip_address).toBeUndefined();
    expect(out.user?.username).toBeUndefined();
    expect(out.user?.id).toBe("u_1");

    expect(out.request?.data).toBeUndefined();
    expect(out.request?.cookies).toBeUndefined();
    const headers = out.request?.headers as Record<string, string>;
    expect(headers.cookie).toBeUndefined();
    expect(headers.authorization).toBeUndefined();
    expect(headers["set-cookie"]).toBeUndefined();
    expect(headers["x-paystack-signature"]).toBeUndefined();
    // The tenant host is how a crash is attributed to a hotel, so it stays.
    expect(headers.host).toBe("osu.example.com");

    // The end-to-end guarantee: no secret and no guest identity survives anywhere in the payload.
    for (const secret of [
      INVITE_TOKEN,
      JWT,
      "abc123def456",
      "Ama Mensah",
      "ama@example.com",
      "+233241234567",
      "Oxford St",
      "PSK_REF_88213",
      "41.66.1.9",
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("scrubs the message, exception values, breadcrumbs and extra", () => {
    const event = eventWith({
      message: `boom at https://osu.example.com/en/invite/${INVITE_TOKEN}`,
      exception: { values: [{ type: "Error", value: `guest kofi@example.com failed, token ${JWT}` }] },
      breadcrumbs: [
        { message: `POST /api/auth/magic-link ${JWT}`, data: { body: "email=kofi@example.com" } },
      ],
      extra: { note: "CRON_SECRET=9c1f0aa2b8" },
    });

    const out = scrubEvent(event);
    const serialized = JSON.stringify(out);

    for (const secret of [INVITE_TOKEN, JWT, "kofi@example.com", "9c1f0aa2b8"]) {
      expect(serialized).not.toContain(secret);
    }
    // Still useful for triage: the error survives, just without the credentials.
    expect(out.exception?.values?.[0]?.type).toBe("Error");
    expect(out.message).toContain("boom at");
  });

  it("never drops the event, so the crash signal survives", () => {
    expect(scrubEvent(eventWith({ message: "plain failure" }))).toBeTruthy();
    expect(scrubEvent(eventWith({})).message).toBeUndefined();
  });
});
