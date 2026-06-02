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

---

## Status snapshot (last updated 2026-06-02)

- **Status:** Feature-complete beyond MVP, live in production.
- **Live site:** https://lonysg.github.io/PickTime/
- **Repo:** https://github.com/LONYSG/PickTime (public, owner `LONYSG`)
- **Supabase project ref:** `yttvmtomohvxnradchol`
  (URL `https://yttvmtomohvxnradchol.supabase.co`)
- **Auto-deploy:** push to `main` → GitHub Actions (`deploy.yml`) builds and deploys to GitHub Pages.
- **KakaoTalk share:** registered app at https://developers.kakao.com, domain `https://lonysg.github.io` registered as Web platform.

---

## Setting up on a fresh machine

```bash
git clone https://github.com/LONYSG/PickTime.git
cd PickTime
npm install
cp .env.example .env.local   # fill in all three keys (see below)
npm run dev                   # http://localhost:5173/PickTime/
```

**`.env.local`** (gitignored, never committed):
```
VITE_SUPABASE_URL=https://yttvmtomohvxnradchol.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...   # Supabase → Project Settings → API → anon public key
VITE_KAKAO_JS_KEY=...                        # Kakao Developers → 앱 설정 → 앱 키 → JavaScript 키
```

Useful scripts:
- `npm run dev` — dev server at http://localhost:5173/PickTime/
- `npm run build` — typecheck + production build (this is the CI gate)
- `npm run typecheck` — TS-only check without build
- `npm run preview` — preview the production build locally
- `npm run og` — regenerate `public/og-card.png` social preview image

---

## GitHub Actions secrets (repo Settings → Secrets → Actions)

| Secret | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL — injected at build time |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/publishable key — injected at build time |
| `VITE_KAKAO_JS_KEY` | Kakao JavaScript key — injected at build time |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS) — used by sync-holidays batch |
| `HOLIDAY_API_KEY` | 공공데이터포털 한국천문연구원 특일정보 API 인증키 |
| `SUPABASE_ACCESS_TOKEN` | Supabase personal access token — used by deploy-functions workflow |

---

## GitHub Actions workflows

### `deploy.yml` — GitHub Pages (runs on every push to `main`)
Builds the Vite app with the VITE_* secrets and deploys to GitHub Pages.
Node.js 22. FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true to suppress deprecation warnings.

### `sync-holidays.yml` — 공휴일 배치 (매주 월요일 00:00 UTC, 수동 실행 가능)
Node 22. Calls `scripts/sync-holidays.mjs` which:
1. Fetches Korean public holidays from 공공데이터포털 API (3 years: current ± 1)
2. Upserts into `holidays` table in Supabase using service role key
This is the only source of truth for Korean holidays — no hardcoded dates in frontend.

### `deploy-functions.yml` — Supabase Edge Functions (runs when `supabase/functions/**` changes)
Deploys `supabase/functions/share/index.ts` via Supabase CLI.
The `share` Edge Function: given `?room=<roomId>`, fetches room title from DB,
returns HTML with dynamic OG tags + JS redirect to the app. Used for KakaoTalk
link-copy sharing (so the preview shows the room name, not just "PickTime").

---

## Deploy flow

```bash
git add .
git commit -m "..."
git push origin main
# → deploy.yml fires automatically
# → monitor: gh run list --workflow deploy.yml
```

To manually trigger the holiday sync: GitHub → Actions → Sync Holidays → Run workflow.
To deploy edge function manually: GitHub → Actions → Deploy Edge Functions → Run workflow.
**Base path** is `/PickTime/` (hardcoded in `vite.config.ts`). If the repo is ever renamed,
set repo Actions **variable** `VITE_BASE` to `/<new-name>/`.

---

## Project structure

