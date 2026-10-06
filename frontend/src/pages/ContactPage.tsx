import { useState, type FormEvent } from 'react'
import { api, ApiError } from '../lib/api'
import { validateEmail, validateRequired } from '../lib/utils'
import { usePageMeta } from '../hooks/usePageMeta'
import { CONTACT_EMAIL, GITHUB_URL } from '../config/site'
import { Alert, TextArea, TextField } from '../components/ui/FormControls'
import { Button } from '../components/ui/Button'
import { Honeypot } from '../components/ui/Honeypot'
import { Container } from '../components/ui/primitives'

export function ContactPage() {
  usePageMeta({ title: 'Contact', path: '/contact', description: 'Send a question or feedback about FormPilot.' })
  const [values, setValues] = useState({ name: '', email: '', message: '' })
  const [website, setWebsite] = useState('')
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [formError, setFormError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const next = {
      name: validateRequired(values.name, 'Name'),
      email: validateEmail(values.email),
      message: values.message.trim().length < 10 ? 'Write a message of at least 10 characters.' : undefined,
    }
    setErrors(next)
    if (Object.values(next).some(Boolean)) return
    setStatus('sending')
    try {
      await api.contact.send({ name: values.name.trim(), email: values.email.trim(), message: values.message.trim(), website })
      setStatus('sent')
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
      setStatus('idle')
    }
  }

  return (
    <Container className="grid grid-cols-[minmax(0,1fr)] gap-12 py-14 sm:py-20 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-20 lg:py-28">
      <div>
        <p className="eyebrow">Contact</p>
        <h1 className="heading mt-3 text-[38px] text-ink sm:text-[48px]">Get in touch.</h1>
        <p className="mt-5 max-w-md text-[17px] leading-relaxed text-muted">
          Send a question or feedback about FormPilot, or reach out directly by email.
        </p>
        <dl className="mt-8 space-y-4 text-[15px]">
          <div>
            <dt className="text-[13px] text-subtle">Email</dt>
            <dd>
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-ink hover:text-accent">
                {CONTACT_EMAIL}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-[13px] text-subtle">GitHub</dt>
            <dd>
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="text-ink hover:text-accent">
                {GITHUB_URL.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
              </a>
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-[var(--radius-panel)] border border-line bg-surface p-6 sm:p-8">
        {status === 'sent' ? (
          <Alert tone="success" title="Message sent">
            Thanks, {values.name.split(' ')[0]}. Your message was received. Replies go to {values.email}.
          </Alert>
        ) : (
          <form noValidate onSubmit={onSubmit} className="relative space-y-5">
            <Honeypot value={website} onChange={setWebsite} />
            {formError && <Alert tone="danger" title="Your message wasn’t sent">{formError}</Alert>}
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField label="Name" autoComplete="name" value={values.name} error={errors.name} onChange={(e) => setValues({ ...values, name: e.target.value })} />
              <TextField
                label="Email"
                type="email"
                autoComplete="email"
                value={values.email}
                error={errors.email}
                onChange={(e) => setValues({ ...values, email: e.target.value })}
              />
            </div>
            <TextArea label="Message" value={values.message} error={errors.message} onChange={(e) => setValues({ ...values, message: e.target.value })} />
            <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={status === 'sending'}>
              {status === 'sending' ? 'Sending…' : 'Send message'}
            </Button>
          </form>
        )}
      </div>
    </Container>
  )
}
