# Debug Battle 6 — Complete Debugging and Resolution Report

## Document Control

| Field | Value |
|---|---|
| Project | Debug Battle 6 — Tic Tac Toe |
| Scope | React/Vite client, Express/Mongoose API, Socket.IO multiplayer engine |
| Status | Resolved and verified |
| Total defects | 30 |
| Preset challenge defects | 19 |
| Additional runtime defects discovered | 11 |

## Executive Summary

The application contained defects across authentication, database configuration, signup state, friendship presence, invitations, scorekeeping, turn management, Socket.IO synchronization, and UI layering. Several defects completely blocked core flows; others produced incorrect UI state, duplicate requests, stale game state, or accounts permanently marked as playing.

All fixes were limited to debugging the existing behavior. No product feature, route structure, visual concept, or application context was changed. The server remains authoritative for multiplayer state, while the client retains its existing optimistic-update design.

### Severity Definitions

- **Critical:** Blocks a core user journey, breaks authorization/game integrity, or prevents the application from operating correctly.
- **High:** Causes serious state corruption, race conditions, invalid server state, or persistent user impact.
- **Medium:** Produces incorrect UI/UX, duplicate processing, stale state, or behavior that is recoverable without data loss.

## Complete Defect Register

| # | Area / File | Severity | Defect | Resolution |
|---|---|---|---|---|
| 1 | `server/src/utils/jwt.js` | Critical | Access-token verification used the misspelled secret key | Use `JWT_ACCESS_SECRET` consistently |
| 2 | `server/src/services/auth.service.js` | Critical | Signup username-existence condition was inverted | Reject only when the username already exists |
| 3 | `server/src/services/auth.service.js` | Critical | Login password-validity condition was inverted | Reject only invalid passwords |
| 4 | `server/src/services/gameInvite.service.js` | Critical | Invite flow always threw an offline error | Throw only when the receiver is offline |
| 5 | `server/src/services/gameInvite.service.js` | Critical | Pending invites were treated as inactive | Accept responses only for `pending` invites |
| 6 | `server/src/services/friendship.service.js` | Medium | Friend online state was hardcoded to `false` | Return the calculated heartbeat status |
| 7 | `server/src/services/game/GameManager.js` | Critical | O wins incremented X's score | Increment the actual winner's score |
| 8 | `server/src/services/game/GameManager.js` | Critical | Turns never alternated | Toggle `isXTurn` after non-terminal moves |
| 9 | `client/src/store/authSlice.js` | Medium | Logout removed the wrong storage key | Remove `accessToken` |
| 10 | `client/src/pages/LandingPage.jsx` | Medium | Start button navigated to a nonexistent route | Navigate to `/signup` |
| 11 | `client/src/features/auth/hooks/useSignup.js` | Critical | Avatar selection erased prior signup fields | Merge avatar into accumulated form state |
| 12 | `client/src/features/game/components/OnlineGame.jsx` | Medium | X and O score values were swapped | Bind each score to its matching mark |
| 13 | `client/src/features/game/components/OnlineGame.jsx` | Medium | Final winner label identified the loser as "YOU" | Use equality when comparing winner and current user |
| 14 | `client/src/features/game/providers/GameProvider.jsx` | Medium | Optimistic move rendered the opposite mark | Render the mark for the current turn |
| 15 | `client/src/features/game/providers/GameProvider.jsx` | Medium | Optimistic state did not advance the turn | Toggle optimistic `isXTurn` |
| 16 | `server/src/config/db.js` | Critical | Database connector ignored configuration and exposed a hardcoded URI | Connect using validated `env.MONGODB_URI` |
| 17 | `client/src/features/game/components/GameHeader.jsx` | Medium | Invite Accept/Decline actions were reversed | Map labels to the correct actions |
| 18 | `client/src/features/game/components/GameHeader.jsx` | Medium | Online/offline indicator colors were reversed | Green for online; muted for offline |
| 19 | `client/src/features/game/components/GameHero.jsx` | Critical | Decorative title intercepted clicks on game-mode buttons | Disable title pointer events and raise content stacking |
| 20 | `client/src/features/game/providers/GameProvider.jsx` | Critical | Socket match updates were never committed to React state | Call `setMatch(updatedMatch)` for every authoritative update |
| 21 | `server/src/services/game/GameManager.js` | Critical | Server accepted moves from the wrong player | Enforce X/O ownership against `isXTurn` |
| 22 | `server/src/services/game/GameManager.js` | High | Malformed/out-of-range cell indexes could mutate invalid board positions | Validate integer index range before mutation |
| 23 | `server/src/services/game/GameManager.js` | Medium | Previous round's winning line remained after reset | Clear `winCombo` during `resetRound` |
| 24 | `client/src/features/game/components/InPersonGame.jsx` | Medium | First-to-two match still required three completed rounds | Finish immediately when either player reaches two wins |
| 25 | `server/src/services/game/GameManager.js` | High | Aborted matches left database users stuck as `playing` | Reset both users to `idle` in MongoDB |
| 26 | `client/src/features/game/providers/GameProvider.jsx` | High | Leaving triggered Socket.IO, HTTP, and callback leave paths | Use one parent-owned exit path |
| 27 | `client/src/features/game/socket/events/room.events.js` | Medium | Opponent-left handling invoked exit twice | Retain a single callback contract |
| 28 | `client/src/features/game/components/GameHeader.jsx` | Medium | Client retained a stale active room after leaving | Clear the active room after successful exit |
| 29 | Socket synchronization services | Medium | Reconnect notification was echoed to the reconnecting player | Exclude the reconnecting socket |
| 30 | Socket synchronization services | Medium | Leave notification was echoed to the leaving player | Exclude the leaving socket |

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
- **Problem:** `if (!exists)` throws when `exists` is falsy (the username is free). This blocks valid registrations and bypasses the intended friendly `409 Conflict` path for taken usernames. MongoDB's unique index still prevents a duplicate record, but the service could fall through to a database duplicate-key error instead of handling it correctly.
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

- **File:** `server/src/services/gameInvite.service.js` — `respondToInvite`
- **Problem:** Newly created invites have `status: 'pending'`. Checking `invite.status !== 'accepted'` rejected every valid response to a pending invite with `404 Not Found`.
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

- **File:** `server/src/services/game/GameManager.js` — `makeMove`
- **Problem:** `game.scores.X += 1` ran regardless of who won. An O victory was incorrectly credited to X.
- **Fix:** Use the actual winner mark as the key.

```diff
- game.scores.X += 1;
+ game.scores[winResult.winner] += 1;
```

---

### BUG 8 — `makeMove` never toggles `isXTurn`

- **File:** `server/src/services/game/GameManager.js` — `makeMove`
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
- **Problem:** `navigate('/auth/signup')` targeted a route that does not exist. The wildcard route redirected back to `/`, so clicking Start appeared to bounce back to the landing page instead of opening signup.
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

- **File:** `server/src/config/db.js` — `connectDB`
- **Problem:** The database module contained an embedded remote connection string and ignored the already validated `env.MONGODB_URI`. This made deployments connect to the wrong database, exposed credentials in source, and made environment-specific configuration ineffective.
- **Fix:** Removed the embedded URI and passed `env.MONGODB_URI` directly to Mongoose. A safe `server/.env.example` was also added so required settings are explicit without committing secrets.

```diff
- const conn = await mongoose.connect(hardcodedUri);
+ const conn = await mongoose.connect(env.MONGODB_URI);
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
