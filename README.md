# Calc - a personal calculator (installable app)

Black dark-mode calculator with blue/white keys. Works offline once installed.
Portrait = simple keypad. Turn the phone sideways = scientific keys.

## Try it on a computer
    cd calculator
    python3 -m http.server 8000      # then open http://localhost:8000

## Put it on a phone (Android, Chrome)
The phone needs to open it from an https:// address once. Easiest free ways:
1. **GitHub Pages**: put this folder in a GitHub repo (GitHub Desktop works), then
   repo Settings -> Pages -> Deploy from branch (main, root). You get https://yourname.github.io/repo/
2. **Cloudflare Pages / Netlify**: drag-drop the folder, get an https link.
3. **Your VPS**: serve the folder with Caddy or nginx on a domain with https.

Then open the link in Chrome on the phone -> menu (three dots) -> **Install app** / **Add to Home screen**.
It now opens full-screen like a normal app and works with no internet.

## Updating later
Change files, re-publish, and **bump `VERSION` in sw.js** (calc-v1 -> calc-v2). Open the app twice
(first open downloads the update, second shows it).

## Make a version for someone else (e.g. your girlfriend)
1. Copy the whole folder.
2. Edit **config.js**: `name`, `theme` colors, `features`, `tools`, `photo`, `photoCorner`, `greeting`.
3. Replace the picture: drop her photo in as `profile.jpg` (or change the file name in config.js).
   She can also change it herself in the app: tap the picture -> Change.
4. In **manifest.json** change `name` / `short_name` (the label under the home-screen icon),
   and in **index.html** the `<title>`. Swap the icons in `icons/` if you want a different look.
5. Publish it at its own link (a second GitHub repo/Pages site).

## Files
- config.js    - everything you'd want to customize
- engine.js    - the math (exact fractions, percent rules, scientific functions); tests: `node tests/engine.test.js`
- app.js       - main calculator screen
- tools.js     - Tools menu (converter, tip split, percent, dates, hex/bin, your own formulas)
- styles.css   - look and layout
- sw.js, manifest.json, icons/ - make it installable and offline

## Notes
- "Mine" tab: the delivery formula is in config.js (mileage rate default 0.70 - update it to the current IRS rate).
  Add your own formulas inside the app with "+ New formula" (stored on that phone only).
- History, memory, settings and custom formulas are stored on each phone (not synced between devices).
- Haptics (vibration) works on Android Chrome; shake-to-clear needs a phone with motion sensors.
