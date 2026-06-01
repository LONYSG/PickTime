# PickTime — Claude Code Final Development Prompt

---

## Project Overview

Build a mobile-first web application called **PickTime**.

PickTime is a lightweight group scheduling web app for close friends coordinating real-world plans — primarily shared via KakaoTalk group chats.

**This is NOT:**
- A productivity SaaS
- A corporate calendar
- A team collaboration platform
- A project management tool

**This app should feel:** casual, visual, frictionless, modern, extremely fast to use.

**Core experience:**
> "Open link → instantly see everyone's availability → vote quickly → finalize."

**Designed for:** friend groups, dinner plans, travel coordination, weekend gatherings.
**NOT for:** enterprise scheduling, public communities, large-scale event management.

---

## Core Product Philosophy

The single most important UX goal:
> **Visual understanding of group availability at a glance.**

Users must instantly understand:
- Which dates are promising
- Where votes are concentrated
- Who is available
- Which option is currently leading

**Priority order:**
1. UX simplicity
2. Mobile usability
3. Visual clarity
4. Fast participation
5. Low cognitive load

**Strictly avoid:**
- Complicated onboarding
- Account systems
- Enterprise UI
- Spreadsheet-like layouts
- Excessive settings
- Overengineered architecture
- Microservices
- Complex authentication systems
- Unnecessary abstractions
- Excessive global state

This project is **intentionally lightweight**. Prefer simplicity whenever possible.

---

## Technical Stack

**Frontend:**
- React + Vite + TypeScript
- TailwindCSS
- shadcn/ui
- Zustand
- TanStack Query
- **dayjs** + `dayjs/plugin/timezone` + `dayjs/plugin/utc` — mandatory for all date/time handling. Never use `new Date()` directly for display or comparison logic.

**Backend:**
- Supabase (PostgreSQL + Realtime + Row Level Security)

**Hosting:**
- GitHub Pages

**Security note:**
- Use GitHub Secrets for the Supabase anon key at build time (injected as environment variables via GitHub Actions)
- Supabase anon key + RLS policies are sufficient security for this use case — do not over-engineer authentication

**Timezone:** Korea Standard Time (KST) only

**Requirements:**
- No traditional backend server
- No cold-start infrastructure
- Supabase called directly from frontend
- Realtime synchronization — changes instantly appear for all connected users without refresh
- Realtime must remain lightweight and room-scoped only

**Routing:** Use `HashRouter` (not `BrowserRouter`). GitHub Pages does not support server-side routing — direct URL access or page refresh on `/room/abc123` will return 404 unless hash-based routing is used.

**PWA:** Required (iPhone Safari + Android Chrome support)

**Desktop behavior:** Centered mobile-sized layout — should feel like a mobile app even on desktop

**OG/Social preview:** Static branded preview card is acceptable for MVP (skip dynamic OG rendering)

---

## Visual Design Direction

**Design language:** modern, soft, minimal, trendy, calm, clean

**Use:**
- Rounded corners
- Soft shadows
- Subtle depth
- Strong readability
- Generous spacing
- Participant colors as visual fingerprints throughout the UI

**Avoid:**
- Enterprise SaaS aesthetics
- Spreadsheet feeling
- Dense tables
- Corporate dashboards
- Heavy animations

The app should feel: casual, enjoyable, approachable, lightweight.

---

## Room Structure

Each room contains:
- Title
- Active date range (host-defined)
- Optional room password
- Participants
- Calendar with voting
- Comments (date-level)
- Notifications
- Finalized state

Each room has:
- Host (1 person)
- Optional admins
- Participants

The calendar only renders within the host-defined date range.

---

## First Screen — Immediate Calendar View

When a user opens a room link:

1. If the room has a password → ask for room password first
2. Immediately show the room calendar (**viewer access is always granted upon entry**)

The user can browse the calendar, see all votes, and see participant availability **without any login**.

**To perform any action** (vote, add time candidate, write comment) → prompt login flow at that moment.

---

## Login Flow (triggered on first action attempt)

Show two options:
- **New Participant**
- **Existing Participant**

### New Participant Flow
1. Enter nickname (duplicate nicknames not allowed within the room)
2. Receive 5 color candidates (algorithm-generated, maximally distinct from existing participant colors)
3. Select preferred color
4. Create 4-digit PIN
5. Join room and begin session

