import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { CONTACT_EMAIL } from '../config/site'
import { Drawer } from './ui'
import { useWorkspace } from './workspace'

const STEPS: { text: string; to?: string }[] = [
  { text: 'Overview: profile completion, applications and recent activity', to: '/dashboard' },
  { text: 'My Profile: every value with its source document and verification', to: '/profile' },
  { text: 'Documents: open Resume.pdf and Degree_Certificate.pdf to see what was extracted', to: '/documents' },
  { text: 'Applications: open “Software Engineer” at Northwind Labs', to: '/applications/app-swe' },
  { text: 'Select a mapped field to see its source, confidence and reasoning', to: '/applications/app-swe' },
  { text: 'Field Mapping: how each form question was matched to your profile', to: '/mapping?app=app-swe' },
  { text: 'Validation: resolve the graduation date conflict and add the emergency contact', to: '/validation?app=app-swe' },
  { text: 'Review: check the 100% ready application and approve it', to: '/applications/app-swe/review' },
  { text: 'Back on Overview and Activity, see the updated status and history', to: '/activity' },
]

export function DemoGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mode } = useWorkspace()
  return (
    <Drawer open={open} onClose={onClose} title={mode === 'demo' ? 'Demo guide' : 'Help & Support'}>
      {mode === 'demo' && (
        <>
          <p className="text-[15px] text-muted">A two to three minute walkthrough of the complete FormPilot flow.</p>
          <ol className="mt-5 space-y-1">
            {STEPS.map((s, i) => (
              <li key={s.text}>
                <Link to={s.to ?? '/dashboard'} onClick={onClose} className="flex gap-3 rounded-[var(--radius-control)] px-2 py-2.5 hover:bg-canvas">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-[12px] text-accent">{i + 1}</span>
                  <span className="text-[14px] text-ink">{s.text}</span>
                </Link>
              </li>
            ))}
          </ol>

          <div className="mt-6 rounded-[var(--radius-panel)] border border-line bg-canvas p-4 text-[14px] leading-relaxed text-ink-2">
            <p className="font-medium text-ink">About Demo Mode</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>Ritesh Kumar and all documents are fictional sample data, stored only in this browser.</li>
              <li>Field mapping runs for real in your browser: every form question is scored against every profile field, and the top candidates are shown.</li>
              <li>Document processing stages are simulated in Demo Mode. Signed-in accounts process real files through the FormPilot API.</li>
              <li>Nothing is ever submitted. Approving marks an application “Ready for Submission”.</li>
            </ul>
          </div>
        </>
      )}

      <div className="mt-6">
        <p className="text-[15px] font-medium text-ink">Need help?</p>
        <p className="mt-1 text-[14px] text-muted">Questions about FormPilot or this demo:</p>
        <a href={`mailto:${CONTACT_EMAIL}`} className="mt-3 inline-flex items-center gap-2 text-[14px] text-accent underline underline-offset-2">
          <Mail className="size-4" aria-hidden />
          {CONTACT_EMAIL}
        </a>
      </div>
    </Drawer>
  )
}
