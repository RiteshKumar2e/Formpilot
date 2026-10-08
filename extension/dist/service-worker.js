var STORAGE = {
	token: "fpToken",
	appUrl: "fpAppUrl",
	showButton: "fpShowButton",
	hiddenSites: "fpHiddenSites"
};
//#endregion
//#region ../extension/src/api-client/index.ts
/**
* API client used by the service worker. It holds the extension's token (created in the FormPilot web
* app, revocable there) and talks to the FormPilot API at the configured app URL. No API secret is
* ever shipped in the extension.
*/
var ApiError = class extends Error {
	status;
	constructor(message, status) {
		super(message);
		this.status = status;
	}
};
async function settings() {
	const stored = await chrome.storage.local.get([STORAGE.appUrl, STORAGE.token]);
	return {
		appUrl: stored[STORAGE.appUrl] || "http://localhost:5173",
		token: stored[STORAGE.token] || null
	};
}
async function raw(path, init = {}) {
	const { appUrl, token } = await settings();
	if (!token) throw new ApiError("Connect FormPilot to your account first.", 401);
	let res;
	try {
		res = await fetch(`${appUrl.replace(/\/$/, "")}/api${path}`, {
			...init,
			credentials: "omit",
			headers: {
				Accept: "application/json",
				Authorization: `Bearer ${token}`,
				...init.body ? { "Content-Type": "application/json" } : {},
				...init.headers
			}
		});
	} catch {
		throw new ApiError(`Couldn’t reach FormPilot at ${appUrl}. Is it running?`, 0);
	}
	if (res.status === 401) {
		await chrome.storage.local.remove(STORAGE.token);
		throw new ApiError("Your FormPilot connection ended. Connect again from the FormPilot app.", 401);
	}
	if (!res.ok) {
		let message = "Something went wrong. Please try again.";
		try {
			const body = await res.json();
			if (typeof body?.detail === "string") message = body.detail;
		} catch {}
		throw new ApiError(message, res.status);
	}
	return res;
}
async function api(path, init = {}) {
	const res = await raw(path, init);
	if (res.status === 204) return void 0;
	return await res.json();
}
async function apiBlob(path) {
	return (await raw(path)).blob();
}
//#endregion
//#region ../extension/src/background/service-worker.ts
/**
* Service worker: the only part of the extension that talks to the FormPilot API. Content scripts run
* inside other websites, so they ask through messages instead of holding the token themselves.
* Personal data is never logged.
*/
/** Settings and connection state. `verify` also checks the token with the API (the popup does). */
async function status(verify = true) {
	const stored = await chrome.storage.local.get([STORAGE.showButton, STORAGE.hiddenSites]);
	const { appUrl, token } = await settings();
	const base = {
		connected: false,
		appUrl,
		showButton: stored[STORAGE.showButton] !== false,
		hiddenSites: stored[STORAGE.hiddenSites] ?? []
	};
	if (!token) return base;
	if (!verify) return {
		...base,
		connected: true
	};
	try {
		const me = await api("/auth/me");
		return {
			...base,
			connected: true,
			email: me.email,
			name: me.full_name
		};
	} catch (err) {
		if (err instanceof ApiError && err.status === 401) return base;
		return {
			...base,
			connected: true
		};
	}
}
function toBase64(buffer) {
	const bytes = new Uint8Array(buffer);
	let binary = "";
	for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
	return btoa(binary);
}
/** Only the configured FormPilot app may hand the extension a token. */
async function fromApp(sender) {
	const { appUrl } = await settings();
	const url = sender.tab?.url ?? sender.url;
	if (!url) return false;
	try {
		return new URL(url).origin === new URL(appUrl).origin;
	} catch {
		return false;
	}
}
async function handle(message, sender) {
	switch (message.type) {
		case "status": return status(message.verify !== false);
		case "suggest": return api("/autofill/suggest", {
			method: "POST",
			body: JSON.stringify({
				fields: message.fields,
				page_url: message.pageOrigin,
				page_title: message.pageTitle.slice(0, 300),
				organization: message.organization
			})
		});
		case "answer": return api("/answers/suggest", {
			method: "POST",
			body: JSON.stringify({
				question: message.question,
				organization: message.organization
			})
		});
		case "download": {
			const doc = (await api("/documents")).find((d) => d.id === message.documentId);
			if (!doc) throw new ApiError("That document is no longer in your vault.", 404);
			const blob = await apiBlob(`/documents/${encodeURIComponent(doc.id)}/file`);
			return {
				name: doc.filename,
				mime: doc.content_type,
				base64: toBase64(await blob.arrayBuffer())
			};
		}
		case "save-profile":
			await api("/profile/conflicts/resolve", {
				method: "POST",
				body: JSON.stringify({
					key: message.key,
					value: message.value
				})
			});
			return;
		case "save-answer":
			await api("/answers", {
				method: "POST",
				body: JSON.stringify({
					question: message.question,
					answer: message.answer
				})
			});
			return;
		case "open-connect": {
			const { appUrl } = await settings();
			await chrome.tabs.create({ url: `${appUrl.replace(/\/$/, "")}/extension` });
			return;
		}
		case "connect":
			if (!await fromApp(sender)) throw new ApiError("Only the FormPilot app can connect this extension.", 403);
			if (!/^fpx_[\w-]{20,}$/.test(message.token)) throw new ApiError("That connection code isn’t valid.", 400);
			await chrome.storage.local.set({ [STORAGE.token]: message.token });
			return status();
		case "disconnect":
			await chrome.storage.local.remove(STORAGE.token);
			return;
	}
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	handle(message, sender).then((data) => sendResponse({
		ok: true,
		data
	}), (err) => sendResponse({
		ok: false,
		error: err instanceof ApiError ? err.message : "Something went wrong in FormPilot.",
		status: err instanceof ApiError ? err.status : void 0
	}));
	return true;
});
chrome.runtime.onInstalled.addListener(({ reason }) => {
	if (reason === "install") handle({ type: "open-connect" }, {});
});
//#endregion
