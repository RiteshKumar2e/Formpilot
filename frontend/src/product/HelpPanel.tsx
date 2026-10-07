import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { CONTACT_EMAIL } from '../config/site'
import { Drawer } from './ui'

const TIPS: { text: string; to: string }[] = [
  { text: 'Upload your resume and certificates to build your profile', to: '/documents?upload=1' },
  { text: 'Check your profile and resolve any conflicting values', to: '/profile' },
  { text: 'Create an application and paste the form’s field labels', to: '/applications/new' },
  { text: 'Fix anything flagged in Validation', to: '/validation' },
  { text: 'Review every answer and approve when you’re ready', to: '/applications' },
]

export function HelpPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Drawer open={open} onClose={onClose} title="Help & Support">
      <p className="text-[15px] font-medium text-ink">Getting started</p>
      <ol className="mt-3 space-y-1">
        {TIPS.map((t, i) => (
          <li key={t.text}>
            <Link to={t.to} onClick={onClose} className="flex gap-3 rounded-[var(--radius-control)] px-2 py-2.5 hover:bg-canvas">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-[12px] text-accent">{i + 1}</span>
              <span className="text-[14px] text-ink">{t.text}</span>
            </Link>
          </li>
        ))}
      </ol>

      <div className="mt-6 rounded-[var(--radius-panel)] border border-line bg-canvas p-4 text-[14px] leading-relaxed text-ink-2">
        <p className="font-medium text-ink">Good to know</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>Documents and your profile are stored in your FormPilot account. Files are encrypted at rest.</li>
          <li>Applications are saved in this browser for now.</li>
          <li>FormPilot never submits anything. Approving marks an application “Ready for Submission”.</li>
        </ul>
      </div>

      <div className="mt-6">
        <p className="text-[15px] font-medium text-ink">Need help?</p>
        <a href={`mailto:${CONTACT_EMAIL}`} className="mt-2 inline-flex items-center gap-2 text-[14px] text-accent underline underline-offset-2">
          <Mail className="size-4" aria-hidden />
          {CONTACT_EMAIL}
        </a>
      </div>
    </Drawer>
  )
}
