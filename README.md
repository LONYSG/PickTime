# PickTime ⏰

친구들과 약속 시간을 가장 빠르게 맞추는 모바일 우선 웹앱.
링크를 열면 바로 모두의 가능한 시간을 보고, 가볍게 투표하고, 확정합니다.

> 카카오톡 단체방에 링크 하나 던지고 → 캘린더에서 한눈에 → 투표 → 확정.

## 기술 스택

- **Frontend**: React + Vite + TypeScript, TailwindCSS, Zustand, TanStack Query, dayjs(KST)
- **Backend**: Supabase (PostgreSQL + Realtime + RLS) — 별도 서버 없음
- **Hosting**: GitHub Pages (HashRouter)
- **PWA**: iPhone Safari / Android Chrome 홈 화면 설치 지원

---

## 빠른 시작 (로컬)

```bash
npm install
cp .env.example .env.local   # 값 채우기 (아래 Supabase 설정 참고)
npm run dev
```

`npm run build` 로 타입체크 + 프로덕션 빌드, `npm run typecheck` 로 타입만 검사합니다.

---

## 1. Supabase 설정

별도 백엔드 서버가 없으므로 Supabase 프로젝트 하나만 있으면 됩니다.

1. [supabase.com](https://supabase.com) 에서 새 프로젝트 생성 (Region은 가까운 곳, 예: Northeast Asia).
2. 프로젝트가 준비되면 **SQL Editor → New query** 에 `supabase/migrations/0001_init.sql` 전체를 붙여넣고 **Run**.
   - 테이블, 인덱스, RLS, 인증 RPC, 알림 트리거, 자동 삭제 함수가 한 번에 생성됩니다.
3. **자동 삭제 스케줄러(pg_cron)** — 선택 사항:
   - **Database → Extensions** 에서 `pg_cron` 을 활성화한 뒤 위 마이그레이션을 다시 실행하면
     `delete_expired_rooms()` 가 매일 자동 실행되도록 등록됩니다.
   - 활성화하지 않아도 앱은 정상 동작하며, 만료 방 정리만 수동(`select delete_expired_rooms();`)이 됩니다.
4. **Project Settings → API** 에서 다음 두 값을 복사해 `.env.local` 에 입력:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...   # anon public key
```

> anon key는 공개되어도 되는 키입니다. 비밀번호/PIN 해시는 클라이언트에 절대 노출되지
> 않도록 별도 테이블(`room_secrets`, `participant_auth`)에 저장되며, RPC(SECURITY DEFINER)
> 를 통해서만 접근합니다.

### 보안 모델 요약

- Supabase Auth를 쓰지 않습니다. 신원 = `participants` 행 + 불투명한 세션 토큰.
- 비밀번호/PIN은 Postgres `pgcrypto`의 bcrypt(`crypt`/`gen_salt('bf')`)로 **서버에서** 해싱.
- 일상 동작(투표/올데이/댓글/후보 추가)은 RLS가 열린 테이블에 직접 기록 → 빠르고 Realtime 친화적.
- 권한이 필요한 동작(확정, 권한/이름 변경, PIN 초기화, 투표가 있는 후보 수정, 방 삭제)은
  토큰 + 역할을 검증하는 RPC를 통해서만 수행.
- 해시가 든 테이블은 Realtime publication에 포함되지 않습니다.

---

## 2. GitHub Pages 배포

1. 이 폴더를 GitHub 저장소로 푸시합니다 (예: 저장소 이름 `PickTime`).
2. 저장소 **Settings → Secrets and variables → Actions** 에서:
   - **Secrets** 추가: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - (저장소 이름이 `PickTime` 이 아니라면) **Variables** 에 `VITE_BASE` = `/<저장소이름>/` 추가
3. **Settings → Pages → Build and deployment → Source** 를 **GitHub Actions** 로 설정.
4. `main` 브랜치에 푸시하면 `.github/workflows/deploy.yml` 이 자동으로 빌드·배포합니다.

배포 후 주소: `https://<사용자>.github.io/<저장소>/#/`
방 링크는 해시 라우팅을 사용하므로 새로고침/직접 접근에도 404가 나지 않습니다.

> `VITE_BASE`를 설정하지 않으면 기본값 `/PickTime/` 가 사용됩니다 (`vite.config.ts`).

---

## 프로젝트 구조

```
supabase/migrations/0001_init.sql   # 전체 DB 스키마 + RPC + 트리거 + 정리 스케줄러
src/
  lib/        supabase 클라이언트, 타입, dayjs(KST), 색상 알고리즘, 집계 로직, API 래퍼
  store/      zustand 세션(roomId별, localStorage 영속)
  hooks/      useRoomData(Realtime), useNotifications, useRoomActions(낙관적 업데이트)
  components/
    ui/       button, input, sheet(바텀시트), dialog, avatar, toast, spinner
    auth/     AuthProvider(ensureAuth), LoginSheet(신규/기존 참가자 + PIN)
    room/     Calendar(히트맵), PromisingOptions, DateSheet(투표/올데이/댓글),
              TimeRangePicker(드래그 선택), NotificationCenter, RoomMenu, PasswordGate
  pages/      Home, CreateRoom, Room, NotFound
```

## 핵심 동작 메모

- **"하루 종일 가능"** 은 그 날의 모든 시간 후보를 지지하는 것으로 집계됩니다. 집계는
  참가자 단위로 중복 제거됩니다 (명시적 투표 ∪ 올데이). → `src/lib/aggregate.ts`
- **투표가 있는 후보를 수정**하면 모든 표가 초기화되고, 참가자에게 알림이 가며,
  수정 이력(`edit_history`)이 남습니다. → `edit_candidate` RPC
- **자동 삭제**: 캘린더 마지막 날 + 7일, 또는 마지막 활동 + 30일 중 먼저 도래하는 시점.
- 모든 날짜/시간은 **KST** 기준입니다.
