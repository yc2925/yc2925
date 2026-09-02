# Git and GitHub for Complete Beginners

This tutorial is for people who have never used Git or GitHub. You will learn what they are, install Git, and practice the everyday workflow: save your work, put it on GitHub, and get updates.

You do not need to memorize everything. Follow the steps once. The same few commands show up again and again.

---

## What are Git and GitHub?

**Git** is a program on your computer. It keeps a history of your files: what changed, when, and why. You can go back to an older version if something breaks.

**GitHub** is a website that stores a copy of that history online. You use it to back up your work, share it, and work with other people.

A simple picture:

```
Your computer (Git)  <---->  GitHub (online copy)
```

Think of Git as “save points in a video game” and GitHub as “the cloud save that other people can also see.”

---

## Words you will see a lot

| Word | Meaning in plain English |
| --- | --- |
| **Repository** (or **repo**) | A project folder that Git is tracking |
| **Commit** | A save point: a snapshot of your files plus a short message |
| **Branch** | A separate line of work so you can try something without breaking the main version |
| **Main** (sometimes `master`) | The default branch; usually the “official” version |
| **Remote** | A copy of the repo somewhere else, almost always GitHub |
| **Clone** | Download a GitHub repo onto your computer |
| **Push** | Send your new commits from your computer to GitHub |
| **Pull** | Download new commits from GitHub onto your computer |
| **Pull request** (or **PR**) | A request to merge your branch into another branch (usually `main`) after someone reviews it |

---

## 1. Install Git

### macOS

Open **Terminal** and run:

```bash
git --version
```

