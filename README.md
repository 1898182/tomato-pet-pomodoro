# Tomato Pet Pomodoro

Tomato Pet Pomodoro is a local-first desktop focus timer built around a small floating companion. The tomato pet stays above normal windows, changes appearance with the timer, and exposes a compact timer bubble without requiring the full settings window to remain open.

The current v1 includes one tomato-headed pet with three states:

- **Sleeping** while the timer is idle or paused
- **Working** during a focus session
- **Playing** during short and long breaks

Completed focus time earns permanent Lifetime XP and spendable Seeds. The focus-chain multiplier increases every 25 completed focus minutes, carries through scheduled breaks, and resets on interruption; it stacks with daily streaks. Independent daily caps encourage sustainable sessions. Timer state, XP, Seeds, sessions, settings, tasks, and avatar position are stored locally in SQLite.

## Technology

- **Electron** for the desktop process, transparent avatar window, tray menu, notifications, startup behavior, and packaging
- **TypeScript** across the main process, preload bridge, shared contracts, and renderer
- **React** for the avatar controls and settings interface
- **PixiJS** for rendering the pet from its sprite sheet
- **Vite** for the renderer development server and production bundle
- **sql.js / SQLite** for local persistence without a native database dependency
- **Vitest** for unit tests
- **electron-builder** for Windows, macOS, and Linux installers
- **Pillow** only for regenerating the included placeholder tomato artwork

## First-Time Setup

### Prerequisites

Install the following tools:

