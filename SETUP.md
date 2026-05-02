# Compliance Pal — Setup & Packaging

A Tauri-wrapped Vite + React app. Runs natively on macOS as a `.app` bundle.

## One-time setup

### 1. Install Rust (required for Tauri builds only)

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Accept the default options. After it finishes, open a new terminal (or run `source "$HOME/.cargo/env"`) so `cargo` is on your PATH. Verify with:

```bash
cargo --version   # should print something like: cargo 1.8x.x
```

If you don't already have Xcode Command Line Tools (you probably do):

```bash
xcode-select --install
```

### 2. Install npm dependencies

```bash
npm install
```

That's it. Rust is a one-off; you won't think about it again unless you run `rustup update` every few months.

## Day-to-day development

Two equivalent options — pick whichever you prefer:

### Option A — Browser dev (fastest iteration)

```bash
npm run dev
```

Opens Vite on <http://localhost:5180>. Hot reload, DevTools, everything you're used to. Data lives in the **browser's** localStorage.

### Option B — Native Tauri dev window

```bash
npm run tauri:dev
```

Starts Vite **and** opens a native Compliance Pal window pointing at it. Same hot reload, but you're testing in the actual WebKit WebView that ships in the release build. Data lives in the **Tauri app's** localStorage (separate from the browser).

First invocation of `tauri:dev` takes 2–5 minutes because Rust compiles all the Tauri crates. Subsequent runs are a few seconds.

## Building the distributable `.app`

```bash
npm run tauri:build
```

Produces:

- `src-tauri/target/release/bundle/macos/Compliance Pal.app`
- `src-tauri/target/release/bundle/dmg/Compliance Pal_0.1.0_aarch64.dmg`

Drag the `.app` into `/Applications` (or just double-click the `.dmg`). Because it's unsigned, the first launch needs **right-click → Open** → confirm the "unidentified developer" prompt. Once. From then on it opens normally from Spotlight or the Dock.

**First build takes ~5–8 minutes** (compiles Rust dependencies from scratch). Rebuilds are ~30 seconds.

## Data storage

All Compliance Pal data lives in **localStorage**, keyed with the `clause-control:` prefix. The storage location depends on how the app is running:

| Mode                                | Storage location                                                      |
|-------------------------------------|------------------------------------------------------------------------|
| `npm run dev` (browser)             | Your browser's localStorage for `http://localhost:5180`                |
| `npm run tauri:dev` / packaged app  | `~/Library/WebKit/com.compliancepal.app/WebsiteData/LocalStorage/`     |

**Data persists across:** closing the app, shutting down, rebooting, macOS updates, reinstalling a new build of Compliance Pal (bundle-id-keyed).

**Data is wiped by:** clearing browser data (browser mode only), deleting the WebKit data folder manually, or clicking "Clear site data" in DevTools.

### Moving data between modes

Use the **Settings menu** (gear icon, top right):

- **Export backup** → downloads a `compliance-pal-backup-YYYY-MM-DD.json` file containing every project, cheatsheet, saved item and setting.
- **Import backup** → upload that JSON file into any other instance (dev browser, dev tauri window, installed app). Overwrites any matching keys and reloads.

This is also the recommended way to migrate data from your dev browser into the packaged `.app` the first time you build it.

## Making future edits

Your workflow is unchanged — the Tauri wrapper is just a packaging layer:

1. `npm run tauri:dev` (or `npm run dev`) — edit source in `src/`, hot reload in the native window
2. When happy, `npm run tauri:build` — produces a new `.app`
3. Drag the new `.app` over the old one in `/Applications`
4. Your saved data is preserved because storage is keyed to the bundle ID

Tauri-specific files live in `src-tauri/` (Rust code, config, icons) and you rarely need to touch them. The only time you'd edit `src-tauri/tauri.conf.json` is to bump the version number, change the window size, or update the app identifier.

## Project layout

```
clause-and-control/
├── src/                    # React + Vite source (your normal workspace)
│   ├── components/
│   ├── data/
│   ├── hooks/
│   ├── utils/
│   │   └── backup.ts       # Export/import helpers
│   └── ...
├── public/
│   └── favicon.svg
├── src-tauri/              # Tauri shell (Rust)
│   ├── Cargo.toml          # Rust dependencies
│   ├── tauri.conf.json     # App config (name, window, bundle id, icons)
│   ├── src/
│   │   ├── main.rs         # Tauri entry point
│   │   └── lib.rs
│   ├── capabilities/       # Tauri v2 permissions
│   ├── icons/              # All icon sizes (generated from favicon.svg)
│   └── target/             # Build output (gitignored)
└── package.json
```

## Troubleshooting

**`tauri dev` says port 5180 is already in use.**
Another Vite dev server is running. Stop it with `lsof -ti:5180 | xargs kill -9`.

**First `tauri build` fails with a linker error.**
Run `xcode-select --install` and try again.

**"Compliance Pal can't be opened because the developer cannot be verified."**
Right-click the `.app` → Open → confirm. macOS will remember your choice.

**Data doesn't appear in the packaged app after my first build.**
Expected — browser localStorage and the Tauri app's WebKit localStorage are separate. Use **Settings → Export backup** in the browser, then **Settings → Import backup** in the packaged app.

---