### Existing Participant Flow
1. Show all current participants visually (nickname + color avatar)
2. User selects themselves
3. Enter 4-digit PIN
4. Restore session

**PIN security rules:**
- 5 incorrect attempts → locked for 5 minutes
- Host or admin can reset any participant's PIN
- If a participant forgets their PIN, they must contact the host/admin to reset it

This is **not** bank-level security. Keep implementation lightweight and practical.

---

## Participant Identity

Each participant has:
- Nickname
- Immutable unique color (chosen before joining, cannot be changed after)
- Role (host / admin / participant)
- 4-digit PIN (bcrypt-hashed before storage)

**Color system:**
- Generate 5 color candidates per new participant using an algorithm that maximizes perceptual distance from existing participant colors
- Avoid: similar hues, weak contrast, overly bright, overly dark colors
- After joining: color is permanent and immutable
- Color is the participant's visual fingerprint across the entire app

**Room password:** bcrypt-hashed before storage

**Nickname changes:** Only host/admin can rename participants

---

## Calendar UX

Use a **traditional monthly calendar layout**.

The calendar is the most critical UI element.

**Users must instantly understand:**
- Vote density per date
- Participant color distribution
- Availability overlap
- Participation intensity
- Strongest candidate dates

**Visual language:**
- Heat-like density coloring on dates
- Participant color dots/bars indicating who voted
- Glanceable, touch-friendly, lightweight

**This is NOT a spreadsheet-style scheduling interface.**

---

## Date Interaction — Bottom Sheet

Tapping a date opens a **mobile-style bottom sheet**.

Inside the bottom sheet:
- Time candidates for that date
- Vote counts per candidate
- Participant color indicators per vote
- "Available all day" toggle
- Add time candidate button
- Date-level comments

Avoid full page navigation. Bottom sheet must feel smooth, responsive, mobile-native.

---

## Availability & Voting System

Users may:
1. Create time candidates (e.g. `18:00–20:00`)
2. Vote on existing candidates
3. Mark entire date as "Available all day"
4. Leave comments on dates

**Voting rules:**
- Multiple votes allowed per user
- Users may support multiple candidates

**"Available all day" aggregation logic (critical):**

Users who mark "Available all day" visually count as supporting ALL time candidates on that date.

Example:
- Candidate `19:00–21:00` has 4 explicit votes
- 2 users marked "Available all day"
- Display: `19:00–21:00 = 6 votes`

This aggregation must be applied consistently across all vote displays.

---

## Time Candidate Creation

Users create time candidates via:
1. **Touch/drag selection** — use the same interaction pattern adopted by mainstream calendar apps (e.g. Google Calendar mobile time block drag). Implement the closest equivalent that feels natural on mobile.
2. **Direct time input** — manual start/end time fields as fallback

Both methods must exist. The experience must feel fast and effortless on mobile.

**Important:** Do NOT attempt to replicate Google Calendar's full gesture complexity. The reference is for interaction pattern inspiration only — keep the actual implementation simple and lightweight.

---

## Candidate Editing Rules

- Users may edit **only their own** candidates
- If a candidate already has **1 or more votes**: editing resets all votes to 0, notifies all participants, and creates a visible edit history log entry
  - Example log: *"Minsu changed 19:00–21:00 → 20:00–22:00"*
- This behavior is critical for fairness and transparency

---

## Comments

- Comments are **date-level only** (not candidate-level)
- Purpose: lightweight coordination, compromise discussion, casual conversation
- Keep UI: casual, easy to read, low friction

---

## Most Promising Options Section

Create a **highly visual "Most Promising Options"** section — surfaced prominently (e.g. top of room or sticky header area).

**Ranking logic:** Sort candidates by total vote count (descending). Higher votes = higher rank. Simple and direct.

**This section should feel:** visual, immediate, easy to scan, glanceable.

This feature is extremely important for the core UX goal.

---

## Notifications

**In-app notification center** (no push notifications).

Events that trigger notifications:
- Candidate edited (with reset warning)
- New comment on a date
- Room finalized
- Room reopened
- Admin role changes

Requirements:
- Unread badge on notification icon
- Lightweight notification center panel
- Tapping a notification jumps directly to the related date

---

## Finalization System

Host or admin may finalize the schedule.

**When finalized:**
- Room becomes read-only
- All editing disabled
- Finalized candidate prominently highlighted throughout the UI
- Finalized state is visually obvious