```
.github/workflows/
  deploy.yml              GitHub Pages deploy (push to main)
  sync-holidays.yml       Weekly holiday batch (공공데이터포털 → Supabase)
  deploy-functions.yml    Supabase Edge Function deploy

supabase/
  migrations/             Run in order in Supabase SQL Editor
    0001_init.sql         Tables, RLS, core RPCs, triggers, cleanup jobs
    0002_fix_search_path  pgcrypto search_path fix (extensions schema)
    0003_unavailability   불참/탈퇴 status columns + RPCs
    0004_reactivate_...   Trigger: participating action clears 전체 불참
    0005_write_guards...  candidate_votes.room_id + BEFORE INSERT guards
    0006_sessions_...     participant_sessions (multi-device), update_room_settings
    0007_holidays.sql     holidays table (RLS: public read only)
    0008_transfer_host    transfer_host RPC
    0009_finalize_allday  rooms.finalized_date + finalize_room_allday RPC
    0010_multi_finalize   rooms.finalized_options jsonb + finalize_room_multi RPC
    0011_secure_everyday  cast_vote/remove_vote/add_candidate/add_comment token
                          RPCs + drop permissive write policies (anti-forgery)
    0012_change_pin       change_pin RPC (self-service PIN change)
    0013_room_password    set_room_password RPC (host set/change/remove password)
    0014_fix_transfer_host transfer_host token-hash fix + Korean role-change notifs
    0015_optional_end_time time_candidates.end_time nullable (start-only candidates)
  functions/
    share/index.ts        Edge Function: dynamic OG tags + redirect (Deno)

scripts/
  sync-holidays.mjs       Holiday batch script (Node.js, ESM)
  make-og.mjs             OG card generator (sharp + SVG)

public/
  favicon.svg             App icon (SVG)
  pwa-192x192.png         PWA home screen icon
  pwa-512x512.png         PWA splash/maskable icon
  og-card.png             Static KakaoTalk/social preview (1200×630)

src/
  lib/
    supabase.ts           Supabase client (anon key, realtime config)
    types.ts              Domain types (Room, Participant, Session, FinalizedOption, …)
    api.ts                All Supabase RPC/query wrappers (fetchRoom, finalizeRoomMulti, …)
    aggregate.ts          Vote tallying: tallyForDate, rankCandidates, rankPromising
    dayjs.ts              dayjs with KST timezone, todayStr(), nowKST()
    colors.ts             Participant color palette + CIE Lab ΔE distance
    holidays.ts           fetchYearHolidays() → reads from Supabase holidays table
    kakao.ts              shareRoom() and shareResult() via Kakao SDK
    queryClient.ts        TanStack Query client + query key factory (qk.*)
    utils.ts              cn(), fmtTime()/fmtRange() (12h, 2-digit hour), sortSupporters()
  store/
    session.ts            Zustand store: sessions keyed by roomId, persisted to
                          localStorage. Session shape: roomId, participantId, token,
                          nickname, color, role, roomTitle?, joinedAt?
    recent.ts             Visited rooms (kept after logout) → HomePage "최근 약속"
  hooks/
    useRoomData.ts        Loads room + all related data + Realtime subscriptions
    useRoomActions.ts     All write actions: optimistic UI + login-gate
    useNotifications.ts   Per-participant notification count + list
    useHolidays.ts        TanStack Query wrapper for fetchYearHolidays (24h cache)
  components/
    ui/                   button, input, sheet, dialog, avatar, toast, spinner
    auth/
      AuthProvider.tsx    Context: session, ensureAuth() (opens login if viewer)
      LoginSheet.tsx      New participant join + existing participant login flow
    room/
      Calendar.tsx        Monthly calendar grid; today highlight; holiday colors;
                          finalized stars (multi-date); color dots; drag select
      CandidateListView.tsx  Flat ranked list view of all time candidates
      PromisingOptions.tsx   Leading options banner (top of room page)
      DateSheet.tsx       Bottom sheet on date tap: candidates, AllDayRow, comments.
                          "시간 추가/수정" opens AddCandidate as a Dialog (wheel picker).
      TimeWheelPicker.tsx Alarm-style scroll wheels (오전·오후/시/분, 1-min); optional
                          end time toggle (replaced the old drag TimeRangePicker)
      VoteMeta.tsx        Shared right-hand meta column: 확정 / 표수 / 불참, stacked
                          and fixed-width so long times never collide with it
      VoterAvatars.tsx    Avatar cluster → full nickname dialog; `full` mode makes the
                          whole zone tappable
      MembersSheet.tsx    참여 현황 sheet (누가 투표/불참/하루종일); voted-first sort,
                          tap a member's time → jump to that date
      NotificationCenter.tsx  In-app notification panel
      RoomMenu.tsx        Side sheet menu: share, finalize, participants, settings.
                          Simplified post-finalization menu (result-share only).
      PasswordGate.tsx    Password input before entering a locked room
  pages/
    HomePage.tsx          Recent rooms list (fetches from Supabase) + new room CTA
    CreateRoomPage.tsx    Room creation form
    RoomPage.tsx          Main room view: calendar/list toggle, finalized banner,
                          realtime session role sync
    NotFoundPage.tsx      404 fallback
```

