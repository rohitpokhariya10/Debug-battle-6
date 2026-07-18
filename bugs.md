# Debug Battle 6 — All Bugs Solved

## Summary

| # | File | Line | Severity | Description |
|---|------|------|----------|-------------|
| 1 | `server/src/utils/jwt.js` | L22 | Critical | `JWT_ACCES_SECRET` typo — all token verification fails |
| 2 | `server/src/services/auth.service.js` | L17 | Critical | Signup username-exists check inverted |
| 3 | `server/src/services/auth.service.js` | L40 | Critical | Login password-validity check inverted |
| 4 | `server/src/services/gameInvite.service.js` | L40 | Critical | Unconditional throw — all invites blocked |
| 5 | `server/src/services/gameInvite.service.js` | L64 | Critical | Wrong status check — invite responses always 404 |
| 6 | `server/src/services/friendship.service.js` | L108 | Medium | Online status hardcoded `false` |
| 7 | `server/src/services/game/GameManager.js` | L98 | Critical | Only X score increments; O wins ignored |
| 8 | `server/src/services/game/GameManager.js` | L134 | Critical | `isXTurn` never toggled — turns never alternate |
| 9 | `client/src/store/authSlice.js` | L51 | Medium | Wrong localStorage key removed on logout |
| 10 | `client/src/pages/LandingPage.jsx` | L12 | Medium | Navigates to `/auth/signup` instead of `/signup` |
| 11 | `client/src/features/auth/hooks/useSignup.js` | L75 | Critical | `selectAvatar` wipes all form data |
| 12 | `client/src/features/game/components/OnlineGame.jsx` | L203-204 | Medium | X/O score props swapped in `ScorePanel` |
| 13 | `client/src/features/game/components/OnlineGame.jsx` | L234 | Medium | Final winner label `!==` instead of `===` |
| 14 | `client/src/features/game/providers/GameProvider.jsx` | L57 | Medium | Optimistic update places wrong mark (`O` when `X`'s turn) |
| 15 | `client/src/features/game/providers/GameProvider.jsx` | L61 | Medium | Optimistic update doesn't toggle `isXTurn` |
| 16 | `server/src/config/db.js` | L14-15 | Critical | Hardcoded MongoDB URI ignoring `.env` |
| 17 | `client/src/features/game/components/GameHeader.jsx` | L436-453 | Medium | Invite toast Accept/Decline buttons swapped |
| 18 | `client/src/features/game/components/GameHeader.jsx` | L52-56 | Medium | Online indicator colors inverted |
| 19 | `client/src/features/game/components/GameHero.jsx` | L359 | Critical | "TIC TAC TOE" title overlaps buttons, blocks clicks |

---

## Server Bugs — Detailed Fixes

### BUG 1 — `verifyAccessToken` typo in env key

- **File:** `server/src/utils/jwt.js:22`
- **Problem:** `env.JWT_ACCES_SECRET` is missing an `S` — the env variable is `JWT_ACCESS_SECRET`. This means `jwt.verify()` receives `undefined` as the secret and throws on every call, breaking all authenticated routes.
- **Fix:** Changed `env.JWT_ACCES_SECRET` to `env.JWT_ACCESS_SECRET`.

```diff
- return jwt.verify(token, env.JWT_ACCES_SECRET);
+ return jwt.verify(token, env.JWT_ACCESS_SECRET);
```

---

### BUG 2 — `signup` inverts the username-exists check

- **File:** `server/src/services/auth.service.js:17`
- **Problem:** `if (!exists)` throws when `exists` is falsy (username is free). This blocks new registrations while allowing duplicate usernames.
- **Fix:** Removed the `!` so it throws only when `exists` is truthy (username is taken).

```diff
- if (!exists) {
+ if (exists) {
    throw new ApiError(HTTP_STATUS.CONFLICT, 'Username is already taken');
  }
```

---

### BUG 3 — `login` inverts the password validity check

- **File:** `server/src/services/auth.service.js:40`
- **Problem:** `if (isPasswordValid)` throws on correct passwords and proceeds on wrong ones — the exact opposite of what's needed.
- **Fix:** Added `!` so it throws only when the password is invalid.

```diff
- if (isPasswordValid) {
+ if (!isPasswordValid) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid username or password');
  }
```

---

### BUG 4 — `invitePlayer` unconditional throw (dead code)

- **File:** `server/src/services/gameInvite.service.js:40`
- **Problem:** `throw new ApiError(...)` is placed unconditionally after computing `isReceiverOnline`. All code below (activity checks, invite creation) is unreachable.
- **Fix:** Wrapped the throw inside `if (!isReceiverOnline)`.

```diff
- throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Player is offline and cannot accept invitations');
+ if (!isReceiverOnline) {
+   throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Player is offline and cannot accept invitations');
+ }
```

---

### BUG 5 — `respondToInvite` checks wrong status

- **File:** `server/src/services/gameInvite.service.js:64`
- **Problem:** Newly created invites have `status: 'pending'`. Checking `invite.status !== 'accepted'` is always true for pending invites, so every response throws 404.
- **Fix:** Changed `'accepted'` to `'pending'`.

```diff
- if (!invite || invite.status !== 'accepted') {
+ if (!invite || invite.status !== 'pending') {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Invitation not found or no longer active');
  }
```

---

### BUG 6 — `getFriendsList` hardcodes `online: false`

- **File:** `server/src/services/friendship.service.js:108`
- **Problem:** `isOnline` is correctly computed from `lastActive` on line 101, but line 108 returns hardcoded `false` instead.
- **Fix:** Changed `false` to `isOnline`.

```diff
- online: false,
+ online: isOnline,
```

---

### BUG 7 — `makeMove` only increments X score

- **File:** `server/src/services/game/GameManager.js:98`
- **Problem:** `game.scores.X += 1` runs regardless of who won. When O wins, the score goes to X's tally.
- **Fix:** Use the actual winner mark as the key.

```diff
- game.scores.X += 1;
+ game.scores[winResult.winner] += 1;
```

---

### BUG 8 — `makeMove` never toggles `isXTurn`

- **File:** `server/src/services/game/GameManager.js:134`
- **Problem:** After a move that doesn't end the round, the `else` block is empty — `isXTurn` is never toggled. The same player keeps making all moves.
- **Fix:** Toggle `isXTurn` in the else block.

```diff
  } else {
+   game.isXTurn = !game.isXTurn;
  }
```

---

## Client Bugs — Detailed Fixes

### BUG 9 — `clearCredentials` removes wrong localStorage key

- **File:** `client/src/store/authSlice.js:51`
- **Problem:** `localStorage.removeItem('token')` but the token was stored as `'accessToken'` (line 37). On logout the token persists; on next page load `loadTokenFromStorage()` still finds it.
- **Fix:** Changed key from `'token'` to `'accessToken'`.

```diff
- localStorage.removeItem('token');
+ localStorage.removeItem('accessToken');
```

---

### BUG 10 — `LandingPage` navigates to wrong route

- **File:** `client/src/pages/LandingPage.jsx:12`
- **Problem:** `navigate('/auth/signup')` but the actual route is `/signup`. The wildcard catch-all redirects back to `/`, causing an infinite loop on the main entry point.
- **Fix:** Changed to `navigate('/signup')`.

```diff
- navigate('/auth/signup');
+ navigate('/signup');
```

---

### BUG 11 — `selectAvatar` wipes entire `formData`

- **File:** `client/src/features/auth/hooks/useSignup.js:75`
- **Problem:** `setFormData(() => ({ avatar: avatar.url }))` replaces the entire state with only the avatar, discarding username, password, and fullName entered in previous steps.
- **Fix:** Merge with previous state using spread.

```diff
- setFormData(() => ({ avatar: avatar.url }));
+ setFormData((prev) => ({ ...prev, avatar: avatar.url }));
```

---

### BUG 12 — `OnlineGame` swaps X/O score props

- **File:** `client/src/features/game/components/OnlineGame.jsx:203-204`
- **Problem:** `XScore` receives `match.scores?.O` and `OScore` receives `match.scores?.X` — the values are swapped.
- **Fix:** Match each score prop to its correct value.

```diff
- XScore={match.scores?.O ?? 0}
- OScore={match.scores?.X ?? 0}
+ XScore={match.scores?.X ?? 0}
+ OScore={match.scores?.O ?? 0}
```

---

### BUG 13 — Final winner label is inverted

- **File:** `client/src/features/game/components/OnlineGame.jsx:234`
- **Problem:** `!==` means "if the winner is NOT me, show 'YOU'" — the loser sees "YOU WON".
- **Fix:** Changed `!==` to `===`.

```diff
- {finalWinner._id.toString() !== currentUser._id.toString() ? 'YOU' : 'OPP'}
+ {finalWinner._id.toString() === currentUser._id.toString() ? 'YOU' : 'OPP'}
```

---

### BUG 14 — Optimistic update uses wrong mark

- **File:** `client/src/features/game/providers/GameProvider.jsx:57`
- **Problem:** `prev.isXTurn ? 'O' : 'X'` places the opponent's mark when it's your turn — inverted logic.
- **Fix:** Place the current player's mark.

```diff
- newBoard[cellIndex] = prev.isXTurn ? 'O' : 'X';
+ newBoard[cellIndex] = prev.isXTurn ? 'X' : 'O';
```

---

### BUG 15 — Optimistic update doesn't toggle `isXTurn`

- **File:** `client/src/features/game/providers/GameProvider.jsx:61`
- **Problem:** `isXTurn: prev.isXTurn` keeps the turn unchanged in optimistic state — UI still shows "Your Turn" after clicking.
- **Fix:** Toggle to show it's now the opponent's turn.

```diff
- isXTurn: prev.isXTurn,
+ isXTurn: !prev.isXTurn,
```

---

### BUG 16 — DB connection hardcoded URI ignoring `.env`

- **File:** `server/src/config/db.js:14-15`
- **Problem:** The MongoDB URI was hardcoded to a completely different Atlas cluster (`cluster0.qyfub1p` / `tictactoe`) instead of using `env.MONGODB_URI` from `.env` (`cluster0.orxdubk` / `xogame`). Your `.env` was loaded but never used at connection time.
- **Fix:** Replaced hardcoded URI with `env.MONGODB_URI`.

```diff
- const uri = "mongodb+srv://...cluster0.qyfub1p.mongodb.net/tictactoe";
+ const uri = env.MONGODB_URI;
```

---

### BUG 17 — Invite toast Accept/Decline buttons are swapped

- **File:** `client/src/features/game/components/GameHeader.jsx:436-453`
- **Problem:** The "Decline" button called `handleRespondInvite(invite._id, 'accept')` and the "Accept" button called `handleRespondInvite(invite._id, 'reject')`. Labels were opposite of actual behavior.
- **Fix:** Swapped the action strings to match their labels.

```diff
- onClick={() => { handleRespondInvite(invite._id, 'accept'); ... }}
- ...Decline
+ onClick={() => { handleRespondInvite(invite._id, 'reject'); ... }}
+ ...Decline

- onClick={() => { handleRespondInvite(invite._id, 'reject'); ... }}
- ...Accept
+ onClick={() => { handleRespondInvite(invite._id, 'accept'); ... }}
+ ...Accept
```

---

### BUG 18 — Online indicator colors are inverted

- **File:** `client/src/features/game/components/GameHeader.jsx:52-56`
- **Problem:** `friend.online ? 'bg-muted-foreground/30' : 'bg-emerald-500'` showed a green dot when OFFLINE and a gray dot when ONLINE — completely backwards.
- **Fix:** Swapped the class names so green = online, gray = offline.

```diff
- friend.online ? 'bg-muted-foreground/30' : 'bg-emerald-500'
+ friend.online ? 'bg-emerald-500' : 'bg-muted-foreground/30'
```

---

### BUG 19 — "TIC TAC TOE" title overlaps and blocks dashboard buttons

- **File:** `client/src/features/game/components/GameHero.jsx:359`
- **Problem:** The large decorative "TIC TAC TOE" title was absolutely positioned with `z-20` and `translate-y-[40%]`, causing it to overlap the "In Person" and "Online with Friend" buttons below. The buttons had `z-10`, sitting behind the title, making them completely unclickable with no hover effect.
- **Fix:** Added `pointer-events-none` to the title div so clicks pass through, and bumped the blue section content from `z-10` to `z-30` to ensure buttons render on top.

```diff
- <div className="absolute bottom-0 left-0 right-0 translate-y-[40%] z-20">
+ <div className="absolute bottom-0 left-0 right-0 translate-y-[40%] z-20 pointer-events-none">

- <div className="relative z-10 max-w-[1400px] ...">
+ <div className="relative z-30 max-w-[1400px] ...">
```

---

## Counts

- **9 Critical** bugs fixed (all server auth/game-logic bugs + form data wipe + DB connection + title overlap)
- **9 Medium** bugs fixed (UI display/state issues)
- **19 total** bugs found and resolved
