# Firebase tutorial for YOUR project

Your project is **React + Vite**, so use this structure:

```text
index.html          → leave alone
src/main.jsx        → leave alone
src/firebase.js     → Firebase connection/config only
src/App.jsx         → login, logout, save, load + buttons
Cursor Terminal     → npm/Firebase commands
Firebase Console    → turn Auth/Firestore/Storage on
```

> Important: **Do not add Firebase buttons or `document.querySelector()` code to `index.html`.**
> Your app is React, so the Firebase UI and handlers belong in `src/App.jsx`.

---

## Step 1 — Create/register the Firebase project

**Where:** Web browser → Firebase Console

1. Open your Firebase project.
2. If the web app is not registered yet:
   - Go to **Project Overview**
   - Click **Add app**
   - Choose the Web icon `</>`
3. Register the app.
4. Firebase will give you a config object like:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

Keep this browser tab open. You will use these values in `src/firebase.js`.

---

## Step 2 — Install Firebase

**Where:** Cursor → Terminal

Make sure Terminal is inside your project folder, then run:

```bash
npm install firebase
```

You only need to do this once unless you delete `node_modules`, clone the project again, or move to a new computer.

---

## Step 3 — Create the Firebase connection file

**Where:** Cursor → `src/firebase.js`

Create:

```text
src/firebase.js
```

Paste:

```js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "YOUR_REAL_VALUE",
  authDomain: "YOUR_REAL_VALUE",
  projectId: "YOUR_REAL_VALUE",
  storageBucket: "YOUR_REAL_VALUE",
  messagingSenderId: "YOUR_REAL_VALUE",
  appId: "YOUR_REAL_VALUE"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);
```

Replace every placeholder with the real values from Firebase Console.

**Nothing else needs to go in `firebase.js`.**

---

## Step 4 — Enable Google Login

**Where:** Web browser → Firebase Console

Go to:

```text
Authentication
→ Sign-in method
→ Google
```

Enable Google sign-in and save.

---

## Step 5 — Add Authentication code

**Where:** Cursor → `src/App.jsx`

At the top of `App.jsx`, add:

```jsx
import { signInWithPopup, signOut } from "firebase/auth";
import { auth, provider } from "./firebase.js";
```

Inside `function App()`, but before `return (...)`, add:

```jsx
async function login() {
  try {
    const result = await signInWithPopup(auth, provider);
    console.log("Logged in:", result.user.email);
    alert(`Logged in as ${result.user.email}`);
  } catch (error) {
    console.error("Login error:", error);
  }
}

async function logout() {
  try {
    await signOut(auth);
    console.log("Logged out");
    alert("Logged out");
  } catch (error) {
    console.error("Logout error:", error);
  }
}
```

Inside the JSX returned by `App()`, add:

```jsx
<button onClick={login}>
  LOGIN WITH GOOGLE
</button>

<button onClick={logout}>
  LOGOUT
</button>
```

Do **not** use:

```js
document.querySelector(...)
```

To test:

**Where:** Cursor → Terminal

```bash
npm run dev
```

Open the localhost URL in your browser and click **LOGIN WITH GOOGLE**.

---

## Step 6 — Create Firestore

**Where:** Web browser → Firebase Console

Go to:

```text
Firestore Database
→ Create database
```

Choose **Production mode**.

Pick a database location and finish creating the database.

Then go to:

```text
Firestore Database
→ Rules
```

Replace the rules with:

```text
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write:
        if request.auth != null
        && request.auth.uid == userId;
    }
  }
}
```

Click **Publish**.

---

## Step 7 — Add Firestore imports

**Where:** Cursor → `src/App.jsx`

At the top of `App.jsx`, add:

```jsx
import { doc, setDoc, getDoc } from "firebase/firestore";
```

Change:

```jsx
import { auth, provider } from "./firebase.js";
```

to:

```jsx
import { auth, provider, db } from "./firebase.js";
```

Your Firebase-related imports should now look like:

```jsx
import { signInWithPopup, signOut } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, provider, db } from "./firebase.js";
```

---

## Step 8 — Add `saveConfig()`

**Where:** Cursor → `src/App.jsx`

Inside `function App()`, below your state variables and near `login()` / `logout()`, add:

```jsx
async function saveConfig() {
  const user = auth.currentUser;

  if (!user) {
    alert("Login first");
    return;
  }

  try {
    const config = {
      tab,
      particles,
      noise
    };

    const configJson = JSON.stringify(config);

    await setDoc(
      doc(db, "users", user.uid, "configs", "latest"),
      {
        configJson: configJson
      }
    );

    alert("Configuration saved!");
    console.log("Saved configuration:", config);
  } catch (error) {
    console.error("Save error:", error);
    alert("Save failed. Check the browser console.");
  }
}
```

This saves your actual React state:

```text
tab
particles
noise
```

---

## Step 9 — Add `loadConfig()`

**Where:** Cursor → `src/App.jsx`

Directly below `saveConfig()`, add:

```jsx
async function loadConfig() {
  const user = auth.currentUser;

  if (!user) {
    alert("Login first");
    return;
  }

  try {
    const snapshot = await getDoc(
      doc(db, "users", user.uid, "configs", "latest")
    );

    if (!snapshot.exists()) {
      alert("No saved configuration found.");
      return;
    }

    const savedData = snapshot.data();
    const config = JSON.parse(savedData.configJson);

    if (config.tab) {
      setTab(config.tab);
    }

    if (config.particles) {
      setParticles(config.particles);
    }

    if (config.noise) {
      setNoise(config.noise);
    }

    alert("Configuration loaded!");
    console.log("Loaded configuration:", config);
  } catch (error) {
    console.error("Load error:", error);
    alert("Load failed. Check the browser console.");
  }
}
```

