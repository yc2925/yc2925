# Installing and Running React in This Project

This guide is for people who are new to React **and** new to the command line. You will install the tools you need, create a React app inside this repository (`yc2925`), and open it in your browser.

You do not need to understand React yet. After the app is running, you can follow [React.md](./React.md) to learn how the code works.

---

## What you will use

| Word | Meaning in plain English |
| --- | --- |
| **Terminal** | A window where you type commands instead of clicking buttons |
| **Command** | A short instruction you type, then press Enter |
| **Folder / directory** | A place that holds files. `cd` means “go into this folder” |
| **Node.js** | A program that lets your computer run JavaScript outside the browser |
| **npm** | Comes with Node. It installs libraries (including React) |
| **Vite** | A tool that creates and runs a React project while you develop |
| **localhost** | Your own computer acting as a tiny website, only you can see it |

---

## 0. Open the terminal

On a Mac:

1. Press `Command + Space` to open Spotlight.
2. Type `Terminal` and press Enter.

You should see a window with a blinking cursor. That is where you type commands.

**Tips**

- Type one command at a time, then press **Enter**.
- Copy and paste is fine. Do not add extra spaces at the start of a line.
- If a command asks a question, read it. You can usually press Enter to accept the default.
- To stop a running program (like the React server), click the terminal and press `Control + C`.

---

## 1. Install Node.js

React needs Node.js. npm is included with it.

1. Open [https://nodejs.org](https://nodejs.org) in your browser.
2. Download the **LTS** version (the one recommended for most people).
3. Run the installer and click through with the defaults.
4. **Quit and reopen Terminal** so it can find Node.

Check that it worked:

```bash
node -v
npm -v
```

You should see version numbers, for example `v22.x.x` and `10.x.x`. If you see `command not found`, Node is not installed yet, or Terminal was not restarted.

---

## 2. Go to this project folder

This repository lives on your computer. You need to be **inside** it before you create the React app.

If you cloned it to the usual GitHub folder on a Mac:

```bash
cd ~/Documents/GitHub/yc2925
```

`cd` means “change directory” (go into this folder). `~` means your home folder.

Confirm you are in the right place:

```bash
pwd
ls
```

- `pwd` prints the folder you are in. It should end with `yc2925`.
- `ls` lists files. You should see `Docs` and `README.md`.

If `cd` says “No such file or directory”, the project is somewhere else. In Finder, open the `yc2925` folder, then drag that folder onto the Terminal window after typing `cd ` (with a space) and press Enter.

---

## 3. Create the React app

This project is mostly docs right now. We will put the React app in a folder named `app` so it stays separate from `Docs`.

Still inside `yc2925`, run:

```bash
npm create vite@latest app -- --template react
```

If it asks to install a package (`create-vite`), type `y` and press Enter.

Then:

```bash
cd app
npm install
```

What those commands do:

1. `npm create vite@latest app -- --template react` — creates a new React project in a folder called `app`
2. `cd app` — go into that folder
3. `npm install` — downloads React and other files into `app/node_modules/`

The first `npm install` can take a minute. Wait until you see the prompt again (a line ending with `$` or `%`).

---

## 4. Run the app

From inside the `app` folder:

```bash
npm run dev
```

The terminal should print something like:

```text
  VITE v7.x.x  ready in 200 ms

  ➜  Local:   http://localhost:5173/
```

Open that URL in your browser (often `http://localhost:5173`). You should see the default Vite + React page.

**Leave this terminal running** while you work. If you close it or press `Control + C`, the site stops.

If the browser does not open by itself, copy the `http://localhost:...` address and paste it into Chrome, Safari, or Firefox.

---

## 5. Check that it is working

1. Keep `npm run dev` running.
2. In Cursor (or another editor), open `app/src/App.jsx`.
3. Find some text on the page (for example the word `Vite`) and change it.
4. Save the file (`Command + S`).
5. Look at the browser. The page should update without a refresh.

If it updates, React is installed and running in this project.

---

## Everyday commands after the first setup

You only create the app once. Next time you want to work:

```bash
cd ~/Documents/GitHub/yc2925/app
npm run dev
```

Then open `http://localhost:5173` again.

If you ever delete `node_modules` or clone the repo on a new computer:

```bash
cd ~/Documents/GitHub/yc2925/app
npm install
npm run dev
```

Stop the server: click the terminal, then `Control + C`.

---

## If something goes wrong

| What you see | What to try |
| --- | --- |
| `command not found: node` or `npm` | Install Node from [nodejs.org](https://nodejs.org), then quit and reopen Terminal |
| `cd: no such file or directory` | You are in the wrong folder. Use `pwd` and `ls`, or drag the folder from Finder |
| Prompt asks “Ok to proceed?” | Type `y` and press Enter |
| Port 5173 is already in use | Vite will suggest another URL, like `http://localhost:5174`. Use that one |
| `npm install` errors about permissions | Do not use `sudo`. Reinstall Node from nodejs.org instead |
| Page is blank | Make sure `npm run dev` is still running and you opened the URL it printed |

---

## What not to worry about yet

- You do **not** need to understand every file Vite created.
- Do **not** commit the `node_modules` folder. Vite already adds it to `.gitignore`.
- This tutorial only starts the app. How to write components, props, and state is in [React.md](./React.md).
