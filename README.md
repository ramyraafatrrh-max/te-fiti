# The Heart of Te Fiti — Team Station Game (v2)

Teams register with a **team name + password**, visit 5 stations and enter 6 codes. Each correct code calms the lava demon;
after all 6, Te Fiti turns green and a **Congratulations** message appears.
The moderator logs in to `monitor.html` to watch every team live and **reset** or **delete** teams.

| Station | Codes |
|---|---|
| 1 – Motunui Village | 1516, 210 (two boxes, any order) |
| 2 – The Open Ocean | 18 |
| 3 – Kakamora Waters | 1626 |
| 4 – Lalotai, Realm of Monsters | 154 |
| 5 – Te Fiti's Shore | 1412 |

## Security model
- Every team is a Firebase **Email/Password** account (created automatically from the team name — players never see an email).
- Firestore rules allow a team to **read and update only its own progress**. No team can see or change another team.
- Only the **moderator account** can see all teams, reset them and delete them.

---

## 1. Firebase setup

### 1.1 Web app config (skip if already done)
Firebase Console → ⚙️ **Project settings → General → Your apps → SDK setup and configuration → Config**.
Copy the values into `js/firebase-config.js` (replace the placeholders, keep the quotes and commas).

### 1.2 Enable Email/Password sign-in
**Build → Authentication → Sign-in method → Add new provider → Email/Password → Enable** (first switch only) → **Save**.
(Anonymous sign-in from version 1 is no longer used — you can disable it.)

### 1.3 Create the moderator account
**Authentication → Users → Add user**
- Email: e.g. `ramy.tefiti@gmail.com` (any email, **all lowercase**; it does not need to be a real inbox)
- Password: your choice (min. 6 characters) → **Add user**

### 1.4 Put the moderator email in TWO places (must match exactly)
1. `js/firebase-config.js` → `export const ADMIN_EMAIL = "ramy.tefiti@gmail.com";`
2. `firestore.rules` → `request.auth.token.email == "ramy.tefiti@gmail.com";`

### 1.5 Publish the rules
**Firestore Database → Rules** → delete everything → paste the full `firestore.rules` → **Publish**.

### 1.6 Authorized domain
**Authentication → Settings → Authorized domains** → make sure `<your-username>.github.io` is listed.

---

## 2. GitHub update
Repo → upload/replace these files (keep the folders):

```
index.html
monitor.html
firestore.rules
README.md
css/style.css
css/monitor.css
js/firebase-config.js   ← with your config + ADMIN_EMAIL
js/game.js
js/monitor.js
js/scene.js
js/codes.js
js/audio.js
```
**Add file → Upload files** → drag all files/folders → **Commit changes**. Wait 1–2 minutes → **Ctrl + F5**.

---

## 3. Using it

### Players
- **Begin the Voyage — Register Team**: team name, members (optional), password ×2.
- **My team is registered — Log in**: team name + password (works on any phone; progress continues).
- The same phone stays logged in after refresh → **Continue as "<team>"**. ⎋ in the top bar logs out.

### Moderator (`/monitor.html`)
- Log in with the moderator email + password.
- **↺ Reset** (per team): progress, wrong attempts and timer go back to zero. The team's screen updates instantly and Te Fiti becomes a lava demon again. The team keeps its name and password.
- **🗑** (per team): removes the team. Its phone is logged out immediately.
- **Reset all teams / Delete all teams**: you must type `RESET` / `DELETE` to confirm.
- **Sign out** when done.

### Notes
- After **Delete**, the team name is still linked to its old password. Registering again with the *same* name + *same* password works.
  To free a name completely: **Authentication → Users** → find the user created at that time → ⋮ → **Delete account**.
- Forgotten team password: the moderator deletes the team (monitor) and its user (Authentication → Users), then the team registers again.
- Logging in to the monitor on a player's phone logs that phone out of its team (one login per browser).
- Teams created with version 1 can't be opened anymore — use **Delete all teams** once to clear them.

---

## 4. Troubleshooting

| Message / problem | Fix |
|---|---|
| "Firebase is not configured yet…" | Paste your config into `js/firebase-config.js` (step 1.1). |
| "Email/Password sign-in is not enabled…" | Step 1.2. |
| "Permission denied — check that the Firestore rules were published." | Step 1.5. |
| Monitor: "Error reading teams: permission-denied" | Moderator email in `firestore.rules` doesn't match the login email (step 1.4), or rules not published. |
| Monitor: "This is not the moderator account." | Email typed ≠ `ADMIN_EMAIL` in `js/firebase-config.js`. |
| `auth/unauthorized-domain` | Step 1.6. |
| Changes don't appear | Wait 1–2 min, then Ctrl + F5 or a private window. |

## 5. Changing the codes (optional)
In the browser console (F12) run, replacing `1234`:
```js
crypto.subtle.digest("SHA-256", new TextEncoder().encode("TeFiti-Heart-2026|1234"))
  .then(b => console.log([...new Uint8Array(b)].map(x => x.toString(16).padStart(2,"0")).join("")));
```
Replace the matching hash in `js/codes.js` and commit.