Host/admin may reopen the room later.

Finalized rooms remain readable and accessible.

---

## Roles & Permissions

| Action | Host | Admin | Participant |
|---|---|---|---|
| Finalize room | ✅ | ✅ | ❌ |
| Reopen room | ✅ | ✅ | ❌ |
| Manage room settings | ✅ | ✅ | ❌ |
| Rename participants | ✅ | ✅ | ❌ |
| Delete candidates | ✅ | ✅ | ❌ |
| Reset participant PIN | ✅ | ✅ | ❌ |
| Delete room | ✅ | ❌ | ❌ |
| Vote / Comment / Create candidates | ✅ | ✅ | ✅ |

Keep permissions simple. Avoid complicated moderation systems.

---

## Room Deletion & Expiry

**Manual deletion:** Host can delete the room at any time.

**Automatic deletion — whichever comes first:**
- 7 days after the last date of the host-defined calendar range
- 30 days after the last activity of ANY participant in the room

When a room is deleted: remove all related data (participants, votes, candidates, comments, notifications, audit logs).

Implement via **Supabase pg_cron** or equivalent lightweight scheduler.

---

## Database Schema (suggested)

```sql
rooms
  id, title, password_hash, date_range_start, date_range_end,
  host_participant_id, is_finalized, finalized_candidate_id,
  created_at, last_activity_at

participants
  id, room_id, nickname, color_hex, role, pin_hash,
  pin_attempts, pin_locked_until, created_at, last_active_at

time_candidates
  id, room_id, date, start_time, end_time, created_by,
  created_at, edit_history (jsonb)

candidate_votes
  id, candidate_id, participant_id, created_at

date_availability
  id, room_id, date, participant_id, is_all_day, created_at

comments
  id, room_id, date, participant_id, content, created_at

notifications
  id, room_id, participant_id, type, related_date,
  related_candidate_id, is_read, created_at

audit_logs
  id, room_id, participant_id, action, detail, created_at
```

Keep schema simple. Use RLS for room-scoped access control. Do not over-engineer authentication or permissions.

**Cascade deletes:** All child tables (participants, time_candidates, candidate_votes, date_availability, comments, notifications, audit_logs) must have `ON DELETE CASCADE` referencing `rooms.id`. Deleting a room must clean up all related data automatically.

**Indexes:** Add indexes on `room_id` columns across all tables. Also index `participant_id` on votes and comments, and `date` on time_candidates and comments for date-scoped queries.

---

## Realtime Requirements

Use **Supabase Realtime** for live synchronization.

Sync instantly:
- Votes
- Comments
- Participant joins
- Candidate creation/edits
- Notifications
- Finalization state changes

**Optimistic UI updates preferred** — show the user's own action immediately before server confirmation.

Keep synchronization **lightweight and room-scoped**. Do not subscribe to global channels.

---

## Mobile UX Requirements

