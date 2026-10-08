# FormPilot browser extension

Build your profile once. Fill forms anywhere.

A Chrome / Edge (Manifest V3) extension that fills forms on any website from your FormPilot profile. It works from what each field means, not from site-specific code: there is no list of supported websites.

```
Any website → detect fields → understand them (FormPilot API) → match your profile → you review → Autofill → you submit
```

FormPilot never submits a form.

## Install (development)

1. Run the FormPilot backend and web app (see the main README).
2. Build the extension:
   ```bash
   cd frontend
   npm run build:extension
   ```
3. Open `chrome://extensions` (or `edge://extensions`), turn on **Developer mode**, click **Load unpacked** and select `extension/dist`.
4. In the FormPilot app, open **Browser Extension** (`/extension`) and click **Connect this browser**.
5. Open any website with a form. A small **FormPilot · N fields** button appears at the bottom right.

After changing the code, run `npm run build:extension` again and click the reload icon on the extension's card.

## How it works

| Part            | File                                 | Job                                                                                                                                                                                                                                      |
| --------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Field detector  | `src/core/field-detector.ts`       | Finds inputs, textareas, dropdowns, radio groups, checkboxes and uploads; reads each one's label,`aria-label`, placeholder, name/id, `autocomplete`, section heading and options. Skips hidden, password, captcha and search fields. |
| Field mapper    | `src/field-mapper/index.ts`        | Builds the request for`POST /api/autofill/suggest` and decides what can be filled as is. Meaning is worked out on the server by FormPilot's existing semantic mapping and RAG.                                                         |
| Autofill engine | `src/core/autofill-engine.ts`      | Writes values through the native setter and fires`input`, `change` and `blur`, so React, Vue and Angular sites see them. Picks dropdown and radio options, formats dates for the field, attaches files.                            |
| API client      | `src/api-client/index.ts`          | Calls the FormPilot API with the extension's token.                                                                                                                                                                                      |
| Service worker  | `src/background/service-worker.ts` | The only part that talks to the API. Stores the token.                                                                                                                                                                                   |
| Content script  | `src/content/`                     | Watches pages with a`MutationObserver` (forms that load later, multi-step applications), shows the button and the review panel in a closed shadow root.                                                                                |
| Popup           | `src/popup/`                       | Connection status,**Find fields on this page**, settings.                                                                                                                                                                          |

The in-app **Use Anywhere** demo (`/anywhere`) imports the same `src/core` code.

## What the panel shows

- **Ready to fill**: confident matches with source and confidence (≥ 90% safe match, 75–90% review recommended). Ticked by default, except sensitive ones (date of birth, address, ID numbers), which you tick yourself.
- **Needs your review**: possible matches (50–75%), conflicts between your documents, Smart Answers for open questions, documents to attach, and dates whose format the page doesn't state. Each has **Use**, **Choose another** or **Skip**.
- **Not in your profile**: nothing is invented. Enter it manually and optionally save it to your profile for next time.
- **Left to you**: consent and declaration checkboxes.

## Security

- **Connection:** the extension holds a revocable token created by the web app; no password or API key is ever stored in it. The token can only read your profile and documents, get suggestions and Smart Answers, and save a value you typed. It expires after 90 days and stops working when you disconnect the browser or change your password.
- **What is sent:** only field metadata and the page's origin, and only after you open FormPilot on that page. Never values already typed into the page, never the page's other text.
- **What FormPilot never does on its own:** fill uncertain or sensitive fields, upload files, tick consent boxes, or submit a form.
- **Logging:** no personal data is logged.

## Settings (popup)

- **FormPilot app address:** defaults to `http://localhost:5173`. For a deployed FormPilot, enter its address; the browser asks for permission to reach it.
- **Show the FormPilot button on pages with forms:** turn off to use FormPilot only from the popup.
- **Hide on this site:** in the panel's footer.