If Git is not installed, macOS may offer to install command-line tools. Accept that, or install Git from [https://git-scm.com/downloads](https://git-scm.com/downloads).

### Windows

Download and install Git from [https://git-scm.com/downloads](https://git-scm.com/downloads). Use the defaults. Afterward, use **Git Bash** (installed with Git) instead of Command Prompt.

### Check that it worked

```bash
git --version
```

You should see something like `git version 2.x.x`.

---

## 2. Tell Git who you are

Do this once on a new computer. Git attaches your name and email to every commit.

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

Use the same email as your GitHub account if you have one (you will create one in the next section).

Check the settings:

```bash
git config --global --list
```

---

## 3. Create a GitHub account

1. Go to [https://github.com](https://github.com) and sign up.
2. Pick a username you are okay seeing in public (it appears in URLs).
3. Verify your email.

GitHub is free for public and private repositories.

### How you will sign in from the terminal

GitHub no longer accepts your account password for `git push`. Use one of these:

- **GitHub Desktop** (easiest for many beginners): [https://desktop.github.com](https://desktop.github.com)
- **HTTPS + a Personal Access Token** when Git asks for a password
- **SSH keys** (a bit more setup; good once you are comfortable)

This tutorial uses the command line so you see what Git is doing. GitHub Desktop is fine if you prefer buttons.

---

## 4. Your first repository (two ways)

You can start on your computer and then put it on GitHub, or start on GitHub and download it. Both are common.

### Way A: Start on your computer

1. Make a folder and go into it:

```bash
mkdir my-first-repo
cd my-first-repo
```

2. Turn the folder into a Git repo:

```bash
git init
```

3. Create a file, for example `README.md`, and write a sentence in it.

4. See what Git notices:

```bash
git status
```

New files show as **untracked**. That means Git sees them but is not saving them yet.

5. Stage the file (tell Git “include this in the next save”):

```bash
git add README.md
```

To stage everything in the folder:

```bash
git add .
```

6. Commit (create the save point):

```bash
git commit -m "Add a short README"
```

The text in quotes is the **commit message**. Write what you did, in the present tense, like “Add README” or “Fix typo in title.”

### Way B: Start on GitHub

1. On GitHub, click **New repository**.
2. Give it a name, choose Public or Private, and optionally add a README.
3. Click **Create repository**.
4. Copy the HTTPS URL (looks like `https://github.com/yourname/my-first-repo.git`).
5. On your computer:

```bash
git clone https://github.com/yourname/my-first-repo.git
cd my-first-repo
```

Now you have a local copy that already knows about GitHub (`origin` is the usual name for that remote).

---

## 5. The everyday loop

Almost all daily Git work is this loop:

1. Change files
2. `git status` — see what changed
3. `git add` — choose what to include
4. `git commit` — save a snapshot
5. `git push` — upload to GitHub
6. `git pull` — download other people’s (or your other computer’s) snapshots

### Useful commands

See a summary of commits:

```bash
git log --oneline
```

See the difference you have not staged yet:

```bash
git diff
```

See the difference you have staged:

```bash
git diff --staged
```

Undo **unstaged** edits in a file (this throws away those edits in the working copy):

```bash
git restore filename
```

Unstage a file (keep the edits, but do not include them in the next commit):

```bash
git restore --staged filename
```

---

## 6. Connect a local repo to GitHub (Way A, continued)

If you used `git init` locally and want GitHub to store it:

1. Create an **empty** repository on GitHub (do not add a README if your computer already has commits; that avoids a messy first merge).
2. On your computer:

```bash
git remote add origin https://github.com/yourname/my-first-repo.git
git branch -M main
git push -u origin main
```

- `origin` is a nickname for the GitHub URL.
- `-u` remembers that `main` should push/pull to `origin/main`. Later you can just run `git push` and `git pull`.

Refresh the GitHub page. Your files should appear.

---

## 7. Branches (try ideas safely)

`main` is your stable line. A **branch** is a copy of history you can change without touching `main` until you are ready.

```bash
git branch              # list branches
git switch -c feature   # create and switch to a new branch named feature
```

Make commits on `feature`. When you are done:

```bash
git switch main
git merge feature
```

Or, on GitHub, push the branch and open a **pull request** (next section).

```bash
git push -u origin feature
```

Switch back to an existing branch:

```bash
git switch main
```

---

## 8. Pull requests on GitHub (working with others)

A **pull request** is not a Git command. It is a GitHub page that says: “Please take the commits on my branch and put them into `main`.”

Typical flow:

1. Create a branch and commit your work.
2. `git push -u origin your-branch-name`
3. On GitHub, open a **Pull request**.
4. Write a short description of what changed and why.
5. Someone reviews it (or you review your own on a small project).
6. Click **Merge**.
7. On your computer, update `main`:

```bash
git switch main
git pull
```

You can delete the feature branch after it is merged.

---

## 9. `.gitignore`

Some files should never be committed: secrets, huge downloads, editor junk.

Create a file named `.gitignore` in the repo root. Example:

```
.DS_Store
.env
node_modules/
```

Commit `.gitignore` like any other file. Git will skip matching paths after that.

**Never commit passwords, API keys, or `.env` files with secrets.** If you already did, change those secrets; deleting the file later does not remove them from history.

---

## 10. A tiny cheat sheet

```bash
git status
git add .
git commit -m "Describe the change"
git pull
git push

git switch -c my-branch
git switch main
git merge my-branch

git clone https://github.com/someone/some-repo.git
git log --oneline
```

---

## Common beginner problems

**“I committed to the wrong branch.”**  
Switch to the right branch and cherry-pick or redo the commit. If you have not pushed yet, you can often move the commit with help from a teammate or a search for `git cherry-pick`. Do not rewrite history that other people already pulled.

**“Git says my branch has diverged.”**  
Someone (or you, on another machine) pushed commits you do not have. Run `git pull`, fix any merge conflicts in the files Git lists, then `git add` those files and `git commit`. Then `git push`.

**“Merge conflict.”**  
Two people changed the same lines. Git inserts markers like `<<<<<<<` in the file. Edit the file to the version you want, delete the markers, then `git add` and `git commit`.

**“Permission denied” or login failed.**  
You are not signed in the way GitHub expects. Use GitHub Desktop, a Personal Access Token, or SSH. Do not use your GitHub website password as the Git password.

**“I cloned the wrong folder / I am in the wrong directory.”**  
`cd` into the folder that contains a hidden `.git` directory. `git status` only works inside a repo.

---

## What to practice

Do this once on a throwaway repo:

1. Create a GitHub account and a new repository.
2. Clone it (or init locally and push).
3. Edit `README.md`, `git add`, `git commit`, `git push`.
4. On GitHub, confirm the change.
5. Create a branch, make another commit, push, open a pull request, merge it.
6. `git switch main` and `git pull`.

When that feels familiar, you know enough Git and GitHub to work on a real project. Everything else is extra tools on top of this same loop.
