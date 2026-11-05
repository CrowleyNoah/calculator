/* ==================================================================
   config.js  -  THE ONLY FILE YOU NEED TO EDIT to make a new version
   (for example one for your girlfriend). Change a value, save,
   re-publish, done.  Every setting has a comment next to it.
================================================================== */
window.CALC_CONFIG = {

  /* ---- who is this calculator for? ---- */
  name: 'Noah',                    // shown in the greeting (and as the letter when there's no photo)
  appTitle: 'Calc',                // name under the icon needs manifest.json too (see README)

  /* ---- greeting ----
     'timeOfDay' -> "Good evening, Noah"
     'hello'     -> "Hello, Noah"
     'none'      -> no greeting */
  greeting: 'timeOfDay',

  /* ---- profile picture ----
     Put your picture in this folder as  profile.jpg  (square-ish works best),
     or change the file name below. You can ALSO change it inside the app:
     tap your picture -> Settings -> Change photo.
     photoCorner: 'left' or 'right' */
  photo: 'profile.jpg',
  photoCorner: 'left',

  /* ---- colors (any CSS color) ---- */
  theme: {
    bg:          '#000000',   // page background
    text:        '#ffffff',   // display text
    dim:         '#7f8ba3',   // small / secondary text
    keyNumber:   '#f2f5fb',   // digit keys (white)
    keyNumberText: '#0a0e17',
    keyOp:       '#2b79ff',   // + - × ÷ keys (blue)
    keyOpText:   '#ffffff',
    keyEq:       '#5aa5ff',   // the = key (lighter blue)
    keyEqText:   '#02122b',
    keyFn:       '#12203a',   // AC, ⌫, %, scientific keys (dark blue)
    keyFnText:   '#8dbaff',
    accent:      '#2b79ff',   // links, switches, highlights
    panel:       '#0c111b',   // tools / history sheets
    line:        '#1b2536',   // thin borders
    danger:      '#ff5d6c'
  },

  /* ---- turn features on/off (true / false) ---- */
  features: {
    history: true,        // history tape
    memory: true,         // MC MR M+ M- row
    scientific: true,     // extra keys when the phone is turned sideways
    livePreview: true,    // shows the answer while you type
    undoShake: true,      // shake the phone to clear (shake again to undo)
    haptics: true,        // default for the Settings switches (each can be toggled in-app)
    sound: false
  },

  /* ---- which tools show up in the Tools menu (delete a line to hide it) ---- */
  tools: ['convert', 'tip', 'percent', 'dates', 'programmer', 'mine'],

  /* ---- "Mine" tab: your own repeated math ----
     Each formula has input fields and results. Results are calculated with the
     same math engine as the main calculator, so you can use + - * / ^ ( ) and
     functions. Edit these, or add new ones right inside the app (Tools -> Mine -> New).
     format: 'money' (2 decimals, $) | 'number' | 'percent'                       */
  formulas: [
    {
      id: 'delivery',
      name: 'Delivery earnings',
      fields: [
        { key: 'earned', label: 'Total earned ($)', default: '' },
        { key: 'miles',  label: 'Miles driven',      default: '' },
        { key: 'hours',  label: 'Hours worked',      default: '' },
        { key: 'mpg',    label: 'Car MPG',           default: '25' },
        { key: 'gas',    label: 'Gas price ($/gal)', default: '3.50' },
        { key: 'rate',   label: 'Mileage rate ($/mi, for taxes)', default: '0.70' }
      ],
      outputs: [
        { label: 'Gas cost',               expr: 'miles / mpg * gas',                       format: 'money' },
        { label: 'Profit after gas',       expr: 'earned - miles / mpg * gas',              format: 'money', big: true },
        { label: 'Per mile (after gas)',   expr: '(earned - miles / mpg * gas) / miles',    format: 'money' },
        { label: 'Per hour (after gas)',   expr: '(earned - miles / mpg * gas) / hours',    format: 'money' },
        { label: 'Mileage deduction (tax)', expr: 'miles * rate',                           format: 'money' }
      ]
    }
  ]
};