- One-hand friendly
- Touch-first interactions
- Minimum 44px touch targets
- Smooth scrolling
- Smooth bottom sheet interactions
- Fast rendering
- Low typing friction
- Minimal input steps
- Safe-area support (iPhone notch / home indicator)
- Keyboard-safe layout (content doesn't get hidden behind keyboard)
- Lightweight transitions only

**Avoid:**
- Excessive modals
- Cluttered layouts
- Deep navigation structures
- Heavy animations
- Expensive re-renders

**Performance is a first-class requirement.**

---

## Implementation Philosophy

> Build this like a skilled indie developer who cares deeply about UX — not like an enterprise engineer.

- Favor simplicity over cleverness
- Favor readability over abstraction
- Favor fast UX over architectural purity
- When in doubt: do less, do it well

The ideal outcome:
> "Friends open the link and immediately start coordinating — no explanation needed."

---
---

# PART 2 — Implementation Status & Maintenance Handoff

> Everything above is the original product brief. Everything below documents
> what was **actually built**, where it lives, and how to maintain it from a
> fresh machine / new session. Keep this section updated as the app evolves.

## Status snapshot (last updated 2026-06-01)

- **Status:** Built and deployed (MVP feature-complete, live in production).
- **Live site:** https://lonysg.github.io/PickTime/
- **Repo:** https://github.com/LONYSG/PickTime (public, owner `LONYSG`)
- **Supabase project ref:** `yttvmtomohvxnradchol`
  (URL `https://yttvmtomohvxnradchol.supabase.co`)
- **Auto-deploy:** push to `main` → GitHub Actions builds and deploys to Pages.

## Run it on a fresh machine

```bash
git clone https://github.com/LONYSG/PickTime.git
cd PickTime
npm install
cp .env.example .env.local      # then fill in the two values below
npm run dev                      # http://localhost:5173/PickTime/
```

`.env.local` (gitignored — never committed) needs:

```
VITE_SUPABASE_URL=https://yttvmtomohvxnradchol.supabase.co
VITE_SUPABASE_ANON_KEY=<the publishable client key>
```

Get the key from **Supabase dashboard → Project Settings → API** (it's the
`sb_publishable_...` / anon public key — client-safe by design; it already
ships in the public JS bundle). The same two values are stored as GitHub
Actions secrets for the deploy build.

Useful scripts: `npm run build` (typecheck + production build — the CI gate),
`npm run typecheck`, `npm run dev`, `npm run preview`.

## Deploy flow

Commit and push to `main`; `.github/workflows/deploy.yml` builds with the
secrets and publishes to GitHub Pages. Watch with `gh run watch`.

- Pages source = **GitHub Actions** (already configured).
- Repo Actions **secrets**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- **Base path** is `/PickTime/` (see `vite.config.ts`, derived from the repo
  name). If the repo is ever renamed, set repo Actions **variable** `VITE_BASE`
  to `/<new-name>/`, or the deployed asset paths break.

## Project structure

```
supabase/migrations/   SQL — run these in the Supabase SQL editor in order
  0001_init.sql          tables, indexes, RLS, auth/room RPCs, triggers, cleanup
  0002_fix_search_path   points functions at the `extensions` schema (pgcrypto)
  0003_unavailability    불참/탈퇴 status columns + RPCs (date/self/leave/kick)
  0004_reactivate_...    triggers: participating action clears 전체 불참
  0005_write_guards...   candidate_votes.room_id (realtime scoping) + BEFORE
                         INSERT guards: block writes when room finalized or
                         actor has left/been kicked
src/
  lib/        supabase client, types, api (RPC/query wrappers), aggregate
              (vote/all-day/불참 tallying + rankings), dayjs(KST), colors
              (Lab ΔE palette), utils (cn, sortSupporters), queryClient
  store/      session.ts — zustand, per-room session persisted to localStorage
  hooks/      useRoomData (loads room + room-scoped realtime), useNotifications,
              useRoomActions (all writes: optimistic + login-gated)
  components/
    ui/       button, input, sheet (bottom sheet), dialog, avatar, toast, spinner
    auth/     AuthProvider (ensureAuth()), LoginSheet (new/existing + PIN)
    room/     Calendar, CandidateListView, PromisingOptions, DateSheet,
              TimeRangePicker (drag), VoterAvatars, MembersSheet,
              NotificationCenter, RoomMenu, PasswordGate
  pages/      HomePage, CreateRoomPage, RoomPage, NotFoundPage
```

## Data model (as built)

Tables: `rooms`, `room_secrets`, `participants`, `participant_auth`,
`time_candidates`, `candidate_votes`, `date_availability`, `comments`,
`notifications`, `audit_logs`. All child tables cascade-delete from `rooms`.

Deviations from the "suggested schema" in Part 1 (intentional):

- **Secrets are split out.** `password_hash` → `room_secrets`, and
  `pin_hash` / PIN-attempt / session-token columns → `participant_auth`. These
  two tables have RLS **on with no policies** (zero anon access) and are **not**
  in the realtime publication, so bcrypt hashes never reach the client.
- `participants.status`: `active` | `unavailable` (전체 불참) | `left`
  (탈퇴/추방 — soft-deleted; row kept so their comments still render, tagged
  "탈퇴자"; excluded from member lists).
- `date_availability.status`: `all_day` | `unavailable` (날짜별 불참).
  (`is_all_day` is kept in sync but `status` is the source of truth.)

## Auth & security model (important — read before touching auth)

- **No Supabase Auth.** Identity = a `participants` row + an opaque session
  token. On join/login an RPC returns a random token; only its SHA-256 hash is
  stored in `participant_auth`. The client keeps the raw token in localStorage
  (`useSessionStore`) and passes it to privileged RPCs.
- **Hashing is server-side** via `pgcrypto` (`crypt`/`gen_salt('bf')`).
- **pgcrypto lives in the `extensions` schema**, so every SECURITY DEFINER
  function declares `set search_path = public, extensions`. If you add a new
  function that calls `crypt`/`digest`/`gen_random_bytes`, you MUST include
  `extensions` in its search_path or it fails at call time (this was the cause
  of an early "방 만들기" error — see 0002).
- **Two write paths:**
  - *Everyday* writes (cast/remove vote, add candidate, comment) go straight to
    tables under permissive room-scoped RLS — fast and realtime-friendly. They
    are still guarded by BEFORE INSERT triggers (0005) that reject writes to a
    finalized room or from a `left` participant. Note this path still trusts the
    client-supplied `participant_id` for active members (acceptable per brief).
  - *Privileged / fairness-sensitive* actions go through token+role-checked
    SECURITY DEFINER RPCs: `create_room`, `join_room`, `login_participant`,
    `verify_room_password`, `edit_candidate` (resets votes + notifies),
    `delete_candidate`, `finalize_room`, `reopen_room`, `update_room_settings`,
    `rename_participant`, `set_participant_role`, `reset_participant_pin`,
    `delete_room`, `set_date_status`, `set_self_participation`, `leave_room`,
    `kick_participant`.

## Features built beyond / refining Part 1

- **Auto-vote:** creating a time candidate auto-votes the creator for it.
- **Vote aggregation** (`src/lib/aggregate.ts`): "available all day" supporters
  count toward every candidate that day, **deduped per participant**
  (explicit ∪ all-day).
- **Most Promising Options:** shows only the current leader(s) — all options
  tied at the max vote count — with **no rank numbers**. Includes a synthetic
  "하루종일 가능" option for dates that have only all-day marks. The full ranked
  list is the **시간 후보 목록** (list) view, a flat list sorted
  **votes desc → 불참 asc → earliest date → earliest time**.
- **불참 (non-participation):** per-date (이 날 불참, clears that date's votes),
  whole-room (전체 불참, clears all my votes/marks; auto-cleared by any
  participating action via 0004 triggers; per-date 불참 is blocked with a notice
  while whole-room 불참 is active). Fewer 불참 ranks higher on ties.
- **Members / 참여 현황** (`MembersSheet`, header 👥): anyone can see who voted /
  didn't / is 불참, and expand a member to see their voted times, all-day dates,
  and 불참 dates.
- **Leave / kick:** soft-delete (status `left`); votes removed, comments kept
  with a 탈퇴자 tag. Host can't leave (must delete the room). Host/admin can kick.
- **Login anywhere:** viewers can log in from the room menu or the viewer banner
  (not only when attempting an action).
- Voter avatars are tap-to-expand (full nicknames + all-day/vote tags);
  supporter ordering is canonical (`sortSupporters`, by join time) everywhere.

## Operational gotchas

- **PostgREST schema cache:** after adding/altering an RPC, the Data API may not
  see it immediately (`PGRST202: Could not find function ... in schema cache`).
  Fix: run `notify pgrst, 'reload schema';` in the SQL editor (or save any table
  in the dashboard).
- **Applying schema changes:** add a new numbered file under
  `supabase/migrations/` and run it in the Supabase **SQL editor** (there is no
  automated migration runner wired up). Migrations 0001–0004 are already applied
  to the live project.
- **pg_cron auto-cleanup is optional:** `delete_expired_rooms()` is only
  scheduled if the `pg_cron` extension is enabled (0001 guards this). If it's
  off, run `select delete_expired_rooms();` manually to purge expired rooms.
- **All dates/times are KST.** Never use `new Date()` for logic — use the
  helpers in `src/lib/dayjs.ts`.
- **Realtime** invalidates React Query caches per room; the secret tables are
  intentionally excluded from the publication.

## Social preview

`public/og-card.png` (1200×630) is the static KakaoTalk/social card,
regenerated with `npm run og` (`scripts/make-og.mjs`, renders an SVG via
`sharp`). `index.html` references it with **absolute** URLs — meta `content` is
not base-rewritten by Vite, so relative paths 404 on GitHub Pages.

## TODO / not done

- Proper PWA PNG icons (currently an SVG icon only; see `vite.config.ts`).
- Host transfer (host can't leave; an inactive host can't be replaced).
- Bundle is a single ~155 KB-gzip chunk (fine for MVP; could code-split later).