---

## Step 10 — Add Save and Load buttons

**Where:** Cursor → `src/App.jsx`

Inside the `return (...)`, place the buttons in the same floating UI area as Login and Logout:

```jsx
<div
  style={{
    position: "fixed",
    top: "20px",
    right: "20px",
    zIndex: 99999,
    display: "flex",
    gap: "8px",
  }}
>
  <button onClick={login}>
    LOGIN WITH GOOGLE
  </button>

  <button onClick={logout}>
    LOGOUT
  </button>

  <button onClick={saveConfig}>
    SAVE CONFIGURATION
  </button>

  <button onClick={loadConfig}>
    LOAD CONFIGURATION
  </button>
</div>
```

Do **not** add:

```js
document.querySelector("#save").onclick = saveConfig;
```

---

## Step 11 — Test Firestore

**Where:** Cursor Terminal + browser

Run:

```bash
npm run dev
```

Test:

```text
Login with Google
↓
Change some particle/noise settings
↓
SAVE CONFIGURATION
↓
Change the settings again
↓
LOAD CONFIGURATION
```

Then check:

**Where:** Web browser → Firebase Console

```text
Firestore Database
→ Data
```

You should see something like:

```text
users
└── your-user-id
    └── configs
        └── latest
            └── configJson
```

If this works:

```text
Firestore ✅
Save Configuration ✅
Load Configuration ✅
Configuration linked to logged-in user ✅
```

---

## Step 12 — Enable Firebase Storage

**Where:** Web browser → Firebase Console

> You can skip this temporarily and come back later.

Go to:

```text
Storage
→ Get started
```

Once Storage exists, go to:

```text
Storage
→ Rules
```

Use:

```text
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/{allPaths=**} {
      allow read, write:
        if request.auth != null
        && request.auth.uid == userId;
    }
  }
}
```

Click **Publish**.

---

## Step 13 — Add Storage imports

**Where:** Cursor → `src/App.jsx`

Only do this after Storage is enabled.

At the top of `App.jsx`, add:

```jsx
import { ref, uploadString } from "firebase/storage";
```

Change:

```jsx
import { auth, provider, db } from "./firebase.js";
```

to:

```jsx
import { auth, provider, db, storage } from "./firebase.js";
```

---

## Step 14 — Upload one JSON file to Storage

**Where:** Cursor → `src/App.jsx`

Inside your existing `saveConfig()` function, find:

```jsx
await setDoc(
  doc(db, "users", user.uid, "configs", "latest"),
  {
    configJson: configJson
  }
);
```

Immediately after it, add:

```jsx
const fileRef = ref(
  storage,
  `users/${user.uid}/latest-config.json`
);

await uploadString(
  fileRef,
  configJson,
  "raw",
  {
    contentType: "application/json"
  }
);
```

That is enough to demonstrate Firebase Storage.

---

## Step 15 — Test Storage

**Where:** Browser

Run your app locally, log in, and click:

```text
SAVE CONFIGURATION
```

Then go to:

```text
Firebase Console
→ Storage
→ Files
```

You should see:

```text
users/
└── your-user-id/
    └── latest-config.json
```

If so:

```text
Storage ✅
```

---

## Step 16 — Set up Firebase Hosting

**Where:** Cursor → Terminal

First build your Vite project:

```bash
npm run build
```

Vite creates:

```text
dist/
```

Then install the Firebase CLI if needed:

```bash
npm install -g firebase-tools
```

Log in:

```bash
firebase login
```

Then run:

```bash
firebase init hosting
```

Choose:

```text
Use an existing project
```

Select your Firebase project.

When Firebase asks for the public directory, enter:

```text
dist
```

When it asks:

```text
Configure as a single-page app?
```

choose:

```text
Yes
```

If it asks about automatic GitHub deployment:

```text
No
```

If it asks:

```text
File dist/index.html already exists. Overwrite?
```

choose:

```text
No
```

You only need to initialize Hosting once.

---

## Step 17 — Deploy the public website

**Where:** Cursor → Terminal

Whenever you want to publish the latest version, first rebuild:

```bash
npm run build
```

Then deploy:

```bash
firebase deploy --only hosting
```

Firebase will give you a public URL similar to:

```text
https://your-project.web.app
```

That is the public website URL you can submit for the assignment.

After the first setup, future updates usually only require:

```bash
npm run build
firebase deploy --only hosting
```

You do **not** need to run `firebase init hosting` every time.

---

# Final project structure

```text
YOUR PROJECT
│
├── index.html
│      DO NOT ADD FIREBASE CODE HERE
│
├── src/
│   │
│   ├── main.jsx
│   │      NO FIREBASE CHANGES REQUIRED
│   │
│   ├── firebase.js
│   │      Firebase config
│   │      initializeApp()
│   │      auth
│   │      db
│   │      storage
│   │
│   └── App.jsx
│          login()
│          logout()
│          saveConfig()
│          loadConfig()
│          LOGIN button
│          LOGOUT button
│          SAVE button
│          LOAD button
│
└── Terminal
       npm install firebase
       npm run dev
       npm run build
       firebase login
       firebase init hosting
       firebase deploy --only hosting
```

# What happens every time you reopen the project?

For normal local development:

```bash
npm run dev
```

Firebase connects automatically through `src/firebase.js`.

You do **not** need to reinstall Firebase or re-enable Authentication/Firestore every time.

When you want to update the public website:

```bash
npm run build
firebase deploy --only hosting
```

# Minimum assignment checklist

```text
Firebase project created ✅
Google Authentication ✅
Firestore ✅
Save Configuration ✅
Load Configuration ✅
Data linked to logged-in user ✅
Storage ⏸ optional / come back later
Firebase Hosting ✅
Public website URL ✅
```
