(function() {
	//#region ../extension/src/core/field-detector.ts
	var SKIPPED_TYPES = /* @__PURE__ */ new Set([
		"hidden",
		"submit",
		"button",
		"reset",
		"image",
		"password",
		"search",
		"range",
		"color"
	]);
	var SKIPPED_NAMES = /captcha|recaptcha|otp|one[-_ ]?time|verification[-_ ]?code|csrf|token|honeypot/i;
	var HEADING_SELECTOR = "h1, h2, h3, h4, h5, h6, legend, [role=\"heading\"]";
	var MAX_TEXT = 160;
	var counter = 0;
	function clean(text) {
		return (text ?? "").replace(/\s+/g, " ").replace(/\(required\)|\(optional\)/gi, "").replace(/[*:]+\s*$/g, "").trim().slice(0, MAX_TEXT);
	}
	/** Visible text of an element, without the text of controls inside it (e.g. a <label> wrapping a <select>). */
	function ownText(el) {
		const copy = el.cloneNode(true);
		copy.querySelectorAll("input, select, textarea, option, button, script, style").forEach((n) => n.remove());
		return clean(copy.textContent);
	}
	function typeOf(el) {
		if (el instanceof HTMLTextAreaElement) return "textarea";
		if (el instanceof HTMLSelectElement) return "select";
		return (el.type || "text").toLowerCase();
	}
	function isVisible(el) {
		if (el.closest("[aria-hidden=\"true\"], [hidden]")) return false;
		const check = el.checkVisibility;
		if (typeof check === "function") return check.call(el, { checkVisibilityCSS: true });
		for (let node = el; node; node = node.parentElement) {
			const style = node.ownerDocument.defaultView?.getComputedStyle(node);
			if (style && (style.display === "none" || style.visibility === "hidden")) return false;
		}
		return true;
	}
	/** Text right before the field: "<div>Full name</div><input>" or "Full name <input>". */
	function precedingText(el) {
		let node = el;
		for (let depth = 0; node && depth < 3; depth++) {
			for (let sib = node.previousElementSibling; sib; sib = sib.previousElementSibling) {
				if (sib.matches("input, select, textarea") || sib.querySelector("input, select, textarea")) return "";
				const text = ownText(sib);
				if (text) return text;
			}
			const prevText = node.previousSibling;
			if (prevText && prevText.nodeType === Node.TEXT_NODE && clean(prevText.textContent)) return clean(prevText.textContent);
			node = node.parentElement;
			if (node && node.querySelectorAll("input, select, textarea").length > 1) break;
		}
		return "";
	}
	/** The label a person reads for this field. */
	function labelOf(el) {
		for (const label of Array.from(el.labels ?? [])) {
			const text = ownText(label);
			if (text) return text;
		}
		const labelledBy = el.getAttribute("aria-labelledby");
		if (labelledBy) {
			const text = clean(labelledBy.split(/\s+/).map((id) => el.ownerDocument.getElementById(id)?.textContent ?? "").join(" "));
			if (text) return text;
		}
		const aria = clean(el.getAttribute("aria-label"));
		if (aria) return aria;
		const before = precedingText(el);
		if (before) return before;
		if ("placeholder" in el && clean(el.placeholder)) return clean(el.placeholder);
		return clean(el.getAttribute("title"));
	}
	/** The heading or fieldset legend the field sits under, e.g. "Emergency contact". */
	function sectionOf(el) {
		const legend = el.closest("fieldset")?.querySelector("legend");
		if (legend && clean(legend.textContent)) return clean(legend.textContent);
		let node = el;
		for (let depth = 0; node && depth < 8; depth++) {
			for (let sib = node.previousElementSibling, steps = 0; sib && steps < 12; sib = sib.previousElementSibling, steps++) {
				if (sib.matches(HEADING_SELECTOR)) return clean(sib.textContent);
				const inner = sib.querySelectorAll(HEADING_SELECTOR);
				if (inner.length) return clean(inner[inner.length - 1].textContent);
			}
			node = node.parentElement;
		}
		return "";
	}
	function radioGroupLabel(radios) {
		const first = radios[0];
		const group = first.closest("fieldset, [role=\"radiogroup\"]");
		if (group) {
			const legend = group.querySelector("legend");
			if (legend && clean(legend.textContent)) return clean(legend.textContent);
			const aria = clean(group.getAttribute("aria-label"));
			if (aria) return aria;
			const labelledBy = group.getAttribute("aria-labelledby");
			if (labelledBy) return clean(first.ownerDocument.getElementById(labelledBy)?.textContent);
		}
		let container = first.parentElement;
		while (container && !radios.every((r) => container.contains(r))) container = container.parentElement;
		return container ? precedingText(container) : "";
	}
	function optionLabel(radio) {
		return labelOf(radio) || clean(radio.value);
	}
	function fieldId(el) {
		if (!el.dataset.formpilotId) el.dataset.formpilotId = `fp${++counter}`;
		return el.dataset.formpilotId;
	}
	function meta(el, label, type, options) {
		const out = {
			id: fieldId(el),
			label,
			type,
			required: el.required || el.getAttribute("aria-required") === "true",
			options
		};
		if (el.name) out.name = el.name.slice(0, 200);
		if (el.id) out.html_id = el.id.slice(0, 200);
		if ("placeholder" in el && el.placeholder) out.placeholder = clean(el.placeholder);
		const aria = el.getAttribute("aria-label");
		if (aria) out.aria_label = clean(aria);
		const autocomplete = el.getAttribute("autocomplete");
		if (autocomplete && autocomplete !== "off" && autocomplete !== "on") out.autocomplete = autocomplete.slice(0, 100);
		const section = sectionOf(el);
		if (section && section !== label) out.section = section;
		return out;
	}
	/** Every fillable field under `root`, in page order. Radio buttons sharing a name become one field. */
	function detectFields(root = document) {
		const elements = Array.from(root.querySelectorAll("input, textarea, select"));
		const fields = [];
		const radioGroups = /* @__PURE__ */ new Map();
		for (const el of elements) {
			const type = typeOf(el);
			if (SKIPPED_TYPES.has(type) || el.disabled || el.readOnly) continue;
			if (SKIPPED_NAMES.test(`${el.name} ${el.id}`) || !isVisible(el)) continue;
			if (el.closest("form[role=\"search\"], [role=\"search\"]")) continue;
			if (type === "radio") {
				const input = el;
				const key = `${input.form ? Array.from(document.forms).indexOf(input.form) : "page"}:${input.name || fieldId(input)}`;
				const group = radioGroups.get(key);
				if (group) {
					group.push(input);
					continue;
				}
				radioGroups.set(key, [input]);
				fields.push({
					...meta(input, "", "radio", []),
					element: input,
					radios: radioGroups.get(key)
				});
				continue;
			}
			const options = el instanceof HTMLSelectElement ? Array.from(el.options).map((o) => clean(o.text)).filter(Boolean) : [];
			fields.push({
				...meta(el, labelOf(el), type, options),
				element: el
			});
		}
		for (const field of fields) {
			if (field.type !== "radio" || !field.radios) continue;
			field.label = radioGroupLabel(field.radios);
			field.options = field.radios.map(optionLabel);
			field.radios.forEach((r) => r.dataset.formpilotId = field.id);
		}
		return fields;
	}
	/** The metadata to send to the API: no elements, no values. */
	function toMeta(fields) {
		return fields.map(({ element: _element, radios: _radios, ...rest }) => rest);
	}
	/** A short signature of the page's current fields, to notice when a form changes (SPA, multi-step). */
	function signature(fields) {
		return fields.map((f) => `${f.id}:${f.label}`).join("|");
	}
	//#endregion
	//#region ../extension/src/shared/messages.ts
	/** Sends a request to the service worker. */
	async function send(request) {
		try {
			return await chrome.runtime.sendMessage(request);
		} catch {
			return {
				ok: false,
				error: "FormPilot was updated or restarted. Reload this page to use it again."
			};
		}
	}
	var DEFAULT_APP_URL = "http://localhost:5173";
	var STORAGE = {
		token: "fpToken",
		appUrl: "fpAppUrl",
		showButton: "fpShowButton",
		hiddenSites: "fpHiddenSites"
	};
	//#endregion
	//#region ../extension/src/core/autofill-engine.ts
	/**
	* Autofill engine: puts values into a web page's fields so the page's own code notices them.
	*
	* Setting `input.value` directly is invisible to React, Vue and Angular, which track values
	* themselves. Values are written through the browser's native setter, then the input/change/blur
	* events a person's typing would fire are dispatched. Radios and checkboxes are clicked, like a person
	* would. Nothing here submits a form.
	*/
	function fire(el, type) {
		el.dispatchEvent(new Event(type, {
			bubbles: true,
			composed: true
		}));
	}
	/** Writes a value through the native setter and fires the events typing would. */
	function setNativeValue(el, value) {
		const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
		const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
		el.focus({ preventScroll: true });
		if (setter) setter.call(el, value);
		else el.value = value;
		fire(el, "input");
		fire(el, "change");
		el.blur();
		fire(el, "blur");
	}
	var same = (a, b) => clean(a).toLowerCase() === clean(b).toLowerCase();
	function selectOption(el, option) {
		const match = Array.from(el.options).find((o) => same(o.text, option) || same(o.value, option));
		if (!match) return {
			ok: false,
			reason: "That option isn’t in the list."
		};
		setNativeValue(el, match.value);
		return { ok: true };
	}
	function checkRadio(radios, option) {
		const target = radios.find((r) => {
			return same(Array.from(r.labels ?? []).map((l) => l.textContent ?? "").join(" ") || r.getAttribute("aria-label") || "", option) || same(r.value, option);
		});
		if (!target) return {
			ok: false,
			reason: "That option isn’t in the list."
		};
		if (!target.checked) target.click();
		if (!target.checked) {
			target.checked = true;
			fire(target, "input");
			fire(target, "change");
		}
		return { ok: true };
	}
	function attachFile(el, file) {
		const transfer = new DataTransfer();
		transfer.items.add(file);
		el.files = transfer.files;
		fire(el, "input");
		fire(el, "change");
		return { ok: true };
	}
	var DATE_PATTERNS = [
		{
			re: /yyyy[-/.]mm[-/.]dd/i,
			format: (y, m, d) => `${y}-${m}-${d}`
		},
		{
			re: /dd[-/.]mm[-/.]yyyy/i,
			format: (y, m, d) => `${d}/${m}/${y}`
		},
		{
			re: /mm[-/.]dd[-/.]yyyy/i,
			format: (y, m, d) => `${m}/${d}/${y}`
		},
		{
			re: /dd[-/.]mm[-/.]yy\b/i,
			format: (y, m, d) => `${d}/${m}/${y.slice(2)}`
		},
		{
			re: /mm[-/.]dd[-/.]yy\b/i,
			format: (y, m, d) => `${m}/${d}/${y.slice(2)}`
		}
	];
	/** Separator used in the hint ("DD-MM-YYYY" -> "-"), so the value is typed the way the field shows it. */
	function separatorIn(hint) {
		return hint.match(/(?:dd|mm|yyyy)([-/.])/i)?.[1] ?? "/";
	}
	/**
	* The date in the format this field expects, or null when the field gives no hint and a guess could
	* swap day and month (then the person confirms the format).
	*/
	function formatDateFor(el, iso) {
		const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
		if (!m) return null;
		const [, y, mo, d] = m;
		const type = typeOf(el);
		if (type === "date") return iso;
		if (type === "month") return `${y}-${mo}`;
		if (type === "datetime-local") return `${iso}T00:00`;
		const hints = [
			"placeholder" in el ? el.placeholder : "",
			el.getAttribute("pattern") ?? "",
			el.getAttribute("aria-label") ?? "",
			el.getAttribute("title") ?? "",
			...Array.from(el.labels ?? []).map((l) => l.textContent ?? "")
		].join(" ");
		for (const p of DATE_PATTERNS) if (p.re.test(hints)) return p.format(y, mo, d).replace(/[/]/g, separatorIn(hints.match(p.re)[0]));
		return null;
	}
	/** Both readings of an ambiguous date, for the person to choose between. */
	function dateChoices(iso) {
		const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
		if (!m) return [];
		const [, y, mo, d] = m;
		return [
			{
				label: `${d}/${mo}/${y} (day first)`,
				value: `${d}/${mo}/${y}`
			},
			{
				label: `${mo}/${d}/${y} (month first)`,
				value: `${mo}/${d}/${y}`
			},
			{
				label: `${y}-${mo}-${d}`,
				value: `${y}-${mo}-${d}`
			}
		];
	}
	function fill(field, request) {
		const el = field.element;
		if (!el.isConnected) return {
			ok: false,
			reason: "This field is no longer on the page."
		};
		if (field.type === "radio" && field.radios) return checkRadio(field.radios, request.option ?? request.value);
		if (el instanceof HTMLSelectElement) return selectOption(el, request.option ?? request.value);
		if (field.type === "checkbox" || field.type === "file") return {
			ok: false,
			reason: "Choose this yourself."
		};
		let value = request.value;
		if (request.iso) {
			const formatted = formatDateFor(el, request.iso);
			if (formatted === null) return {
				ok: false,
				reason: "Confirm the date format."
			};
			value = formatted;
		}
		setNativeValue(el, value);
		return { ok: true };
	}
	/** A brief outline on a field FormPilot just filled, so the person can see what changed. */
	function highlight(el) {
		const target = el;
		const previous = target.style.boxShadow;
		target.style.boxShadow = "0 0 0 2px rgba(14, 14, 98, 0.45)";
		window.setTimeout(() => {
			target.style.boxShadow = previous;
		}, 2500);
	}
	//#endregion
	//#region ../extension/src/field-mapper/index.ts
	/**
	* Field mapper (client side). Understanding what a field means happens on the FormPilot API, which
	* already does semantic mapping and RAG for the whole product. This module prepares the request from
	* the detected fields and decides, for each suggestion, whether it can be filled as is on this page.
	*/
	/** A short organization name for Smart Answers, from the page's own metadata. */
	function organization() {
		const site = document.querySelector("meta[property=\"og:site_name\"]")?.content;
		if (site) return site.slice(0, 200);
		const host = location.hostname.replace(/^www\./, "").split(".");
		return host.length > 1 ? host[host.length - 2].replace(/^\w/, (c) => c.toUpperCase()) : void 0;
	}
	function suggestRequest(fields) {
		return {
			type: "suggest",
			fields: toMeta(fields),
			pageOrigin: location.origin,
			pageTitle: document.title,
			organization: organization()
		};
	}
	/** True when the suggestion can be written into its field without asking anything. */
	function fillableAsIs(s, field) {
		if (!field || s.status !== "ready" || !s.value) return false;
		if (s.kind !== "value" && s.kind !== "choice") return false;
		if (s.value_iso && formatDateFor(field.element, s.value_iso) === null) return false;
		return true;
	}
	/** Ready fields are pre-selected for Autofill, except sensitive ones, which the person ticks themselves. */
	function selectedByDefault(s, field) {
		return fillableAsIs(s, field) && !s.sensitive;
	}
	var TIER_LABEL = {
		safe: "Safe match",
		review: "Review recommended",
		uncertain: "Needs review",
		none: "No match"
	};
	//#endregion
	//#region ../extension/src/content/styles.ts
	/** Styles for the FormPilot control, scoped to its shadow root so they never touch the website. */
	var STYLES = `
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
`;
	//#endregion
	//#region ../extension/src/content/ui.ts
	/**
	* The FormPilot control shown on websites: a small floating button, and a panel that lists every
	* detected field with its suggested value, source and confidence. It lives in a closed shadow root so
	* the site's styles can't reach it, and it never submits the site's form.
	*/
	function h(tag, props = null, ...children) {
		const el = document.createElement(tag);
		for (const [key, value] of Object.entries(props ?? {})) {
			if (value === void 0 || value === null || value === false) continue;
			if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2), value);
			else if (key === "className") el.className = String(value);
			else if (key === "checked" || key === "value" || key === "disabled" || key === "selected") el[key] = value;
			else el.setAttribute(key, value === true ? "" : String(value));
		}
		for (const child of children.flat()) {
			if (child === null || child === void 0 || child === false) continue;
			el.append(child);
		}
		return el;
	}
	var LOGO = `<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#0e0e62"/><path d="M9 11h14M9 16h10M9 21h6" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><circle cx="21.5" cy="21" r="2.6" fill="#ffc72c"/></svg>`;
	function logo() {
		const span = h("span", { className: "logo" });
		span.innerHTML = LOGO;
		return span;
	}
	var pct = (n) => `${Math.round(n * 100)}%`;
	/** "12 May 2002" -> "2002-05-12", for alternatives the person picks for a date field. */
	function isoFromDisplay(value) {
		const months = [
			"jan",
			"feb",
			"mar",
			"apr",
			"may",
			"jun",
			"jul",
			"aug",
			"sep",
			"oct",
			"nov",
			"dec"
		];
		const m = value.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
		const month = m ? months.indexOf(m[2].slice(0, 3).toLowerCase()) + 1 : 0;
		return m && month ? `${m[3]}-${String(month).padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
	}
	var Overlay = class {
		host;
		root;
		fields = [];
		byId = /* @__PURE__ */ new Map();
		status;
		open = false;
		dismissed = false;
		phase = "idle";
		error = "";
		response = null;
		selected = /* @__PURE__ */ new Set();
		filled = /* @__PURE__ */ new Set();
		skipped = /* @__PURE__ */ new Set();
		problems = /* @__PURE__ */ new Map();
		drafts = /* @__PURE__ */ new Map();
		saveDraft = /* @__PURE__ */ new Set();
		choosing = /* @__PURE__ */ new Set();
		stale = false;
		lastRun = null;
		constructor(status) {
			this.status = status;
			this.host = document.createElement("formpilot-overlay");
			this.host.style.all = "initial";
			this.root = this.host.attachShadow({ mode: "closed" });
			const style = document.createElement("style");
			style.textContent = STYLES;
			this.root.append(style, h("div", { className: "wrap" }));
			document.documentElement.append(this.host);
			this.render();
		}
		get visible() {
			return this.status.showButton && !this.status.hiddenSites.includes(location.hostname);
		}
		/** New detection results. When the form changed after suggestions were made, offer to rescan. */
		setFields(fields) {
			const before = new Set(this.fields.map((f) => f.id));
			this.fields = fields;
			this.byId = new Map(fields.map((f) => [f.id, f]));
			if (this.response && fields.some((f) => !before.has(f.id))) this.stale = true;
			this.render();
		}
		async openPanel() {
			this.open = true;
			this.dismissed = false;
			if (!this.response || this.stale) await this.scan();
			else this.render();
		}
		async scan() {
			this.phase = "loading";
			this.stale = false;
			this.render();
			const status = await send({ type: "status" });
			if (!status.ok || !status.data.connected) {
				this.phase = "connect";
				return this.render();
			}
			if (!this.fields.length) {
				this.phase = "error";
				this.error = "No form fields found on this page.";
				return this.render();
			}
			const reply = await send(suggestRequest(this.fields));
			if (!reply.ok) {
				this.phase = reply.status === 401 ? "connect" : "error";
				this.error = reply.error;
				return this.render();
			}
			this.response = reply.data;
			this.selected = new Set(reply.data.fields.filter((s) => !this.filled.has(s.id) && selectedByDefault(s, this.byId.get(s.id))).map((s) => s.id));
			this.problems.clear();
			this.phase = "ready";
			this.render();
		}
		fillOne(s, request) {
			const field = this.byId.get(s.id);
			if (!field) {
				this.problems.set(s.id, "This field is no longer on the page.");
				return false;
			}
			const result = fill(field, request);
			if (!result.ok) {
				this.problems.set(s.id, result.reason ?? "Couldn’t fill this field.");
				return false;
			}
			this.problems.delete(s.id);
			this.filled.add(s.id);
			this.selected.delete(s.id);
			highlight(field.element);
			return true;
		}
		autofill() {
			const items = this.response?.fields.filter((s) => this.selected.has(s.id)) ?? [];
			let filled = 0;
			for (const s of items) if (this.fillOne(s, {
				value: s.value ?? "",
				option: s.option,
				iso: s.value_iso
			})) filled++;
			const review = (this.response?.fields ?? []).filter((s) => !this.filled.has(s.id) && !this.skipped.has(s.id) && s.status !== "ready").length;
			this.lastRun = {
				filled,
				review: review + this.problems.size
			};
			this.render();
		}
		useValue(s, value) {
			const field = this.byId.get(s.id);
			const dateLike = field && (field.type === "date" || s.key === "date_of_birth");
			const iso = value === s.value ? s.value_iso : dateLike ? isoFromDisplay(value) : null;
			this.fillOne(s, {
				value,
				option: value === s.value ? s.option : value,
				iso
			});
			this.render();
		}
		async attach(s, documentId) {
			const field = this.byId.get(s.id);
			if (!field || !(field.element instanceof HTMLInputElement)) return;
			const reply = await send({
				type: "download",
				documentId
			});
			if (!reply.ok) {
				this.problems.set(s.id, reply.error);
				return this.render();
			}
			const bytes = Uint8Array.from(atob(reply.data.base64), (c) => c.charCodeAt(0));
			attachFile(field.element, new File([bytes], reply.data.name, { type: reply.data.mime }));
			this.filled.add(s.id);
			this.problems.delete(s.id);
			highlight(field.element);
			this.render();
		}
		async saveManual(s, value) {
			if (s.key) {
				if ((await send({
					type: "save-profile",
					key: s.key,
					value
				})).ok) return;
			}
			await send({
				type: "save-answer",
				question: s.label,
				answer: value
			});
		}
		async hideOnSite() {
			const hidden = [.../* @__PURE__ */ new Set([...this.status.hiddenSites, location.hostname])];
			await chrome.storage.local.set({ [STORAGE.hiddenSites]: hidden });
			this.status = {
				...this.status,
				hiddenSites: hidden
			};
			this.open = false;
			this.render();
		}
		render() {
			const wrap = this.root.querySelector(".wrap");
			wrap.replaceChildren();
			if (this.open) wrap.append(this.panel());
			else if (this.visible && !this.dismissed && this.fields.length >= 2) wrap.append(this.pill());
		}
		pill() {
			return h("div", { className: "pill" }, h("button", {
				className: "pill-main",
				onclick: () => void this.openPanel(),
				"aria-label": `FormPilot: ${this.fields.length} fields detected. Open.`
			}, logo(), h("span", null, h("strong", null, "FormPilot"), ` · ${this.fields.length} fields`)), h("button", {
				className: "pill-x",
				onclick: () => (this.dismissed = true, this.render()),
				"aria-label": "Hide FormPilot on this page",
				title: "Hide on this page"
			}, "×"));
		}
		panel() {
			const body = h("div", { className: "body" });
			if (this.phase === "loading") body.append(h("p", { className: "muted" }, "Understanding the form and matching it with your profile…"));
			else if (this.phase === "connect") body.append(this.connectView());
			else if (this.phase === "error") body.append(h("p", {
				className: "error",
				role: "alert"
			}, this.error), h("button", {
				className: "btn ghost",
				onclick: () => void this.scan()
			}, "Try again"));
			else if (this.response) body.append(...this.resultsView(this.response));
			return h("section", {
				className: "panel",
				role: "dialog",
				"aria-label": "FormPilot"
			}, h("header", null, logo(), h("div", { className: "title" }, h("strong", null, "FormPilot"), h("span", { className: "muted small" }, location.hostname)), h("button", {
				className: "icon",
				onclick: () => (this.open = false, this.render()),
				"aria-label": "Close FormPilot"
			}, "×")), body, h("footer", null, h("span", null, "FormPilot never submits forms. Review, then submit yourself."), h("button", {
				className: "link",
				onclick: () => void this.hideOnSite()
			}, "Hide on this site")));
		}
		connectView() {
			return h("div", { className: "stack" }, h("p", null, h("strong", null, "Connect FormPilot to your profile")), h("p", { className: "muted" }, this.error || "Sign in to the FormPilot app and connect this browser. Your profile stays in your account."), h("button", {
				className: "btn primary",
				onclick: () => void send({ type: "open-connect" })
			}, "Connect FormPilot"));
		}
		resultsView(r) {
			const out = [];
			const s = r.summary;
			out.push(h("div", { className: "summary" }, h("p", { className: "big" }, `${s.detected} fields detected`), h("div", { className: "chips" }, h("span", { className: "chip ok" }, `${s.ready} ready`), h("span", { className: "chip warn" }, `${s.needs_review} need review`), h("span", { className: "chip" }, `${s.missing} not in profile`))));
			if (this.stale) out.push(h("div", { className: "notice" }, "This form changed. ", h("button", {
				className: "link",
				onclick: () => void this.scan()
			}, "Scan the new fields")));
			if (this.lastRun) out.push(h("div", {
				className: "result",
				role: "status"
			}, h("p", null, `✓ ${this.lastRun.filled} field${this.lastRun.filled === 1 ? "" : "s"} filled`), this.lastRun.review ? h("p", { className: "warn-text" }, `⚠ ${this.lastRun.review} need${this.lastRun.review === 1 ? "s" : ""} your review`) : null));
			const template = r.template;
			const templateFields = r.fields.filter((f) => f.method === "template" && !this.filled.has(f.id));
			if (template && templateFields.length) out.push(h("div", { className: "notice" }, `Reuse your “${template.name}” template? `, h("button", {
				className: "link",
				onclick: () => (templateFields.forEach((f) => this.fillOne(f, { value: f.value ?? "" })), this.render())
			}, "Use template")));
			const left = r.fields.filter((f) => f.kind === "consent" || this.byId.get(f.id)?.type === "checkbox" || f.kind === "document" && f.status === "missing");
			const leftIds = new Set(left.map((f) => f.id));
			const ready = r.fields.filter((f) => !leftIds.has(f.id) && fillableAsIs(f, this.byId.get(f.id)));
			const readyIds = new Set(ready.map((f) => f.id));
			const missing = r.fields.filter((f) => !leftIds.has(f.id) && !readyIds.has(f.id) && f.status === "missing" && !f.alternatives.length);
			const missingIds = new Set(missing.map((f) => f.id));
			const review = r.fields.filter((f) => !leftIds.has(f.id) && !readyIds.has(f.id) && !missingIds.has(f.id));
			if (ready.length) out.push(this.section("Ready to fill", ready.map((f) => this.readyRow(f))));
			const count = [...this.selected].filter((id) => readyIds.has(id)).length;
			out.push(h("div", { className: "actions" }, h("button", {
				className: "btn primary",
				disabled: count === 0,
				onclick: () => this.autofill()
			}, count ? `Autofill ${count} field${count === 1 ? "" : "s"}` : "Autofill"), h("p", { className: "muted small" }, "Review before filling. Sensitive fields are filled only if you tick them.")));
			if (review.length) out.push(this.section("Needs your review", review.map((f) => this.reviewCard(f, r))));
			if (missing.length) out.push(this.section("Not in your profile", missing.map((f) => this.missingCard(f))));
			if (left.length) out.push(this.section("Left to you", left.map((f) => this.leftRow(f))));
			return out;
		}
		section(title, rows) {
			return h("div", { className: "section" }, h("h3", null, title), h("ul", null, rows));
		}
		status_(f) {
			if (this.filled.has(f.id)) return h("span", { className: "tag ok" }, "✓ Filled");
			if (this.skipped.has(f.id)) return h("span", { className: "tag" }, "Skipped");
			return null;
		}
		readyRow(f) {
			const id = `fp-sel-${f.id}`;
			return h("li", { className: "row" }, h("input", {
				type: "checkbox",
				id,
				checked: this.selected.has(f.id),
				disabled: this.filled.has(f.id),
				onchange: (e) => {
					if (e.target.checked) this.selected.add(f.id);
					else this.selected.delete(f.id);
					this.render();
				}
			}), h("label", {
				for: id,
				className: "grow"
			}, h("span", { className: "label" }, f.label), h("span", { className: "value" }, f.value ?? ""), h("span", { className: "meta" }, `${TIER_LABEL[f.tier]} · ${pct(f.confidence)}${f.source ? ` · ${f.source}` : ""}`), f.sensitive && !this.filled.has(f.id) ? h("span", { className: "meta warn-text" }, "Sensitive: tick to include") : null, this.problems.has(f.id) ? h("span", { className: "meta error" }, this.problems.get(f.id)) : null), this.status_(f));
		}
		reviewCard(f, r) {
			const done = this.status_(f);
			const card = h("li", { className: "card" }, h("div", { className: "card-head" }, h("span", { className: "label" }, f.label), done ?? h("span", { className: "tag warn" }, "⚠ Needs review")));
			if (done) return card;
			const field = this.byId.get(f.id);
			if (f.kind === "answer" && f.value) {
				const area = h("textarea", {
					rows: 5,
					"aria-label": `Suggested answer for ${f.label}`
				});
				area.value = this.drafts.get(f.id) ?? f.value;
				area.addEventListener("input", () => this.drafts.set(f.id, area.value));
				card.append(h("p", { className: "meta" }, "Suggested answer. Edit it so it sounds like you."), area, f.sources.length ? h("p", { className: "meta" }, `Sources: ${f.sources.map((x) => x.label).join(", ")}`) : "", h("div", { className: "row-actions" }, h("button", {
					className: "btn small primary",
					onclick: () => this.useValue(f, area.value.trim())
				}, "Use"), h("button", {
					className: "btn small ghost",
					onclick: async () => {
						const reply = await send({
							type: "answer",
							question: f.label,
							organization: void 0
						});
						if (reply.ok && reply.data.answer) {
							this.drafts.set(f.id, reply.data.answer);
							f.sources = reply.data.sources;
						}
						this.render();
					}
				}, "Regenerate"), h("button", {
					className: "btn small ghost",
					onclick: () => (this.skipped.add(f.id), this.render())
				}, "Skip")));
				return card;
			}
			if (f.kind === "document") {
				const select = h("select", { "aria-label": `Document for ${f.label}` }, r.documents.map((d) => h("option", {
					value: d.id,
					selected: d.id === f.document_id
				}, d.filename)));
				card.append(h("p", { className: "meta" }, "Select document from your vault. It is attached only when you click Attach."), select, h("div", { className: "row-actions" }, h("button", {
					className: "btn small primary",
					disabled: !r.documents.length,
					onclick: () => void this.attach(f, select.value)
				}, "Attach"), h("button", {
					className: "btn small ghost",
					onclick: () => (this.skipped.add(f.id), this.render())
				}, "Skip")));
				return card;
			}
			if (f.value_iso && f.value && field && formatDateFor(field.element, f.value_iso) === null) {
				card.append(h("p", { className: "meta" }, `Which format does this field use? Your date: ${f.value}`), h("div", { className: "row-actions" }, dateChoices(f.value_iso).map((c) => h("button", {
					className: "btn small ghost",
					onclick: () => (this.fillOne(f, { value: c.value }), this.render())
				}, c.label))));
				return card;
			}
			if (f.value) card.append(h("p", { className: "value" }, h("span", { className: "muted" }, "Suggested: "), f.value), h("p", { className: "meta" }, `${TIER_LABEL[f.tier]} · ${pct(f.confidence)}${f.source ? ` · ${f.source}` : ""}`));
			card.append(h("p", { className: "meta" }, f.reasoning));
			if (this.problems.has(f.id)) card.append(h("p", { className: "meta error" }, this.problems.get(f.id)));
			if (f.alternatives.length) card.append(h("div", { className: "row-actions" }, f.alternatives.map((a) => h("button", {
				className: "btn small ghost",
				onclick: () => this.useValue(f, a.value)
			}, `Use ${a.value}`))));
			const actions = h("div", { className: "row-actions" });
			if (f.value) actions.append(h("button", {
				className: "btn small primary",
				onclick: () => this.useValue(f, f.value)
			}, "Use"));
			actions.append(h("button", {
				className: "btn small ghost",
				onclick: () => (this.choosing.add(f.id), this.render())
			}, "Choose another"));
			actions.append(h("button", {
				className: "btn small ghost",
				onclick: () => (this.skipped.add(f.id), this.render())
			}, "Skip"));
			card.append(actions);
			if (this.choosing.has(f.id)) card.append(this.chooser(f, r));
			return card;
		}
		/** Pick any value from the profile, or the field's own options. */
		chooser(f, r) {
			const field = this.byId.get(f.id);
			const choices = field && field.options.length ? field.options.map((o) => ({
				label: o,
				value: o
			})) : r.profile.map((p) => ({
				label: `${p.label}: ${p.value}`,
				value: p.value
			}));
			const select = h("select", { "aria-label": `Choose a value for ${f.label}` }, choices.map((c) => h("option", { value: c.value }, c.label.slice(0, 80))));
			return h("div", { className: "row-actions" }, select, h("button", {
				className: "btn small primary",
				onclick: () => this.useValue(f, select.value)
			}, "Fill"));
		}
		missingCard(f) {
			const done = this.status_(f);
			const card = h("li", { className: "card" }, h("div", { className: "card-head" }, h("span", { className: "label" }, f.label), done ?? h("span", { className: "tag" }, "⚠ Information not available")));
			if (done) return card;
			const id = `fp-manual-${f.id}`;
			const input = h("input", {
				id,
				type: "text",
				placeholder: "Enter manually",
				"aria-label": `Enter ${f.label}`
			});
			input.value = this.drafts.get(f.id) ?? "";
			input.addEventListener("input", () => this.drafts.set(f.id, input.value));
			const save = h("input", {
				type: "checkbox",
				id: `${id}-save`,
				checked: this.saveDraft.has(f.id),
				onchange: (e) => e.target.checked ? this.saveDraft.add(f.id) : this.saveDraft.delete(f.id)
			});
			card.append(h("p", { className: "meta" }, "FormPilot doesn’t guess information you haven’t given it."), input, h("label", {
				for: `${id}-save`,
				className: "meta check"
			}, save, f.sensitive ? "Save to my FormPilot profile (sensitive: only if you’re sure)" : "Save to my FormPilot profile for next time"), h("div", { className: "row-actions" }, h("button", {
				className: "btn small primary",
				onclick: async () => {
					const value = input.value.trim();
					if (!value) return;
					this.fillOne(f, { value });
					if (this.saveDraft.has(f.id)) await this.saveManual(f, value);
					this.render();
				}
			}, "Fill"), h("button", {
				className: "btn small ghost",
				onclick: () => (this.skipped.add(f.id), this.render())
			}, "Skip")));
			return card;
		}
		leftRow(f) {
			return h("li", { className: "row" }, h("div", { className: "grow" }, h("span", { className: "label" }, f.label), h("span", { className: "meta" }, f.reasoning)));
		}
	};
	//#endregion
	//#region ../extension/src/content/index.ts
	/**
	* Content script, on every http(s) page.
	*
	* On ordinary websites it watches for forms (including ones that appear later, in single-page apps and
	* multi-step applications), shows the FormPilot control when it finds some, and fills only what the
	* person approves. Nothing is sent anywhere until the person opens FormPilot on that page.
	*
	* On the FormPilot web app itself it does one thing: receive the connection token from the
	* "Connect browser extension" page.
	*/
	var RESCAN_DELAY_MS = 600;
	function appOrigin(status) {
		try {
			return new URL(status?.appUrl ?? "http://localhost:5173").origin;
		} catch {
			return new URL(DEFAULT_APP_URL).origin;
		}
	}
	/** On the FormPilot app: hand the token from the connect page to the service worker. */
	function bridgeToApp() {
		document.documentElement.dataset.formpilotExtension = chrome.runtime.getManifest().version;
		window.addEventListener("message", async (event) => {
			if (event.source !== window || event.origin !== location.origin) return;
			const data = event.data;
			if (!data || data.source !== "formpilot-web") return;
			if (data.type === "connect" && typeof data.token === "string") {
				const reply = await send({
					type: "connect",
					token: data.token
				});
				window.postMessage({
					source: "formpilot-extension",
					type: "connect-result",
					ok: reply.ok,
					error: reply.ok ? void 0 : reply.error
				}, location.origin);
			}
		});
	}
	async function main() {
		const reply = await send({
			type: "status",
			verify: false
		});
		const status = reply.ok ? reply.data : null;
		if (location.origin === appOrigin(status)) return bridgeToApp();
		if (!status) return;
		const overlay = new Overlay(status);
		let last = "";
		const scan = () => {
			const fields = detectFields(document);
			const sig = signature(fields);
			if (sig === last) return;
			last = sig;
			overlay.setFields(fields);
		};
		scan();
		let timer = 0;
		new MutationObserver(() => {
			window.clearTimeout(timer);
			timer = window.setTimeout(scan, RESCAN_DELAY_MS);
		}).observe(document.body ?? document.documentElement, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: [
				"hidden",
				"style",
				"class",
				"disabled",
				"aria-hidden"
			]
		});
		chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
			if (message?.type !== "open-panel") return;
			last = "";
			scan();
			overlay.openPanel();
			sendResponse({ ok: true });
		});
	}
	main();
	//#endregion
})();
