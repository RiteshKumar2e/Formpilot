import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { usePageMeta } from '../hooks/usePageMeta'
import { Container } from '../components/ui/primitives'
import { CONTACT_EMAIL } from '../config/site'

/** Placeholder for business details that must be supplied before launch. */
function Todo({ children }: { children: ReactNode }) {
  return <mark className="bg-warning-soft px-1 text-warning">[{children}]</mark>
}

function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Container className="py-16 sm:py-24">
      <article className="mx-auto max-w-[680px]">
        <h1 className="heading text-[36px] text-ink sm:text-[46px]">{title}</h1>
        <div role="note" className="mt-6 border-l-2 border-warning bg-warning-soft px-4 py-3 text-[15px] text-ink-2">
          <p className="font-medium text-ink">Draft for review</p>
          <p className="mt-0.5">
            This page describes how FormPilot works today. It has not been reviewed by a lawyer. Highlighted items need
            details from the business before launch.
          </p>
        </div>
        <div className="mt-10 space-y-9 text-[16px] leading-relaxed text-ink-2 [&_h2]:mb-2 [&_h2]:text-[20px] [&_h2]:font-medium [&_h2]:tracking-[-0.01em] [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5 [&_p+p]:mt-3">
          {children}
        </div>
      </article>
    </Container>
  )
}

export function PrivacyPage() {
  usePageMeta({ title: 'Privacy Policy', path: '/privacy', description: 'How FormPilot collects, uses and protects your information.' })
  return (
    <LegalLayout title="Privacy Policy">
      <section>
        <h2>Who we are</h2>
        <p>
          FormPilot is operated by <Todo>legal name of the operator</Todo>, <Todo>registered address</Todo>. You can reach us
          at <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent underline underline-offset-2">{CONTACT_EMAIL}</a>.
        </p>
      </section>
      <section>
        <h2>What we collect</h2>
        <ul>
          <li>Account details: your name, email address and a hashed password.</li>
          <li>Documents you upload, and the details FormPilot extracts from them.</li>
          <li>Details you add or confirm in your Master Profile, your saved applications, templates and common answers.</li>
          <li>Choices you make in FormPilot, such as which value to keep when two documents disagree.</li>
          <li>
            If you use the browser extension: when you open FormPilot on a website, the labels, names, types and options of
            that page’s form fields and the website’s address (domain only). Never the page’s other text or anything already
            typed into it.
          </li>
          <li>Messages you send through the contact form: your name, email address and message.</li>
          <li>Server logs that include IP addresses, used to apply rate limits and keep the service running.</li>
        </ul>
      </section>
      <section>
        <h2>How we use it</h2>
        <p>
          Your documents and profile are used to show you your profile and to answer the form fields you ask FormPilot to fill.
          Contact messages are used to reply to you. Your email address is used for account emails such as password reset
          links. We do not sell your data and do not use it to train AI models.
        </p>
      </section>
      <section>
        <h2>Service providers</h2>
        <ul>
          <li>
            <strong>Groq</strong> (AI processing), when enabled: the text of a document you upload, the form fields you ask
            FormPilot to fill and the relevant parts of your profile are sent to Groq to extract details and suggest answers.
          </li>
          <li>
            <strong>Database and vector database</strong> (<Todo>PostgreSQL provider</Todo>, Qdrant): store your account, profile and the encrypted details described below.
          </li>
          <li>
            <strong>Email provider</strong> (<Todo>for example Google Gmail</Todo>): delivers password reset emails.
          </li>
          <li>
            <strong>Hosting</strong>: <Todo>hosting provider and region</Todo>.
          </li>
        </ul>
        <p>Text embeddings used for matching are computed on FormPilot’s own server.</p>
      </section>
      <section>
        <h2>Where it is stored</h2>
        <p>
          Uploaded files are encrypted before they are written to disk. Extracted details, applications, templates and saved
          answers are encrypted before they are written to the database. Passwords are stored only as scrypt hashes.
        </p>
      </section>
      <section>
        <h2>How long we keep it</h2>
        <p>
          Documents, extracted details and your profile are kept until you delete them or delete your account. Retention
          for contact messages and server logs: <Todo>retention period</Todo>.
        </p>
      </section>
      <section>
        <h2>Your choices</h2>
        <p>
          You can delete any document from your workspace, which also removes the details extracted from it. You can disconnect
          the browser extension at any time from the Browser Extension page. You can delete your account from your workspace,
          which permanently removes your profile, documents and extracted data.
        </p>
      </section>
      <section>
        <h2>Cookies and analytics</h2>
        <p>
          FormPilot sets one essential cookie, <code className="font-mono text-[14px]">fp_session</code>, to keep you signed
          in. It is httpOnly. It ends when you close your browser, or after 30 days if you choose “Remember me”. Your cookie
          choice is remembered in your browser’s local storage. The browser extension keeps its connection token in the
          extension’s own storage; disconnecting or changing your password ends it.
        </p>
        <p>
          If analytics is enabled on this site and you accept it, page visits are counted with Plausible, which does not use
          cookies. You can change your choice at any time from “Cookie settings” in the footer.
        </p>
      </section>
      <section>
        <h2>Changes</h2>
        <p>
          The date of the latest change will be shown here: <Todo>effective date</Todo>.
        </p>
      </section>
    </LegalLayout>
  )
}

export function TermsPage() {
  usePageMeta({ title: 'Terms of Service', path: '/terms', description: 'The terms that apply to using FormPilot.' })
  return (
    <LegalLayout title="Terms of Service">
      <section>
        <h2>The service</h2>
        <p>
          FormPilot extracts details from documents you upload, keeps them in a profile, and suggests answers for form fields,
          in FormPilot and, through the browser extension, on other websites. FormPilot does not submit forms on your behalf.
        </p>
      </section>
      <section>
        <h2>Your responsibility for answers</h2>
        <p>
          Extracted details and suggested answers can be wrong, including answers written by AI. Each one shows its source and a
          confidence score so you can check it. You are responsible for reviewing every value FormPilot fills, on any website,
          before you submit.
        </p>
      </section>
      <section>
        <h2>Your content</h2>
        <p>
          You keep ownership of the documents and information you upload. You allow FormPilot to store and process them only
          to provide the service to you. See the <Link to="/privacy" className="text-accent underline underline-offset-2">Privacy Policy</Link> for
          details.
        </p>
      </section>
      <section>
        <h2>Acceptable use</h2>
        <ul>
          <li>Upload only documents that belong to you or that you are authorized to use.</li>
          <li>Do not use FormPilot to prepare false or misleading applications.</li>
          <li>Do not try to access other users’ data or disrupt the service.</li>
          <li>Follow the rules of the websites where you use the browser extension.</li>
        </ul>
      </section>
      <section>
        <h2>Account closure</h2>
        <p>You can delete your account at any time from your workspace.</p>
      </section>
      <section>
        <h2>Still to be defined</h2>
        <ul>
          <li>
            Operator and governing law: <Todo>legal entity and jurisdiction</Todo>
          </li>
          <li>
            Pricing and payment terms, if any: <Todo>to be confirmed</Todo>
          </li>
          <li>
            Liability and warranty terms: <Todo>requires legal review</Todo>
          </li>
          <li>
            Effective date: <Todo>effective date</Todo>
          </li>
        </ul>
      </section>
    </LegalLayout>
  )
}
