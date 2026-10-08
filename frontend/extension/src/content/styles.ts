/** Styles for the FormPilot control, scoped to its shadow root so they never touch the website. */
export const STYLES = `
:host { all: initial; }
.wrap { position: fixed; right: 16px; bottom: 16px; z-index: 2147483646; font: 14px/1.45 "Segoe UI", system-ui, -apple-system, sans-serif; color: #15153d; }
* { box-sizing: border-box; }
button { font: inherit; cursor: pointer; }
button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 2px solid #0e0e62; outline-offset: 2px; }
.logo svg { width: 22px; height: 22px; display: block; }

.pill { display: flex; align-items: stretch; background: #fff; border: 1px solid #d6d6e6; border-radius: 999px; box-shadow: 0 6px 24px rgba(14,14,98,.18); overflow: hidden; }
.pill-main { display: flex; align-items: center; gap: 8px; padding: 8px 12px 8px 10px; background: none; border: 0; color: #15153d; }
.pill-main:hover { background: #f3f3fb; }
.pill-x { border: 0; border-left: 1px solid #ececf4; background: none; color: #5d5d80; padding: 0 10px; font-size: 16px; }
.pill-x:hover { background: #f3f3fb; color: #15153d; }

.panel { width: min(380px, calc(100vw - 32px)); max-height: min(640px, calc(100vh - 32px)); display: flex; flex-direction: column; background: #fff; border: 1px solid #d6d6e6; border-radius: 14px; box-shadow: 0 16px 48px rgba(14,14,98,.22); overflow: hidden; }
header { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid #ececf4; }
.title { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.title strong { letter-spacing: .02em; }
.icon { border: 0; background: none; font-size: 20px; line-height: 1; color: #5d5d80; padding: 2px 6px; border-radius: 6px; }
.icon:hover { background: #f3f3fb; color: #15153d; }
.body { padding: 12px 14px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
footer { display: flex; justify-content: space-between; gap: 10px; align-items: center; padding: 9px 14px; border-top: 1px solid #ececf4; font-size: 11.5px; color: #5d5d80; }

.muted { color: #5d5d80; }
.small { font-size: 12px; }
.error { color: #b42318; }
.warn-text { color: #8a5a00; }
p { margin: 0; }
.stack { display: flex; flex-direction: column; gap: 10px; }

.summary .big { font-size: 16px; font-weight: 600; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.chip { font-size: 12px; padding: 2px 8px; border-radius: 999px; background: #f3f3fb; border: 1px solid #e3e3ef; }
.chip.ok { background: #e7f6ee; border-color: #b6e2c8; color: #146c3a; }
.chip.warn { background: #fff3cc; border-color: #f1d27a; color: #8a5a00; }
.notice, .result { border-radius: 10px; padding: 9px 11px; font-size: 13px; }
.notice { background: #eef1fd; }
.result { background: #e7f6ee; color: #146c3a; display: flex; flex-direction: column; gap: 2px; font-weight: 600; }
.result .warn-text { font-weight: 600; }

.section h3 { margin: 0 0 6px; font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: #5d5d80; }
.section ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.row { display: flex; gap: 10px; align-items: flex-start; padding: 8px 10px; border: 1px solid #ececf4; border-radius: 10px; }
.row input[type=checkbox] { margin-top: 3px; accent-color: #0e0e62; width: 16px; height: 16px; flex: none; }
.grow { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; cursor: pointer; }
.label { font-weight: 600; font-size: 13px; }
.value { font-size: 13px; overflow-wrap: anywhere; }
.meta { font-size: 11.5px; color: #5d5d80; }
.check { display: flex; gap: 6px; align-items: center; cursor: pointer; }
.card { border: 1px solid #f1d27a; background: #fffbea; border-radius: 10px; padding: 10px; display: flex; flex-direction: column; gap: 6px; }
.card-head { display: flex; justify-content: space-between; gap: 8px; align-items: flex-start; }
.tag { font-size: 11px; white-space: nowrap; color: #5d5d80; }
.tag.ok { color: #146c3a; font-weight: 600; }
.tag.warn { color: #8a5a00; font-weight: 600; }
.row-actions { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
input[type=text], select, textarea { width: 100%; font: inherit; font-size: 13px; color: #15153d; background: #fff; border: 1px solid #c9c9dc; border-radius: 8px; padding: 7px 9px; }
textarea { resize: vertical; }
.row-actions select { flex: 1; min-width: 0; width: auto; }

.btn { border-radius: 9px; border: 1px solid transparent; padding: 9px 14px; font-weight: 600; }
.btn.small { padding: 5px 10px; font-size: 12.5px; }
.btn.primary { background: #0e0e62; color: #fff; }
.btn.primary:hover { background: #24247f; }
.btn.primary:disabled { opacity: .45; cursor: default; }
.btn.ghost { background: #fff; color: #0e0e62; border-color: #c9cdf2; }
.btn.ghost:hover { background: #eef1fd; }
.actions { display: flex; flex-direction: column; gap: 6px; }
.actions .btn { width: 100%; }
.link { border: 0; background: none; color: #0e0e62; text-decoration: underline; padding: 0; font-size: inherit; }
@media (prefers-reduced-motion: no-preference) { .panel { animation: fp-in .16s ease-out; } @keyframes fp-in { from { opacity: 0; transform: translateY(6px); } } }
`