---

## Data model (as built)

**Core tables:**
`rooms`, `room_secrets`, `participants`, `participant_auth`, `participant_sessions`,
`time_candidates`, `candidate_votes`, `date_availability`, `comments`,
`notifications`, `audit_logs`, `holidays`

All child tables cascade-delete from `rooms`.

**Key deviations from the Part 1 schema:**

- **Secrets split out:** `password_hash` → `room_secrets`; `pin_hash` / PIN-attempt /
  session-token → `participant_auth`. Both have RLS on with no policies (zero anon
  access) and are excluded from the realtime publication.
- **`participant_sessions` table** (migration 0006): multiple concurrent sessions
  per participant (multi-device login). Token stored as SHA-256 hash only.
- **`participants.status`:** `active` | `unavailable` (전체 불참) | `left`
- **`date_availability.status`:** `all_day` | `unavailable`. `is_all_day` kept in sync
  but `status` is the source of truth.
- **`rooms` extra columns (post-MVP):**
  - `finalized_date DATE` — set on any finalization (candidate or all-day)
  - `finalized_options JSONB DEFAULT '[]'` — array of `{kind, candidate_id?, date}`;
    populated by `finalize_room_multi`. Old rooms finalized before migration 0010
    have `[]` here — the UI falls back to `finalized_candidate_id`/`finalized_date`.
- **`holidays` table** — populated by the weekly GitHub Actions batch from the
  공공데이터포털 API. Schema: `date DATE PK, name TEXT`. RLS: public SELECT only.
  Writes require service role (bypasses RLS) from the batch script.

---

## Auth & security model

- **No Supabase Auth.** Identity = a `participants` row + an opaque session token.
  On join/login an RPC returns a random token; only its SHA-256 hash is stored in
  `participant_sessions`. The client keeps the raw token in localStorage
  (`useSessionStore`) and passes it to privileged RPCs.
- **Hashing:** server-side via `pgcrypto` (`crypt`/`gen_salt('bf')`).
- **pgcrypto lives in the `extensions` schema.** Every SECURITY DEFINER function must
  declare `set search_path = public, extensions`. If you add a new function that
  calls `crypt`/`digest`/`gen_random_bytes` and forget this, it silently fails at
  call time with a "function not found" error (see migration 0002).
- **All writes go through token-checked RPCs** (since migration 0011). The
  participant is *always* derived from the session token server-side — the client
  never supplies its own `participant_id` for a write, so votes/comments can't be
  forged as another member. The permissive everyday-write RLS policies were dropped
  in 0011; the only remaining direct-table write from the client is marking one's
  own notifications read (`update_notifications` policy — not fairness-sensitive).
  - *Everyday writes:* `cast_vote`, `remove_vote`, `add_candidate` (auto-votes the
    creator), `add_comment`, `set_date_status`, `set_self_participation`. These are
    still subject to the BEFORE INSERT guards (0005) that reject writes to a
    finalized room or from a `left` participant.
  - *Privileged / role-gated:* `create_room`, `join_room`, `login_participant`,
    `verify_room_password`, `change_pin` (self), `edit_candidate`,
    `delete_candidate`, `finalize_room`, `finalize_room_allday`,
    `finalize_room_multi`, `reopen_room`, `update_room_settings`,
    `rename_participant`, `set_participant_role`, `reset_participant_pin`,
    `delete_room`, `leave_room`, `kick_participant`, `transfer_host`.
