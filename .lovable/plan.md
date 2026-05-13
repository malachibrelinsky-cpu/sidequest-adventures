## Scope

Rebuild the signup flow on `/auth` so users can sign up with **email and/or phone**, verify phone via **SMS OTP**, and optionally **sync contacts** to find friends already on SideQuest — with hashed phone matching for privacy.

## What gets built

### 1. Database (migration)

Extend `profiles`:
- `phone_e164` text (nullable, normalized E.164)
- `phone_hash` text (nullable, unique) — SHA-256 of normalized number, used for contact matching
- `discoverable_by_contacts` boolean default `true` — user can opt out of being matched
- `contacts_synced_at` timestamptz nullable — last time user synced contacts

Update `handle_new_user()` trigger to also populate `phone_e164` and `phone_hash` from `new.phone` (Supabase stores verified phone on `auth.users.phone`).

Add a `find_friends_by_phone_hashes(hashes text[])` SECURITY DEFINER function that returns `id, display_name, avatar_url` for profiles whose `phone_hash = ANY(hashes)` AND `discoverable_by_contacts = true` AND `id <> auth.uid()`. This way the client never reads raw `phone_hash` from other users.

Lock down `phone_hash` and `phone_e164` from the public profile select grant (only the owner can read their own).

### 2. Signup UI (`src/routes/auth.tsx`)

Three tabs in signup mode: **Email**, **Phone**, or **Both**.

- **Email path**: existing email + password (unchanged).
- **Phone path**:
  1. User enters display name + phone (E.164, with country code input).
  2. App calls `supabase.auth.signInWithOtp({ phone })` → SMS sent.
  3. User enters 6-digit code → `supabase.auth.verifyOtp({ phone, token, type: 'sms' })`.
  4. On success, account is created (trigger fills profile + phone_hash).
- **Both**: email/password signup first, then a "Verify your phone" step that calls `supabase.auth.updateUser({ phone })` + OTP verify, linking the phone to the same user.

Include a clear consent line: "We use your phone to secure your account, help friends find you, and prevent spam. You can hide yourself from contact discovery anytime in Settings."

Login mode: add a "Sign in with phone" toggle that uses OTP.

### 3. Contacts sync step (post-signup)

New route `src/routes/onboarding.contacts.tsx` shown right after first signup.

- Explains why and what gets sent ("We hash phone numbers on your device and only send hashes to find matches. We never store your contact list.")
- Two buttons: **Find friends from contacts** and **Skip**.
- On click, uses `navigator.contacts.select(['tel'], { multiple: true })` (Web Contacts Picker — Android Chrome only). On unsupported browsers, shows a friendly fallback: "Contact picker isn't available in this browser — you can invite friends with a share link instead" + a share/copy invite link.
- Phones are normalized client-side with `libphonenumber-js`, hashed with SubtleCrypto SHA-256, and posted to a new server fn `findFriendsFromContacts({ hashes })` which calls the SQL function above. We never upload raw numbers or names.
- Result: list of matched users with "View profile" / "Message" actions. Sets `profiles.contacts_synced_at = now()`.

### 4. Settings toggle

Add a "Discoverable by contacts" switch to `src/routes/settings.tsx` that flips `profiles.discoverable_by_contacts`.

### 5. Twilio SMS provider

Supabase phone auth needs an SMS provider configured. Tell the user to enable Twilio in **Cloud → Auth Settings → Phone provider** and paste their Twilio Account SID, Auth Token, and Messaging SID. (We won't enable signup-without-verification.)

## Technical notes

- `bun add libphonenumber-js` for E.164 normalization in browser + on server.
- Phone hash recipe (must match on client and server): `sha256(lowercase(E.164(phone)))`. Computed on insert via trigger using `digest()` from `pgcrypto` (enable extension in migration).
- `findFriendsFromContacts` is a `createServerFn` with `requireSupabaseAuth`, calls `supabase.rpc('find_friends_by_phone_hashes', { hashes })`.
- RLS: revoke `phone_hash`, `phone_e164` from `authenticated` SELECT on profiles; add a column-level grant only to the owner (or just exclude them from the public select policy by using a view for public profile reads). Simpler: make the existing "Profiles viewable by authenticated" policy stay, but column-grant `phone_hash`/`phone_e164` only to `service_role` and the owning user via `column_privilege`. Implementation will use a security-definer wrapper instead of column grants if column grants conflict with the existing select policy.
- The Web Contacts Picker requires HTTPS + Android Chrome 80+; we feature-detect with `'contacts' in navigator && 'ContactsManager' in window`.

## Out of scope

- Importing email contacts (Google/Outlook). Only the on-device contacts picker.
- Two-factor auth (phone is verified once at signup, not used as a second factor on login).
- Sending invite SMS to non-matched contacts (privacy-respecting: we never message the user's contacts).
