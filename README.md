# The Heart of Te Fiti — Team Station Game

A mobile-friendly team game hosted on **GitHub Pages** with **Firebase** (Anonymous Auth + Firestore).
Teams register, visit 5 stations, and enter 6 codes. With every correct code, the lava demon calms down.
When all 6 are in, Te Fiti turns green, flowers bloom, hearts and petals float, and a **Congratulations** message appears.

| Station | Codes | Notes |
|---|---|---|
| 1 – Motunui Village | 1516, 210 | Two boxes, any order |
| 2 – The Open Ocean | 18 | |
| 3 – Kakamora Waters | 1626 | |
| 4 – Lalotai, Realm of Monsters | 154 | |
| 5 – Te Fiti's Shore | 1412 | |

Stations can be done in **any order**, so teams can rotate between them without waiting.

---

## 1. Files

```
te-fiti-game/
├── index.html            ← players: welcome, registration, game
├── monitor.html          ← moderator: live progress of all teams (PIN protected)
├── firestore.rules       ← paste into Firebase (not used by GitHub)
├── README.md
├── css/
│   ├── style.css
│   └── monitor.css
└── js/
    ├── firebase-config.js ← YOU EDIT THIS (Firebase config + monitor PIN)
    ├── codes.js           ← station names, hashed codes, story text
    ├── game.js
    ├── monitor.js
    ├── scene.js           ← Te Fiti illustration + animations
    └── audio.js           ← sound effects (generated, no audio files)
```

---

## 2. Firebase setup

### 2.1 Create the project
1. Go to **https://console.firebase.google.com** → **Add project** (or *Create a project*).
2. Name it, e.g. `te-fiti-game` → Continue. Google Analytics is not needed → **Create project**.

### 2.2 Register a web app and copy the config
1. On the project home page, click the **Web** icon `</>`.
2. App nickname: `te-fiti-web`. Do **not** tick Firebase Hosting → **Register app**.
3. Firebase shows a `firebaseConfig = { ... }` block. Copy the values.
4. Open `js/firebase-config.js` and replace the placeholder values with yours:
   ```js
   export const firebaseConfig = {
     apiKey: "AIza....",
     authDomain: "te-fiti-game.firebaseapp.com",
     projectId: "te-fiti-game",
     storageBucket: "te-fiti-game.appspot.com",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abc123"
   };
   export const MONITOR_PIN = "2026";   // change to your own PIN
   ```
   (If Firebase shows `storageBucket` ending in `.firebasestorage.app`, keep it exactly as shown.)

### 2.3 Enable Anonymous sign-in
1. Left menu → **Build → Authentication** → **Get started**.
2. **Sign-in method** tab → **Anonymous** → toggle **Enable** → **Save**.

### 2.4 Create the Firestore database
1. Left menu → **Build → Firestore Database** → **Create database**.
2. Choose a location close to you (e.g. `europe-west1` / `eur3`) → Next.
3. Choose **Start in production mode** → **Create**.

### 2.5 Publish the security rules
1. Firestore Database → **Rules** tab.
2. Delete everything there, paste the full content of `firestore.rules`, click **Publish**.

No indexes are needed — the game only uses simple queries.

---

## 3. GitHub Pages deployment

### 3.1 Create the repository
1. Go to **https://github.com** → **New repository**.
2. Name: `te-fiti-game` → **Public** → **Create repository**.

### 3.2 Upload the files
1. In the new repo click **uploading an existing file** (or **Add file → Upload files**).
2. Open the unzipped `te-fiti-game` folder on your computer, select **everything inside it**
   (`index.html`, `monitor.html`, `firestore.rules`, `README.md`, and the `css` and `js` folders) and drag it into the upload area.
   The folders must keep their names — `css/…` and `js/…` must appear in the file list.
3. Click **Commit changes**.

> ⚠️ Make sure `index.html` is at the **root** of the repository, not inside a `te-fiti-game/` sub-folder.

### 3.3 Turn on GitHub Pages
1. Repo → **Settings** → **Pages** (left menu).
2. **Source:** *Deploy from a branch*. **Branch:** `main`, folder `/ (root)` → **Save**.
3. Wait 1–2 minutes and refresh. The site link appears at the top:
   - Players: `https://<your-username>.github.io/te-fiti-game/`
   - Monitor: `https://<your-username>.github.io/te-fiti-game/monitor.html`

### 3.4 Authorize the GitHub domain in Firebase
Firebase → **Authentication → Settings → Authorized domains** → **Add domain** → `<your-username>.github.io` → Add.

---

## 4. Test before the event

1. Open the player link on your phone → **Begin the Voyage** → register a test team.
2. On a laptop, open `monitor.html` → enter the PIN → the test team should appear.
3. Enter one wrong code (lava roars, wrong attempts +1 on monitor) and a few correct codes
   (Te Fiti calms, monitor updates live).
4. Finish all 6 codes → transformation + Congratulations popup; the monitor shows 🌺 Restored and a 🏆 banner.
5. Refresh the phone page → **Continue as "<team>"** appears and progress is kept.

### Clean up test teams
Firebase → **Firestore Database → Data** → `teams` collection → open each test document → **⋮ → Delete document**.

### Generate QR codes (optional)
Create a QR code for the player link with any QR generator and print it at the start point.

---

## 5. How it works on the day

- Each team registers on **one phone** — progress is saved to Firebase and tied to that phone/browser.
  If the page is closed or refreshed, the team taps **Continue as "<team>"**.
- Team names must be unique.
- Station 1 has two boxes; either code can go in either box.
- Typing a code that was already used just shows a hint (not counted as a wrong attempt).
- The monitor ranks finished teams by time (🥇🥈🥉), then teams still sailing by codes returned.
- Sound: tap 🔊 / 🔇 in the top bar. Phones need a tap before sound can play — the first button tap handles that.

---

## 6. Changing the codes (optional)

Codes are stored as SHA-256 hashes in `js/codes.js` so players can't find them in the page source.
To change a code:

1. Open the game page in Chrome/Edge → press **F12** → **Console** tab.
2. Paste this (replace `1234` with your new code) and press Enter:
   ```js
   crypto.subtle.digest("SHA-256", new TextEncoder().encode("TeFiti-Heart-2026|1234"))
     .then(b => console.log([...new Uint8Array(b)].map(x => x.toString(16).padStart(2,"0")).join("")));
   ```
3. Copy the printed hash and replace the old hash in `js/codes.js` (keep the code ID, e.g. `"s2"`, the same).
4. Commit the file to GitHub. Pages updates in about 1 minute.

Station titles and story lines can also be edited in `js/codes.js`.

---

## 7. Troubleshooting

| Problem | Fix |
|---|---|
| Welcome screen stays on "Connecting…" or shows `auth/operation-not-allowed` | Anonymous sign-in is not enabled (step 2.3). |
| `auth/api-key-not-valid` / `invalid-api-key` | Config in `js/firebase-config.js` is wrong — copy it again from Project settings. |
| "Could not register: permission-denied" | Rules not published (step 2.5), or the team name is shorter than 2 / longer than 30 characters. |
| Page is blank / styles missing | `css` and `js` folders not uploaded, or `index.html` is inside a sub-folder. |
| Changes on GitHub don't show | Wait 1–2 minutes, then hard refresh (Ctrl + F5) or open in a private window. |
| Opening `index.html` by double-click doesn't work | Expected — the game must run from the GitHub Pages link (https). |