- **Session role sync:** `RoomPage` watches `data.participants` and auto-updates
  `session.role` in localStorage if it differs from the DB value — so role changes
  (e.g. host grants admin) are reflected immediately without refresh.

---

## Features (complete list)

**Core (from brief):**
- Monthly calendar with vote heatmap and color dots per participant
- Date bottom sheet: time candidates, votes, "하루종일 가능", comments
- "Available all day" aggregation: all-day voters count toward every candidate
- Most Promising Options banner (leaders only, no rank numbers)
- 시간 후보 목록 list view (sorted by votes desc → 불참 asc → date/time)
- 불참: per-date (clears votes) and whole-room (clears everything; auto-cleared on participation)
- Finalize / reopen room (host or admin)
- In-app notifications with unread badge
- Members sheet (참여 현황): who voted / all-day / 불참
- Leave / kick (soft-delete, comments preserved as "탈퇴자")
- Role system: host / admin / participant
- PIN lock: 5 wrong attempts → 5-minute lockout

**Post-MVP additions:**
- **Today highlight:** primary-color circle on today in the calendar
- **Holiday highlighting:** Korean public holidays shown in red (data from Supabase `holidays` table; `useHolidays` hook with 24h TanStack Query cache). DateSheet title shows holiday name. Updated weekly via GitHub Actions batch.
- **Calendar opens at current month** if today is within the room's date range
- **Weekday header alignment:** fixed grid gap mismatch between header and cells
- **Drag mode toggle in TimeRangePicker:** explicit "드래그 선택" button prevents scroll hijacking on mobile; drag completes and auto-disables
- **Vote count badge:** N표/N명 displayed as inline rounded badge (not vertical stack)
- **AllDayRow in DateSheet:** "하루종일 가능" always shown in candidates section (top when no time candidates, bottom otherwise); "하루종일 확정" label when the date was finalized as all-day; tap avatars to see full nicknames
- **Multi-finalization:** `finalize_room_multi` RPC + `finalized_options jsonb` on rooms. FinalizeDialog: checkbox multi-select, voter avatars per option, scrollable list. Multiple finalized dates show stars on calendar. "확정" badge per option in DateSheet and CandidateListView.
- **Finalized banner:** shows all finalized dates with confirmed participant avatars (tap → full nicknames); "하루종일" label where applicable
- **Post-finalization menu:** simplified to "결과 카카오톡으로 공유" + "방 다시 열기" + participants list (read-only) + delete/logout. Full menu restored on reopen.
- **KakaoTalk invite share:** `shareRoom()` — room name + description + invite card via Kakao SDK
- **KakaoTalk result share:** `shareResult()` — "[확정] 방이름 — 대표날짜 외 N개" in title, remaining dates in description. Fallback for rooms finalized before `finalized_options` migration.
- **OG Edge Function proxy** (`supabase/functions/share/index.ts`): `?room=<id>` → fetches room title → returns HTML with dynamic OG tags + JS redirect. Deployed via `deploy-functions.yml`. "초대 링크 복사" copies the direct app URL (hash routing); the Edge Function URL is not used for copy (CORS issues in browser are avoided this way).
- **PWA icons:** `pwa-192x192.png` and `pwa-512x512.png` in `/public/`, referenced in `vite.config.ts` VitePWA manifest.
- **Host transfer:** `transfer_host` RPC (demotes current host to admin, promotes target). 왕관 button in participant row (host only, non-host participants only, not finalized). Confirmation dialog.
- **Role change confirmation dialog:** ShieldCheck/Shield icon now shows a dialog before changing admin status.
- **isManager uses DB role:** `me?.role ?? session?.role` so host/admin features activate immediately after role change without refresh.
- **Session role auto-sync:** RoomPage `useEffect` detects `me.role !== session.role` and updates localStorage. Eliminates the need for refresh after role changes.
- **Start date constraint:** room creation and room settings cannot set start date before today.
- **Homepage recent rooms:** reads all stored sessions, fetches room data (title, date range, is_finalized) via TanStack Query. Shows date range, "확정" badge, "만료" badge for deleted/expired rooms with 🗑️ remove button. "새 약속 만들기" CTA at bottom.
- **Home button:** RoomPage header uses Home icon (instead of back arrow); navigates to `/`.

