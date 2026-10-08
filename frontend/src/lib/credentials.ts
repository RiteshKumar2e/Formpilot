/**
 * Tells the browser's password manager about a successful sign-in, sign-up or password change, so it
 * offers to save the password (or update a saved one) the way it does after a classic form post.
 * Pages submit with fetch, which some browsers don't treat as a sign-in on their own.
 * Supported by Chromium browsers; elsewhere the form's autocomplete attributes do the job.
 */
export async function savePasswordCredential(email: string, password: string, name?: string): Promise<void> {
  const Ctor = (window as unknown as { PasswordCredential?: new (data: { id: string; password: string; name?: string }) => Credential })
    .PasswordCredential
  if (!Ctor || !navigator.credentials?.store) return
  try {
    await navigator.credentials.store(new Ctor({ id: email, password, name }))
  } catch {
    // The person dismissed the prompt, or the browser blocks it here.
  }
}