- [Node.js](https://nodejs.org/) 22 LTS (recommended)
- [pnpm](https://pnpm.io/) 11
- Git, if the project is being cloned
- Python 3 and Pillow only if you intend to regenerate the bundled tomato sprites

Enable pnpm through Corepack when it is available:

```powershell
corepack enable
corepack prepare pnpm@11.19.0 --activate
```

Alternatively, install the matching pnpm version globally:

```powershell
npm install --global pnpm@11.19.0
```

### Install and Run

From the project directory:

```powershell
pnpm install
pnpm dev
```

On the first install, pnpm may ask which dependency build scripts are allowed. Approve `electron`, `electron-winstaller`, and `esbuild`; Electron cannot start until its platform binary has been downloaded.

The development command compiles the Electron main process, builds the renderer once, starts Vite, and launches the desktop app. Look for the floating tomato and the tomato icon in the system tray/menu bar. Closing the settings window does not quit the app; use **Quit** from the tray menu.

## Using the App

- Click the pet to poke it. During a break, the first poke also awards 5 XP. Double-click the pet to show or hide the timer bubble.
- Use the Play, Pause, and Stop icons in the timer bubble to control a session. Short-break suggestions appear in their own bubble above the timer.
- Drag any non-interactive part of the prompt, timer, or action bubble to reposition the full floating window.
- Drag any non-button area of the floating window to reposition it. The main process keeps it inside the nearest display's usable bounds.
- Open **Settings** from the gear below the pet or the tray menu.
- Use **Quit Tomato Pet** at the bottom of Settings to exit the floating pet and tray process completely.
- The tray menu can start, pause, resume, and stop sessions even when the pet is hidden behind another window.
- After a session completes, the app waits for confirmation before starting the suggested focus or break phase.

## Settings and Local Data

The settings window currently supports:

- Launch at sign-in
- Automatic or manual starts for the next focus/break session
- Native completion notifications
- Operating-system completion sounds
- Read-only accumulated XP and level
- Lifetime XP progress, Seed balance, streak, and daily-cap usage
- Optional stealth mode with a compact corner timer during focus
- Brown-noise or gentle-rain focus audio with remembered volume
- Pet interaction sounds
- Classic, extended, Flow 52, and deep-work session rhythms that can be hidden and restored
- Up to four visible rhythms, including multiple named custom focus cycles
- An in-app FAQ covering pet interaction, settings, progression, and preference transfer
- Copying and importing a preferences-only JSON backup

The default timer preset is the classic `25 / 5 / 15` schedule with a long break after four focus sessions. Built-in rhythms can be hidden, custom rhythms can be created or permanently deleted, and Reset focus cycles restores the original four. Rhythm changes are available while the timer is stopped.

The stealth timer stays fixed at the nearest work-area corner. Hover it or move keyboard focus into it to reveal the compact Pause, Stop, and focus-audio controls without resizing the window. Settings opens at `1095 x 1150` by default while retaining its smaller minimum dimensions for constrained displays.

XP per focused minute, Seed earnings, daily caps, and the ten-minute idle reset are fixed progression rules rather than user settings. The preferences export contains only ordinary settings, selected and hidden built-in rhythms, named custom rhythms, and avatar position. It deliberately excludes XP, Seeds, session history, ledger entries, inventory, and profile progression.

## Progression and Economy

- Each completed focus minute earns 10 base XP and 1 base Seed.
- A completed focus planned for at least 25 minutes adds 50 base XP and 5 base Seeds.
- A completed break adds 50 base XP and 5 base Seeds.
- Lifetime XP determines a permanent level using the polynomial curve `300 * (level - 1)^1.4`, rounded to the nearest 10 XP and capped at Level 50.
- Seeds are a separate future store currency; earning Seeds never lowers Lifetime XP.
- Daily caps are 3,600 XP and 360 Seeds. The Stats tab shows current usage and a 12-week focus heatmap.

The catalog foundation is stored in `public/assets/items/items.json`. It defines prices and level gates for future goodies, but purchasing, cosmetic rendering, and streak-shield consumption are intentionally not active yet.

This protects against casual export editing, but an offline Electron app cannot make a future marketplace tamper-proof: a determined user controls its files and executable. A production economy should move XP awards, purchases, balances, and inventory mutations to an authenticated server-authoritative ledger; the client should submit completed-session evidence and display server-issued results.

The SQLite file is named `tomato-pet.sqlite` and is written under Electron's `app.getPath("userData")` directory. Typical locations are beneath `%APPDATA%` on Windows, `~/Library/Application Support` on macOS, and `~/.config` on Linux. The exact application directory name can differ between development and packaged builds.

## Common Development Commands

```powershell
# Start the app in development mode
pnpm dev

# Run unit tests once
pnpm test

# Type-check renderer, main process, preload, and shared code
pnpm run typecheck

# Create production JavaScript bundles
pnpm run build

# Build an installer/package for the current operating system
pnpm run dist
```

`pnpm run dist` creates output under `release/`. Build each target on its native operating system for the most reliable results: NSIS on Windows, DMG on macOS, and AppImage/deb on Linux.

## Project Structure

```text
public/assets/                  Bundled pet, item, and tray artwork
scripts/                        Development, cleaning, and asset scripts
src/main/main.ts                Electron windows, tray, notifications, and IPC
src/main/preload.ts             Typed, context-isolated renderer bridge
src/main/services/database.ts   SQLite schema, persistence, and data transfer
src/main/services/timerEngine.ts Absolute-time timer and phase transitions
src/renderer/                   React/PixiJS avatar and settings surfaces
src/shared/                     Types and pet-manifest validation
```

The Electron main process owns all privileged functionality and persistent data. Renderer code accesses it only through the typed API exposed as `window.tomatoPet` by the preload script.

## Adding or Replacing an Avatar

The current UI does not include a pet picker, so Tomato is loaded directly by the avatar renderer. A new pet can still be developed with the following workflow:

1. Create `public/assets/pets/<pet-id>/pet.json` and a `sprites/` directory.
2. Provide transparent artwork for `sleeping`, `working`, and `playing`. The Tomato sheet uses two horizontal `512 x 512` frames per state in a `3072 x 512` PNG.
3. Define each state's `frames`, `frameDurationMs`, and sprite-sheet path in the manifest. Use [the Tomato manifest](public/assets/pets/tomato/pet.json) as the reference shape.
4. Add the pet to the database seed or a future pet-catalog migration in `src/main/services/database.ts`.
5. Change the pet id currently requested in `src/renderer/surfaces/AvatarApp.tsx`, or implement selection based on `player_profile.active_pet_id`.
6. Adjust the PixiJS sprite scale and positioning in `AvatarApp.tsx` when the new artwork has a different visual footprint.
7. Run `pnpm test`, `pnpm run typecheck`, and visually check all three timer phases.

`src/shared/petManifest.ts` validates the required manifest fields. Equipment slots such as `head`, `body`, `desk`, and `background` are declared for future cosmetics, but compositing wearable layers is not implemented in v1.

To regenerate the included code-drawn Tomato assets, first install Pillow and then run:

```powershell
python -m pip install Pillow
pnpm run generate:assets
```

The bundled focus soundscapes are generated locally and do not depend on third-party audio licenses:

```powershell
pnpm run generate:audio
```

The generator overwrites the Tomato PNGs in `public/assets/pets/tomato/sprites/` and the tray icon in `public/assets/tray/`, so keep any custom art under a different pet id.

## Testing Short Timer Cycles

For quick end-to-end testing, hide one built-in rhythm and create a named custom rhythm with a `1` minute focus. The current schema stores durations as whole minutes, so sub-minute cycles require a temporary code change in `getPhaseDurationSeconds()` in `src/shared/timerPresets.ts`.

Useful cases to exercise:

- Complete a focus session and confirm XP, notification, and next-break prompt.
- Confirm XP and Seeds stop at their independent local-day caps.
- Enable stealth mode, start focus, and confirm the compact timer appears at the nearest display's bottom-right work area.
- Switch focus audio between brown noise and gentle rain and confirm it stops outside focus.
- Open Stats and verify the completed session appears in the current week and heatmap.
- Pause and resume focus, confirming the multiplier returns to `1.00`.
- Temporarily lower `IDLE_RESET_MINUTES` in `src/main/services/progressionRules.ts`, begin a focus or break session, leave the OS idle, and confirm the active timer pauses and resumes into the same phase.
- Complete four focus sessions and confirm the next prompt is a long break.
- Move the avatar between displays, restart the app, and confirm its saved position remains on-screen.
- Hide or close visible windows and confirm the tray menu remains available.
- Export preferences, change a harmless setting, import the export, and confirm the setting is restored without changing XP.

## Debugging

### Electron does not launch after installation

Run:

```powershell
pnpm approve-builds
pnpm rebuild electron
pnpm dev
```

Approve Electron and esbuild when prompted. If the Electron download failed because of a proxy or firewall, verify access to the package registry and Electron release downloads, then reinstall dependencies.

### Port 5173 is already in use

The Vite development server currently requests port `5173`. Stop the process using that port or change `server.port` in `vite.config.ts`.

On Windows, identify the process with:

```powershell
Get-NetTCPConnection -LocalPort 5173 | Select-Object LocalAddress, LocalPort, OwningProcess
```

### The pet is blank or the wrong state is shown

- Open renderer developer tools with `Ctrl+Shift+I` on Windows/Linux or `Cmd+Option+I` on macOS while the avatar window is focused.
- Check the Console for a failed `assets:get-pet` IPC request or PixiJS texture error.
- Confirm frame coordinates stay inside the PNG dimensions.
- Run `pnpm test` to check manifest validation.
- Confirm the manifest defines all three exact state names: `sleeping`, `working`, and `playing`.

### Resetting local development data

Quit the app from its tray menu, locate `tomato-pet.sqlite` under the Electron user-data directory, make a backup if needed, and remove that single file. The app recreates the schema and defaults the next time it starts. Development and packaged builds may use differently named user-data folders, so confirm the file path before deleting anything.

### Inspecting the database

The persisted file is a standard SQLite database and can be opened with a SQLite browser or CLI while the app is closed. Useful tables include `timer_state`, `sessions`, `xp_ledger`, `player_profile`, `timer_presets`, and `settings`. Avoid editing `player_profile.total_xp` independently of `xp_ledger`; the ledger is intended to be the source of truth.

### Settings appear not to persist

Check terminal output for filesystem errors and verify that the user-data directory is writable. The database is flushed after settings, timer, XP, and avatar-position updates. If a manual database edit is required, quit the app first so its in-memory database does not overwrite the external change on shutdown.

## Current Scope

This repository is an early functional v1. It has one pet, local XP and Seeds, progression analytics, local persistence, session controls, notifications, focus audio, and cross-platform packaging configuration. Store purchasing, cosmetic equipment rendering, account login, cloud sync, and app/site activity tracking remain outside the current implementation.