---

## Operational gotchas

- **PostgREST schema cache:** after adding/altering an RPC, the Data API may not see
  it immediately (`PGRST202`). Fix: run `notify pgrst, 'reload schema';` in the SQL
  editor. Migration 0010 ends with this automatically.
- **Applying schema changes:** add a new numbered file under `supabase/migrations/`
  and run it in the **Supabase SQL Editor** manually (no automated runner).
  Migrations 0001–0015 exist; 0011–0015 were added recently and must be run on the
  live project (each ends with `notify pgrst, 'reload schema';`).
- **Holiday API key:** registered at https://data.go.kr → 한국천문연구원 특일정보.
  The key is a hex string (no special chars, no URL encoding needed). If it stops
  working, check if the usage approval is still active in 마이페이지 → 활용신청.
- **Kakao SDK URL:** `https://developers.kakao.com/sdk/js/kakao.min.js` loaded in
  `index.html`. Domain `https://lonysg.github.io` must be registered in Kakao
  Developers → 앱 설정 → 플랫폼 → Web for share to work.
- **`finalize_room` / `finalize_room_allday` RPCs** still exist in the DB but are
  no longer called from the frontend (replaced by `finalize_room_multi`). Old rooms
  finalized via these RPCs have `finalized_options = []`; the UI falls back to
  `finalized_candidate_id` and `finalized_date` for display.
- **pg_cron auto-cleanup:** `delete_expired_rooms()` only runs if the `pg_cron`
  extension is enabled (guarded in 0001). If off, run manually in SQL Editor.
- **All dates/times are KST.** Never use `new Date()` for display/comparison logic —
  use `nowKST()`, `todayStr()`, `kstDate()` from `src/lib/dayjs.ts`.
- **Realtime** is room-scoped only. `secret*` tables are excluded from the
  realtime publication intentionally.
- **Bundle size:** ~155 KB gzip (single chunk, acceptable for MVP).

---

## Social preview

`public/og-card.png` (1200×630) — static KakaoTalk/social card for the app homepage.
Regenerate with `npm run og` (`scripts/make-og.mjs`, renders SVG via `sharp`).
`index.html` references it with **absolute URLs** — relative paths 404 on GitHub Pages
because Vite does not rewrite `<meta content>` attributes.

For **room-specific** OG (dynamic title), the Edge Function at
`supabase/functions/share/index.ts` handles it. It is not used by the "링크 복사"
button (which copies the direct app URL) — only for future use if a custom share
URL flow is built.

---

## TODO / known gaps

- If the host goes inactive permanently, no one can manage the room (host transfer exists but host must initiate it themselves).
- Notification "read" is still a direct table update (anyone could mark another
  member's notifications read). Low risk; left direct for simplicity.

## Recently addressed (this session)

- **Vote/comment forgery closed** (migration 0011): everyday writes are now
  token-checked RPCs; permissive write RLS dropped. See Auth & security model.
- **Self-service PIN change** (migration 0012 + `ChangePinButton` in RoomMenu →
  내 참여 → 내 PIN 변경): proves current PIN, sets new one, sessions stay valid.
- **Code-splitting**: route pages (`CreateRoomPage`, `RoomPage`, `NotFoundPage`)
  are `React.lazy`-loaded behind `<Suspense>`; landing page no longer ships the
  room UI. RoomPage is its own ~87 KB chunk.
- **ErrorBoundary** (`src/components/ErrorBoundary.tsx`): wraps the routes; shows
  a recovery screen on render errors and auto-reloads once on a stale-chunk
  `ChunkLoadError` after a deploy.

### UX round (this session)

- **Color palette centered** (`ColorPicker` → `justify-center`).
- **Time picker redesigned** (`TimeRangePicker`): drag-to-select **removed**. Now
  conventional start/end dropdowns (custom-styled `appearance-none` selects with a
  right-aligned chevron + floating label) plus 1h/2h/3h quick-duration chips.
- **Add-time discoverability** (`DateSheet`): the two "my status" toggles are now
  under an "이 날 내 상태" heading; the tiny "추가" text link became a full-width
  dashed "＋ 시간 후보 추가" button that's always visible (large CTA when the date
  is empty).
