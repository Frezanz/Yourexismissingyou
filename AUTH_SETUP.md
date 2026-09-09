# BTYA Authentication Test

This version uses Supabase Auth for a passwordless OTP test. Membership is intentionally separate from authentication.

## Current flow

1. Anyone can create an account.
2. Real name, phone and email are required in the account form.
3. The current live test path sends an **email OTP**. No password is used.
4. The phone number is stored as account metadata for this authentication test.
5. After OTP verification, Supabase maintains the browser session.
6. Sign out destroys the client session.
7. BTYA membership approval is not granted by creating an account.

## Supabase setup

`supabase-config.js` contains the BTYA-2 project URL and a placeholder for the public/publishable key. Replace only the placeholder with the project's **publishable/anon key**. Never put a `sb_secret_...` or service-role key in this file.

The BTYA-2 project is currently paused, so the authentication flow cannot be live-tested until that Supabase project is resumed. The connected Supabase account also has the free-project limit, so a new free test project could not be created automatically.

## Email OTP

Supabase's email OTP and magic-link flow share the same email template. For an actual numeric OTP, the Magic Link email template must use `{{ .Token }}` rather than only `{{ .ConfirmationURL }}`. See the official Supabase passwordless email documentation.

## Phone OTP

The UI already has a Phone OTP mode, but SMS authentication requires an SMS provider such as Twilio, Vonage or MessageBird. It is deliberately not faked. Once a provider is configured, the existing phone path can be enabled without redesigning the account flow.

## What is deliberately NOT implemented yet

- BTYA membership applications
- leader verification
- roles/permissions
- public profile tables
- announcements/feedback database
- admin dashboard

Those should sit on top of the proven authentication layer rather than being mixed into it.
