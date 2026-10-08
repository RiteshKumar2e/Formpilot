(function() {
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
	var STORAGE = {
		token: "fpToken",
		appUrl: "fpAppUrl",
		showButton: "fpShowButton",
		hiddenSites: "fpHiddenSites"
	};
	//#endregion
	//#region ../extension/src/popup/popup.ts
	/** Toolbar popup: connection status, "Find fields on this page", and settings. */
	var main = document.getElementById("main");
	function el(tag, attrs = {}, ...children) {
		const node = document.createElement(tag);
		for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
		node.append(...children);
		return node;
	}
	function button(label, className, onClick) {
		const b = el("button", {
			class: className,
			type: "button"
		}, label);
		b.addEventListener("click", onClick);
		return b;
	}
	async function findFields(message) {
		const [tab] = await chrome.tabs.query({
			active: true,
			currentWindow: true
		});
		if (!tab?.id) return;
		try {
			await chrome.tabs.sendMessage(tab.id, { type: "open-panel" });
			window.close();
		} catch {
			message.textContent = "FormPilot can’t run on this page. Try it on a website with a form (reload the page if you just installed FormPilot).";
		}
	}
	/** Saves the FormPilot app URL. Addresses other than localhost need the browser's permission first. */
	async function saveAppUrl(value, message) {
		let origin;
		try {
			origin = new URL(value).origin;
		} catch {
			message.textContent = "Enter a full address, like https://formpilot.example.com";
			return;
		}
		if (!(await chrome.permissions.contains({ origins: [`${origin}/*`] }) || await chrome.permissions.request({ origins: [`${origin}/*`] }))) {
			message.textContent = "FormPilot needs permission to reach that address.";
			return;
		}
		await chrome.storage.local.set({ [STORAGE.appUrl]: origin });
		await chrome.storage.local.remove(STORAGE.token);
		render();
	}
	async function render() {
		const reply = await send({
			type: "status",
			verify: true
		});
		main.replaceChildren();
		if (!reply.ok) {
			main.append(el("p", { class: "error" }, reply.error));
			return;
		}
		const status = reply.data;
		const message = el("p", {
			class: "error",
			role: "alert"
		});
		if (status.connected) {
			main.append(el("div", { class: "status ok" }, `Connected as ${status.email ?? "your FormPilot account"}`));
			main.append(button("Find fields on this page", "primary", () => void findFields(message)));
		} else main.append(el("div", { class: "status" }, "Not connected yet"), el("p", { class: "muted" }, "Sign in to the FormPilot app and connect this browser. Your profile stays in your FormPilot account."), button("Connect FormPilot", "primary", () => void send({ type: "open-connect" }).then(() => window.close())));
		main.append(message);
		const show = el("input", {
			type: "checkbox",
			id: "show"
		});
		show.checked = status.showButton;
		show.addEventListener("change", () => void chrome.storage.local.set({ [STORAGE.showButton]: show.checked }));
		const url = el("input", {
			type: "url",
			id: "url",
			value: status.appUrl,
			"aria-label": "FormPilot app address"
		});
		const settings = el("details", {}, el("summary", {}, "Settings"), el("div", {}, el("label", { for: "show" }, show, "Show the FormPilot button on pages with forms"), el("p", { class: "muted" }, "FormPilot app address"), url, button("Save address", "ghost", () => void saveAppUrl(url.value.trim() || "http://localhost:5173", message)), status.hiddenSites.length ? button(`Show again on ${status.hiddenSites.length} hidden site(s)`, "link", () => void chrome.storage.local.set({ [STORAGE.hiddenSites]: [] }).then(render)) : el("span"), status.connected ? button("Disconnect this browser", "link", () => void send({ type: "disconnect" }).then(render)) : el("span")));
		main.append(settings);
	}
	render();
	//#endregion
})();