- **Calendar decluttered** (`Calendar` + RoomPage `Legend`): dropped the 4-level
  indigo heat background. Cells are clean white; participant color dots are the
  density signal (brief's "color = fingerprint"); only the most-supported date(s)
  get a single soft `bg-primary/5` tint. Legend updated accordingly.
- **Room password management** (migration 0013, host only): RoomMenu →
  `PasswordSettings` lets the host set / change / remove the room password after
  creation. `update_room_settings` still only adds; removal goes through the new
  `set_room_password` RPC (blank = remove).

### UX round 2 (this session)

- **12-hour clock everywhere** (`fmtTime`/`fmtRange` in `utils.ts`): times show as
  오전/오후 (e.g. "오후 6시", range collapses shared period → "오후 6시–8시").
  Comment/notification timestamps use `M/D A h:mm`. No 24-hour display remains.
- **Time picker** (`TimeRangePicker`): drag + duration chips removed; two
  centered 12-hour dropdowns (`appearance-none`, right chevron) with start-moves-
  keeps-duration behavior.
- **Bottom sheet** (`ui/sheet.tsx`): now flick-down-to-dismiss and animates out on
  every close (backdrop/X/Escape) — stays mounted through the exit transition.
  `DateSheet` retains the last date (`activeDate`) so its content stays put while
  sliding out.
- **Room menu consolidation** (`RoomMenu`): 약속이름/시작일/종료일/비밀번호 merged
  into a single collapsible **방 설정** (one 설정 저장; password is a host-only
  toggle inside it). 초대 링크 복사 + 카카오톡 공유 merged into one **친구
  초대하기** button → `InviteDialog` (카카오톡 left, 링크 복사 right). Logout now
  navigates home.
- **Onboarding** (`LoginSheet` new-participant): nickname → PIN as two steps
  (auto-focused), color **auto-assigned** (no picker). Room creation
  (`CreateRoomPage`) also dropped the color picker.
- **Color assignment** (`colors.ts`): `suggestColors` → `pickColor`. ~90-color
  generated palette (30 hues × 3 tones + neutrals); assigns a random color among
  those perceptually distinct (ΔE ≥ 22) from existing ones, for variety instead of
  always-farthest clustering. `ColorPicker.tsx` is now unused.
- **Calendar**: date sheet title is colored for holiday/Sun (rose) / Sat (sky).
  Tied top dates already all highlight.
- **Recent rooms persist after logout** (`store/recent.ts`): visiting a room
  records it (kept independent of login); HomePage merges recents with active
  sessions, so logging out no longer loses the room (shows as "보기 전용", re-enter
  in view mode). Expired/removed via `removeRecent` + `clearSession`.

### UX round 3 (this session)

- **Host transfer fixed** (migration 0014): `transfer_host` was comparing a bytea
  digest to the hex-text token hash (always errored). Rewritten via
  `_participant_from_token`. Role-change notifications now Korean
  (`set_participant_role` + transfer), and use the correct `role_change` type.
- **Kicked/left auto-eject** (`RoomPage`): if the logged-in user's participant row
  becomes `left` (kicked/left elsewhere), the now-invalid session is cleared →
  viewer mode (fixes the "still inside after kick / can't rejoin" stuck state).
- **Optional end time** (migration 0015): `time_candidates.end_time` is nullable;
  a candidate can be a start only ("오후 4시"). `add_candidate`/`edit_candidate`
  accept null end; `TimeCandidate.end_time`/`PromisingOption.end_time` are
  `string | null`. `fmtRange(start, end?)` shows "오후 3시 30분 ~ 오후 4시 30분" or
  just "오후 4시".
- **Time display** (`utils.fmtTime/fmtRange`): Korean 12-hour with 분
  ("오후 4시", "오후 4시 30분"), " ~ " separator. Old en-dash form dropped.
- **Alarm-style wheel picker** (`TimeWheelPicker`, replaces `TimeRangePicker`):
  scroll wheels for 오전·오후 / 시 / 분 (1-minute), default = current time rounded
  up to 10 min, optional "종료 시간 추가" toggle. `DateSheet`'s AddCandidate uses
  it and blocks past times when the date is today.
- **Onboarding back button** (`LoginSheet`): rebuilt as `choose → new-nick →
  new-pin / existing` modes with a single context-aware header back arrow (the
  duplicate/non-working arrow is gone).
- **Bottom sheet** (`ui/sheet.tsx`): drag-to-dismiss now lives only on the grab
  handle, so the header back/X buttons are reliably tappable (pointer-capture was
  swallowing their clicks).
- **Calendar refresh** (`Calendar`): rounded-2xl cells, stronger today chip, color
  dots with ring, and—when a date has no votes—the **holiday name** in red (data
  from the `holidays` table). Added a "오늘" jump button. `participantCount` prop
  removed.
- **Dead files removed**: `ColorPicker.tsx`, `TimeRangePicker.tsx` (superseded by
  auto color assignment and the wheel picker).

### UX round 4 (this session, frontend only)

- **Time picker is now a Dialog** (`DateSheet` AddCandidate): "시간 추가/수정" opens
  a separate popup with the wheel + "설정 완료", instead of inline-in-the-sheet
  (avoids scroll-within-scroll).
- **No 2-line time text**: `whitespace-nowrap` (+ smaller font) on times in
  PromisingOptions, CandidateListView, DateSheet, MembersSheet chips; invite
  dialog copy shortened to one line.
- **Confirm dialogs** for destructive/navigational actions: 전체 불참
  (`ParticipationButton`), 로그아웃 (`LogoutButton`), 홈 버튼 (RoomPage).
- **Shared nav header** (`components/PageHeader.tsx`): CreateRoomPage uses it so
  back-button/padding match RoomPage exactly.
- **Animations**: page transitions (`animate-page`, slide-in-right) on Home/Create/
  Room; member-expand (`animate-expand-in`) in MembersSheet; sheets/dialogs already
  animate. Tailwind keyframes `slide-in-right`/`expand-in` added.
- **Comment empty state** unified to "아직 댓글이 없어요." everywhere.
- **Vote vs see-who tap zones** (`DateSheet`, `CandidateListView`): the whole top
  row toggles the vote; voter avatars live in a separate divider-separated
  muted-bg zone that opens the name dialog — boundary is now visually clear.
- **Participants merged into 참여 현황** (`MembersSheet`): the room menu no longer
  lists participants. MembersSheet shows host/admin icons and sorts voted-first
  (latest vote on top) then non-voters (latest to join on top); tapping a member's
  voted time/date jumps to that date. Participant **management** (role/kick/host
  transfer) moved into 방 설정 (`RoomSettingsForm`, managers only).
- **Room password unmasked**: the protect-room field is `type="text"` (single
  entry, no confirm) in both create and settings.
- **Removed others' nickname/PIN editing**: rename + PIN-reset of other members are
  gone from `ParticipantRow` (kept role toggle / transfer / kick).

### UX round 5 (this session, frontend only)

- **Final time format** (`utils.fmtTime/fmtRange`): 12-hour, **2-digit hour, period
  on both ends** — `오후 07:10 ~ 오후 07:11`, `오전 08:30 ~ 오후 12:00`; start-only
  `오후 06:00`. (Superseded the earlier "시/분" and period-collapsing forms.)
  Time text renders at `text-[13px] break-keep` so it stays on one line in the
  normal case and wraps cleanly only in the extreme.
- **Consistent vote-row meta** (`VoteMeta`): every voting row (DateSheet,
  CandidateListView, PromisingOptions) puts 확정 / 표수 / 불참 in a fixed-width,
  right-aligned, `shrink-0` column; the time sits in a `min-w-0 flex-1` column, so
  **a long time can never overflow into the count**. Count pill is
  `whitespace-nowrap` (no more "2"/"표" stacking).
- **Wider voter tap zone** (`VoterAvatars` `full` mode): the whole muted avatar
  strip is one big button that opens the names dialog (not just the icons), with a
  "명단 ›" hint.
- **Calendar holiday names removed** from cells (they were truncated/ugly); the red
  date coloring stays, and the full holiday name still shows in the DateSheet title.
  (This reverts the "holiday name in red" cell text added in round 3.)
