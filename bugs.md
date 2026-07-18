# Debug Battle 6 — Complete Debugging and Resolution Report

## Document Control

| Field | Value |
|---|---|
| Project | Debug Battle 6 — Tic Tac Toe |
| Scope | React/Vite client, Express/Mongoose API, Socket.IO multiplayer engine |
| Status | Resolved and verified |
| Total defects | 31 |
| Preset challenge defects | 19 |
| Additional runtime defects discovered | 12 |

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Complete Defect Register](#complete-defect-register)
3. [Preset Server Bugs](#preset-server-bugs--detailed-fixes)
4. [Preset Client and Configuration Bugs](#preset-client-and-configuration-bugs--detailed-fixes)
5. [Additional Runtime Bugs](#additional-runtime-bugs-discovered-during-full-system-debugging)
6. [Resolution Summary](#resolution-summary)
7. [Verification and Test Evidence](#verification-and-test-evidence)
8. [Runtime Configuration](#runtime-configuration)
9. [Security Note](#security-note)
10. [Final Outcome](#final-outcome)

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
| 31 | `server/src/app.js` | Medium | Helmet CSP blocked all externally generated DiceBear avatars | Allow only the required DiceBear image origin |

---

## Preset Server Bugs — Detailed Fixes

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

## Preset Client and Configuration Bugs — Detailed Fixes

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

## Additional Runtime Bugs Discovered During Full-System Debugging

The preset list covered 19 deliberately planted defects. Building, deploying, and exercising the complete application exposed the following 12 additional runtime defects.

### BUG 20 — Authoritative online match updates were never applied

- **Severity:** Critical
- **File:** `client/src/features/game/providers/GameProvider.jsx` — `onMatchUpdate`
- **Observed behavior:** A player mainly saw their own optimistic move. Opponent moves, updated scores, round winners, winning lines, and server-triggered board resets did not reliably appear.
- **Root cause:** The `match-update` listener handled countdown UI but never stored `updatedMatch` in React state.
- **Resolution:** Commit every server-authoritative update before processing countdown state.

```diff
 onMatchUpdate: (updatedMatch) => {
+  setMatch(updatedMatch);

   if (!updatedMatch.roundWinner) {
```

- **Why this is correct:** The server remains the source of truth. Optimistic state is temporary and is replaced by the next authoritative socket payload.

---

### BUG 21 — Server did not enforce whose turn it was

- **Severity:** Critical
- **File:** `server/src/services/game/GameManager.js` — `makeMove`
- **Observed behavior:** A modified client could send moves for both sides or move repeatedly without waiting for the opponent.
- **Root cause:** `isPlayerX` and `isPlayerO` were calculated but never used. Client-side disabled buttons were the only turn restriction and could be bypassed through raw socket events.
- **Resolution:** Reject a move unless the authenticated player owns the mark for the current turn.

```js
if ((game.isXTurn && !isPlayerX) || (!game.isXTurn && !isPlayerO)) {
  return null;
}
```

- **Why this is correct:** Multiplayer rules are now enforced by the trusted server rather than depending on client behavior.

---

### BUG 22 — Server accepted malformed board indexes

- **Severity:** High
- **File:** `server/src/services/game/GameManager.js` — `makeMove`
- **Observed behavior:** Values such as `-1`, `9`, fractional numbers, strings, `NaN`, or `Infinity` could create invalid array properties, expand the board, consume a turn without a visible mark, or corrupt synchronized state.
- **Root cause:** `cellIndex` was used directly without type or range validation.
- **Resolution:** Require an integer within the actual board bounds before reading or mutating the board.

```js
if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex >= game.board.length) {
  return null;
}
```

---

### BUG 23 — Previous winning line remained in the next online round

- **Severity:** Medium
- **File:** `server/src/services/game/GameManager.js` — `resetRound`
- **Observed behavior:** The new blank board could still display the previous round's strike-through line.
- **Root cause:** Round reset cleared `board` and `roundWinner` but did not clear `winCombo`.
- **Resolution:** Reset all round-scoped winner state.

```diff
 game.board = Array(9).fill(null);
 game.roundWinner = null;
+game.winCombo = null;
```

---

### BUG 24 — A 2–0 in-person result incorrectly required a third round

- **Severity:** Medium
- **File:** `client/src/features/game/components/InPersonGame.jsx` — `gameReducer`
- **Observed behavior:** A player who won the first two rounds still had to play a meaningless third round.
- **Root cause:** Match completion required both two wins and `newRoundsPlayed >= 3`.
- **Resolution:** End immediately when either player reaches the existing first-to-two target. Draws can still extend the match naturally.

```diff
-if (newRoundsPlayed >= 3 && (newScores.X >= 2 || newScores.O >= 2)) {
+if (newScores.X >= 2 || newScores.O >= 2) {
```

---

### BUG 25 — Aborted matches left persisted users stuck as `playing`

- **Severity:** High
- **File:** `server/src/services/game/GameManager.js` — `abortGame`
- **Observed behavior:** After socket abandonment or expiry of the disconnect grace period, users could remain unavailable for future invitations and matches.
- **Root cause:** `abortGame` reset only the in-memory `PlayerManager`; the MongoDB `User.activity` values remained `playing`.
- **Resolution:** Reset both participants in persistent storage as part of abort cleanup.

```js
await User.updateMany(
  { _id: { $in: [game.playerX._id, game.playerO._id] } },
  { activity: 'idle' }
);
```

- **Failure handling:** Database reset errors are logged without preventing the remaining room and history cleanup from proceeding.

---

### BUG 26 — One Abandon click launched competing leave operations

- **Severity:** High
- **File:** `client/src/features/game/providers/GameProvider.jsx` — `leaveMatch`
- **Observed behavior:** A single click could trigger one Socket.IO abort, two REST leave requests, repeated cleanup, and duplicate success handling.
- **Root cause:** `leaveMatch` emitted `leave-match`, called `gameApi.leave()`, and then called `onGameExit()`. The parent implementation of `onGameExit()` also called `gameApi.leave()`.
- **Resolution:** Establish one canonical owner for leaving: the provider now delegates once to `onGameExit()`.

```diff
-connectionManager.emit('leave-match');
-await gameApi.leave();
-toast.success('Left match successfully');
-onGameExit();
+await onGameExit();
```

- **Why this is correct:** The parent handler owns the API request, Redux activity update, active-room cleanup, and success toast as one coherent transaction.

---

### BUG 27 — One `opponent-left` event invoked exit twice

- **Severity:** Medium
- **Files:**
  - `client/src/features/game/providers/GameProvider.jsx`
  - `client/src/features/game/socket/events/room.events.js`
- **Observed behavior:** Opponent abandonment launched duplicate REST leave requests and repeated local state updates.
- **Root cause:** `GameProvider` supplied the same exit behavior as both `onOpponentLeft` and `onGameExit`, while the event adapter called both callbacks.
- **Resolution:** Simplify the adapter to a single callback contract.

```diff
-export const registerRoomEvents = (manager, { onOpponentLeft, onGameExit }) => {
+export const registerRoomEvents = (manager, { onOpponentLeft }) => {
   // ...
   onOpponentLeft?.();
-  onGameExit?.();
 };
```

---

### BUG 28 — Client retained a stale active room after leaving

- **Severity:** Medium
- **File:** `client/src/features/game/components/GameHeader.jsx` — `handleLeaveGame`
- **Observed behavior:** A later socket reconnect could attempt to rejoin an old completed or deleted room, causing false recovery errors.
- **Root cause:** Successful leave updated the API and Redux user state but did not clear `ConnectionManager.activeRoomId`.
- **Resolution:** Clear the room reference immediately after the server confirms the leave.

```diff
 await gameApi.leave();
+ConnectionManager.setActiveRoom(null);
 dispatch(updateUser({ activity: 'idle' }));
```

---

### BUG 29 — Reconnecting player received their own reconnect notification

- **Severity:** Medium
- **Files:**
  - `server/src/services/game/EventRegistry.js`
  - `server/src/services/game/StateSynchronizer.js`
- **Observed behavior:** The reconnecting user could see “Opponent reconnected!” even though their own socket had reconnected.
- **Root cause:** After joining the room, `player-reconnected` was broadcast to every room member, including the new socket.
- **Resolution:** Add an optional excluded socket ID and send the event to the room except the reconnecting socket.

```js
let target = this.io.to(`match:${roomId}`);
if (excludedSocketId) target = target.except(excludedSocketId);
target.emit('player-reconnected', { userId });
```

---

### BUG 30 — Leaving player received their own opponent-left notification

- **Severity:** Medium
- **Files:**
  - `server/src/services/game/EventRegistry.js`
  - `server/src/services/game/StateSynchronizer.js`
  - `server/src/services/gameInvite.service.js`
- **Observed behavior:** The leaving user could receive “Opponent left,” re-enter exit handling, show a false toast, and amplify the duplicate-leave race.
- **Root cause:** Both explicit socket abandonment and REST leave broadcast `opponent-left` to every socket in the room.
- **Resolution:** Pass the leaving user's socket ID to `sendOpponentLeft` and exclude it from the broadcast. Only the remaining opponent is notified.

```js
StateSynchronizer.sendOpponentLeft(
  activeRoom.roomId,
  'Opponent has left the game',
  leavingSocketId
);
```

---

### BUG 31 — Production Content Security Policy blocked avatar images

- **Severity:** Medium
- **File:** `server/src/app.js` — Helmet configuration
- **Observed behavior:** The avatar selection grid rendered broken-image icons even though every DiceBear URL was valid and selectable.
- **Root cause:** Helmet's default Content Security Policy emitted `img-src 'self' data:`. All generated avatars use `https://api.dicebear.com`, so production browsers correctly blocked them.
- **Resolution:** Keep Helmet and its default protections enabled while narrowly adding the required DiceBear image origin.

```js
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        imgSrc: ["'self'", 'data:', 'https://api.dicebear.com'],
      },
    },
  }),
);
```

- **Why this is correct:** The fix does not disable CSP or permit arbitrary HTTPS images. It authorizes only the application's existing avatar provider.

## Resolution Summary

| Severity | Preset | Additional | Total |
|---|---:|---:|---:|
| Critical | 10 | 2 | 12 |
| High | 0 | 3 | 3 |
| Medium | 9 | 7 | 16 |
| **Total** | **19** | **12** | **31** |

## Verification and Test Evidence

### 1. Dependency and build verification

- Installed locked client and server dependencies with `npm ci`.
- Client dependency audit completed with zero reported vulnerabilities during installation.
- Ran the Vite production build successfully:
  - 2,175 modules transformed.
  - HTML, CSS, and JavaScript assets generated successfully.
  - The existing bundle-size advisory is non-blocking and does not affect correctness.

### 2. Server static verification

- Executed `node --check` against every server JavaScript file.
- Result: all server files passed syntax validation.
- Executed `git diff --check`.
- Result: no whitespace errors were detected.
- Verified the production root response returns `200` and its CSP explicitly permits `https://api.dicebear.com` under `img-src`.
- Verified the DiceBear SVG endpoint independently returns `200 image/svg+xml`.

### 3. Focused behavioral assertions

The game engine was exercised directly with assertions for:

- Wrong player rejected on X's turn.
- Negative and out-of-range cells rejected.
- Valid X move accepted and turn changed to O.
- Repeated X move rejected during O's turn.
- Valid O move accepted.
- O victory credited to O, not X.
- Round reset cleared `winCombo`.
- First-to-two match returned the correct final winner.
- Abort cleanup reset both participant IDs.

The authentication service was exercised directly for:

- Free username signup succeeds.
- Taken username produces `409 Conflict`.
- Correct password login succeeds.
- Incorrect password produces `401 Unauthorized`.

### 4. End-to-end API verification

The repaired server was launched against a disposable local MongoDB instance and tested over HTTP.

| Flow | Expected | Result |
|---|---:|---:|
| `GET /health` | 200 | Passed |
| New account signup | 201 | Passed |
| Duplicate signup | 409 | Passed |
| Wrong-password login | 401 | Passed |
| Authenticated `GET /api/auth/me` | 200 | Passed |
| Presence heartbeat | 200 | Passed |
| Create game invite | 201 | Passed |
| Reject pending invite | 200 | Passed |
| Create and accept friendship | 200 | Passed |
| Online friend status | `online: true` | Passed |

The temporary API and MongoDB processes were shut down cleanly after verification.

## Runtime Configuration

The server now reads configuration from the environment. Copy the safe template and replace the placeholder secret:

```bash
cd server
cp .env.example .env
# Set JWT_ACCESS_SECRET to a long random value.
npm start
```

Start the client separately:

```bash
cd client
npm run dev
```

Required server configuration is documented in `server/.env.example`:

- `MONGODB_URI`
- `JWT_ACCESS_SECRET`
- `JWT_ACCESS_EXPIRES_IN`
- `CLIENT_ORIGIN`
- `PORT`
- `NODE_ENV`

## Security Note

Because a database credential had previously been embedded in source code, that credential should be rotated if it was ever active, and repository history should be reviewed before publishing or sharing the project. The repaired source no longer contains or depends on that remote connection string.

## Final Outcome

All 31 documented defects are resolved. Authentication, signup, avatar rendering, logout, friend presence, invitation handling, in-person gameplay, online turn enforcement, scorekeeping, round reset, leave/disconnect cleanup, Socket.IO synchronization, and database configuration now behave consistently with the application's original design.
