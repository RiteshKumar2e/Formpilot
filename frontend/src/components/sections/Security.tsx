import { Container, Section, SectionHeader } from '../ui/primitives'

const ITEMS = [
  { title: 'Encrypted storage', body: 'Uploaded files are encrypted with a server-side key before they are written to disk.' },
  { title: 'Encrypted connections', body: 'In production, every request is redirected to HTTPS and browsers are told to stay on it.' },
  { title: 'Careful sign-in', body: 'Passwords are hashed with scrypt. Sessions use an httpOnly cookie that expires after 12 hours.' },
  { title: 'Private by account', body: 'Each request is checked against the signed-in account, so your documents are visible only to you.' },
  { title: 'Abuse limits', body: 'Sign-in, sign-up, uploads and the contact form are rate limited for each IP address.' },
  { title: 'Real deletion', body: 'Deleting a document removes its file and extracted details. Deleting your account removes everything.' },
]

export function Security() {
  return (
    <Section id="security" labelledBy="security-title" className="bg-band">
      <Container>
        <SectionHeader
          id="security-title"
          eyebrow="Security"
          title="How FormPilot handles your data."
          description="Applications carry your identity, education and history. These protections are part of how FormPilot is built today."
        />
        <ul className="mt-14 grid gap-x-12 sm:grid-cols-2 lg:grid-cols-3">
          {ITEMS.map((item) => (
            <li key={item.title} className="border-t border-line-strong py-6">
              <h3 className="text-[17px] font-medium text-ink">{item.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{item.body}</p>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  )
}
