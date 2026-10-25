# Unfold

Project by Teri Kolman 66 · #TeriKolman66

Version 1.0.0 — first public source release. This is an early local-first version; the replay feature is still beta.

Unfold is a private, local-first canvas for arranging **clues**: notes, photos, and files. Every clue can be titled, annotated, moved freely, and connected to another clue.

## Current MVP

- Pure black, distraction-free infinite canvas
- Empty spaces with no automatic questions or generated content
- Note clues with a title and freeform text
- Photo clues that display the uploaded image directly on the canvas
- File clues for any file type, embedded inside the portable workspace
- Location clues with a place name, address or coordinates, a saved Google Maps link, and optional embedded photos
- Location cards show a real OpenStreetMap preview. Entering a place name or address performs one online lookup to find its coordinates; a Google Maps link with embedded coordinates or manual coordinates works without lookup
- Old locations with a short Google Maps link and no coordinates show **Find map** on the card; it searches using the card title and replaces the placeholder in place. The original short link is kept under a single **Open in Maps** link
- The location editor can retry **Find on map**, search nearby Wikimedia Commons images with **Find photos**, or use **Add your own**. Commons results require a deliberate selection and keep their author, license, and source in the portable workspace
- Optional note attached to every photo or file
- Free dragging, pan, wheel zoom, touchpad navigation, and fit-all
- Curved parent and relationship connections with one moving border port per endpoint
- Click a connection and press `Backspace` to detach it
- Per-clue colors with a subtle matching glow; reuse the last chosen color on another selected clue with `C`
- Autosave, native Save As/Open dialogs, and portable `.unfold` JSON files
- Workspace creation, rename, duplicate, and delete
- Scrollable home screen with a saved three- or six-column workspace layout preference; use arrow keys, Page Up/Down, Home, and End without a mouse
- Duplicated workspaces are brought into view and retain their manual connections
- A subtle lift and shadow animation while dragging clues, with connections following their positions
- Independent canvas selection and right-side editing: click once to select, click again to deselect, then press `Enter` to open that clue in the editor
- Pinnable editor panel; when unpinned, selecting a clue does not replace or open the current editor
- A keyboard-shortcuts button beside Save and Pin in the editor toolbar
- Import choice: open a `.unfold` file immediately or replay its surviving additions in Chronology Beta (items, links, and Location photos)

## Keyboard workflow

| Key | Action |
| --- | --- |
| `↑` | Zoom in |
| `↓` | Zoom out |
| `←` / `→` | Move through map and photos in the selected Location card only |
| `Enter` | Open the selected clue in the right-side editor |
| `Space` | Start a white parent connection; then select the second clue |
| `Shift+Space` | Start a red relationship connection; then select the second clue |
| `C` | Apply the last selected card color to the selected clue |
| `Backspace` | Immediately remove the selected clue and its connections |
| `Delete` | Remove the selected clue with confirmation |
| `Escape` | Deselect and cancel connection mode |
| `F` | Fit all clues on screen |
| `Ctrl+S` | Save |
| `Ctrl+Shift+S` | Save As |
| `Ctrl+O` | Open a `.unfold` workspace |
| `Ctrl+N` | New space |

Shortcuts are not intercepted while typing.

## Run your own local copy

Download the source ZIP from GitHub, extract it anywhere on your Windows PC, and install Node.js if you do not already have it. Then double-click `Start-Unfold.cmd` in the extracted folder. On the first run, the launcher offers to install dependencies with `npm ci` (internet is needed for that one-time download). Choose **1** to keep the server attached to CMD or **2** to leave it running after CMD closes. Open <http://localhost:1420> in your browser. Run the launcher again and choose **3** to stop the server. Later launches work offline if the dependencies are already installed.

Alternatively, open CMD or PowerShell inside the extracted folder and run:

```powershell
npm ci
npm run dev
```

The local server is bound to your own computer. Other people cannot access your `localhost`; each person runs their own copy. Browser workspaces are stored in that browser's local storage and IndexedDB, not uploaded to a server. Export important workspaces as `.unfold` files for backup or to move them to another browser or PC. Clearing site data can erase browser-only workspaces. The background option survives closing CMD, but not a computer restart. Closing a browser tab does not stop the server.

Place-name lookup is the one optional online action: the place text is sent to OpenStreetMap's public Nominatim service when you add a Location or click **Find on map**. Results are cached locally and the coordinates are stored in the `.unfold` file. Map tiles also need internet; the rest of Unfold works offline. The public service has a strict [usage policy](https://operations.osmfoundation.org/policies/nominatim/) (including a maximum of one request per second across an application), so this default is intended only for modest personal use, not a large public deployment. An installation can change the lookup endpoint via the `unfold:geocoder-url` local-storage preference without updating the app; a higher-volume release should use its own geocoder or provider. Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).

**Find photos** sends the point or place name to Wikimedia Commons and shows candidate photos. Nearby matches are not guaranteed to depict the exact place; inspect the image and source before adding. Selected 640px thumbnails are embedded in `.unfold` for offline reopening, with source and attribution metadata. Your own photos never need the Commons search.

## Tests and production frontend

```powershell
npm test
npm run build
```

The interaction smoke test in `scripts/ui-smoke.mjs` verifies notes, visible photos, generic files, manual connections, keyboard editing/deletion/zoom, and autosave.

## Windows desktop build

Install Rust stable and the Visual Studio Build Tools C++/Windows SDK prerequisites, then run:

```powershell
npm run tauri dev
npm run tauri build
```

Windows installer artifacts are written under `src-tauri\target\release\bundle`.

## Local data

`.unfold` documents are readable, versioned JSON. Attached files and images are embedded as data URLs so one workspace file is sufficient to restore the canvas. Desktop autosaves are stored in the operating system application-data directory; the app does not use accounts, cloud storage, telemetry, or a backend.