# Auto-Updater Setup (V2.1+)

The app is wired up to auto-update from GitHub Releases. **You only need to do this setup once.** After that, every release is `git tag` + `git push`, and existing installs pick up the update on next launch.

## What you have now

- `tauri-plugin-updater` and `tauri-plugin-process` registered in the Rust app
- `bundle.createUpdaterArtifacts: true` in `tauri.conf.json` (build emits signed `.tar.gz` / `.zip` alongside the `.dmg`/`.msi`)
- `plugins.updater.endpoints` pointing at `https://github.com/gwylio-jb/post-watch/releases/latest/download/latest.json`
- `pubkey: "REPLACE_ME_WITH_PUBLIC_KEY_FROM_TAURI_SIGNER_GENERATE"` placeholder — you'll fill this in at Step 1
- `<UpdatePrompt />` mounted in `App.tsx` — checks for updates 3 seconds after launch and shows a corner toast if one is available
- `.github/workflows/release.yml` — builds for Mac (Intel + Apple Silicon) + Windows whenever you push a `v*` tag

## What you need to do (one-time)

### Step 1 — Generate your signing keypair

This is an Ed25519 keypair. The **public** half goes into `tauri.conf.json` (committed to the repo). The **private** half stays on your machine and goes into a GitHub secret. Run this in a terminal at the project root:

```bash
npm run tauri signer generate -- --write-keys ~/.tauri/post-watch.key
```

You'll be prompted for a password — pick a strong one and **save it in your password manager**, you'll need it again at Step 5.

The command prints the public key to your terminal. Copy that string (it's a long base64 blob), then open `src-tauri/tauri.conf.json` and replace `REPLACE_ME_WITH_PUBLIC_KEY_FROM_TAURI_SIGNER_GENERATE` with it.

### Step 2 — Create the GitHub repo

1. Go to https://github.com/new
2. Repo name: `post-watch` (or whatever you like — but if you change it, also change the URL in `tauri.conf.json` → `plugins.updater.endpoints`)
3. Owner: your account (`gwylio` if that's what we assumed; change the URL if not)
4. Visibility: **Public** (private works but adds auth complexity to the manifest URL)
5. Don't initialise with a README — we'll push existing code

### Step 3 — Push your code

In your terminal, at the project root:

```bash
git remote add origin https://github.com/<your-username>/post-watch.git
git branch -M main
git push -u origin main
```

(I've already run `git init` + made an initial commit — you just need to add the remote and push.)

### Step 4 — Add the GitHub secrets

In the GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**.

Add **two** secrets:

| Name | Value |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | The **literal file content** of `~/.tauri/post-watch.key`. The file is already stored base64-encoded on disk — don't re-encode it. Run `cat ~/.tauri/post-watch.key \| pbcopy` and paste. If you double-encode (e.g. via `base64 -i ...`), the CI signing step fails with "Missing encoded key in secret key" because it decodes once and gets a still-base64 blob it can't parse. |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | The password you set in Step 1 |

### Step 5 — Cut the first release

```bash
git tag v2.1.0
git push --tags
```

This kicks off `release.yml`. Watch it run at: `https://github.com/<your-username>/post-watch/actions`.

It takes ~10–15 minutes (it builds for Mac Intel + Apple Silicon + Windows and signs each artefact). When it's done, you'll see a new release at `https://github.com/<your-username>/post-watch/releases/tag/v2.1.0` with `.dmg`, `.msi`, signed `.tar.gz` / `.zip` files, and a `latest.json` manifest.

### Step 6 — Verify

1. Download the v2.1.0 `.dmg` from the Release page and install it. (This first install has to be manual; after this, the auto-updater takes over.)
2. Bump the version in `src-tauri/tauri.conf.json` from `2.1.0` to `2.1.1`.
3. Commit + push, then `git tag v2.1.1 && git push --tags`. Wait for the Action to finish.
4. Re-launch the v2.1.0 app you installed. After ~3 seconds, a corner toast should appear: **"Update available: v2.1.1 — Install & restart"**. Click it. The app downloads, verifies the signature, installs, and relaunches as v2.1.1.

If that works end-to-end, the auto-updater is fully operational. From now on, shipping is just:

```bash
# 1. Bump version in src-tauri/tauri.conf.json
# 2. Commit the bump
git tag v2.1.2 && git push --tags
# 3. Wait ~10 min, your beta users get the update on next launch
```

## Caveats / known limitations

- **macOS Gatekeeper warning.** Your beta users will see "Post_Watch is from an unidentified developer" on first install (because we're not yet code-signing with an Apple Developer ID). They can right-click → Open to bypass. The auto-updater itself works without code signing — Gatekeeper only checks on first launch from a fresh install. Cost to remove the warning: $99/year for an Apple Developer ID + about half a day of plumbing.
- **Windows SmartScreen warning.** Same story — $200-ish/year for a code-signing certificate from DigiCert/Sectigo.
- **First release must be manual.** Auto-updater can't replace an app that isn't installed. The chicken-and-egg only applies to v2.1.0 — every release after that updates in place.
- **Don't lose the private key.** If you do, every existing install becomes orphaned (it'll reject signed updates from a new key). You'd have to ask users to download a fresh `.dmg` once. Back the key up to your password manager **and** an offline copy.
