---
app: stay
name: Stay.WitUS
stage: beta
url: https://stay.witus.online
updated: 2026-10-29
---

## Live now
- White-label hotel websites, one deployment, each hotel on its own domain
- Booking engine with availability, rates and holds, and the public booking flow
- Payments plumbing for mobile money and cards
- Hotel admin: today view, reservations, unit calendars, pricing calendar, design editor, staff invites
- Content management: sections, media, attractions and dining
- Events with RSVP and venue inquiries
- Concierge partners: apply, vet, approve and self-edit
- Guest broadcasts, promo codes, opt-in and unsubscribe
- Support threads, platform admin, billing and audit log
- Demo hotel with a nightly reset
- Sign in with WitUS on the platform host; hotel sites keep their own sign-in
- Public roadmap page

## In progress
- Payment provider verification for live guest payments

## Next
- Turn on live guest payments for the first hotel
- Error and uptime monitoring on the health endpoint

## Backlog
- Guest hub
- Partner ratings
- iCal sync
- Paid event tickets
- Card payments through Stripe
- Spanish locale

## Blocked on
- Payment provider business verification and per-hotel webhook secret (task 03)
- Error-monitoring DSN and uptime monitors (tasks 08 and 10)
- Inbox and Outbox env values (task 06)
