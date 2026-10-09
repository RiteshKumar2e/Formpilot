import { usePageMeta } from '../hooks/usePageMeta'
import { Button } from '../components/ui/Button'
import { Container } from '../components/ui/primitives'

const PRINCIPLES = [
  {
    title: 'Accuracy comes first',
    body: 'When FormPilot isn’t sure, it says so. Ambiguous dates and conflicting values are raised for you to decide.',
  },
  {
    title: 'Every answer has a source',
    body: 'Each value FormPilot fills links back to the document it came from, so you can check it in seconds.',
  },
  {
    title: 'You make the final call',
    body: 'FormPilot prepares answers. You review them, and you decide what gets submitted and where.',
  },
]

const PIPELINE = [
  { stage: 'Read', status: 'Built', body: 'Reads the text layer of PDFs. Text recognition for scans and photos is available when OCR is installed on the server.' },
  { stage: 'Extract', status: 'Built', body: 'Pattern rules and a language model (on Groq) read names, contact details, dates, degrees, institutions, experience, skills and profile links. Every AI answer must be found in the document, or it is discarded.' },
  { stage: 'Validate', status: 'Built', body: 'Cross-checks every detail between documents, scores confidence, and flags conflicts and ambiguous date formats.' },
  { stage: 'Index', status: 'Built', body: 'Splits each document into passages and stores their embeddings in Qdrant, a vector database, for semantic search.' },
  { stage: 'Match', status: 'Built', body: 'Maps form labels to your details by wording and by meaning (embeddings), then retrieves supporting passages and lets the language model choose each answer (RAG).' },
  { stage: 'Review', status: 'Built', body: 'Nothing is submitted for you. You review every answer, see where it came from, and approve.' },
]

export function AboutPage() {
  usePageMeta({
    title: 'About',
    path: '/about',
    description: 'Why FormPilot exists, the principles behind it, and what is built today.',
  })

  return (
    <>
      <Container className="pt-16 pb-20 sm:pt-24 lg:pt-32">
        <div className="max-w-[760px]">
          <p className="eyebrow">About</p>
          <h1 className="display mt-3 text-[42px] text-ink sm:text-[60px]">Your documents already hold the answers.</h1>
          <p className="mt-6 max-w-[620px] text-[19px] leading-relaxed text-muted">
            Students, job seekers and professionals retype the same facts into portal after portal: names, dates, degrees,
            contact details, work history. FormPilot reads those facts from the documents you already have and keeps them
            ready for the next form.
          </p>
        </div>
      </Container>

      <section aria-labelledby="principles-title" className="border-t border-line py-20 sm:py-24">
        <Container>
          <h2 id="principles-title" className="heading text-[30px] text-ink sm:text-[38px]">
            Principles
          </h2>
          <ul className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-3">
            {PRINCIPLES.map((p) => (
              <li key={p.title} className="border-t-2 border-ink pt-5">
                <h3 className="text-[18px] font-medium text-ink">{p.title}</h3>
                <p className="mt-2 text-[16px] leading-relaxed text-muted">{p.body}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="pipeline-title" className="border-t border-line py-20 sm:py-24">
        <Container>
          <div className="max-w-[640px]">
            <h2 id="pipeline-title" className="heading text-[30px] text-ink sm:text-[38px]">
              What’s built, and what’s next
            </h2>
            <p className="mt-4 text-[17px] leading-relaxed text-muted">
              FormPilot runs on a React frontend, a Python FastAPI service, a PostgreSQL database and the Qdrant vector database. Here is the document pipeline
              as it stands today.
            </p>
          </div>
          <table className="mt-10 w-full border-collapse text-left">
            <caption className="sr-only">FormPilot pipeline stages and their status</caption>
            <thead>
              <tr className="border-b border-ink text-[13px] text-muted">
                <th scope="col" className="pb-3 font-medium">Stage</th>
                <th scope="col" className="pb-3 font-medium">Status</th>
                <th scope="col" className="hidden pb-3 font-medium md:table-cell">What it does</th>
              </tr>
            </thead>
            <tbody>
              {PIPELINE.map((p) => (
                <tr key={p.stage} className="border-b border-line align-top">
                  <th scope="row" className="py-5 pr-6 text-[16px] font-medium text-ink md:w-[26%]">
                    {p.stage}
                    <span className="mt-1.5 block text-[15px] leading-relaxed font-normal text-muted md:hidden">{p.body}</span>
                  </th>
                  <td className="py-5 pr-6 md:w-[14%]">
                    <span className={p.status === 'Built' ? 'font-mono text-[13px] text-success' : 'font-mono text-[13px] text-subtle'}>
                      {p.status}
                    </span>
                  </td>
                  <td className="hidden py-5 text-[16px] leading-relaxed text-muted md:table-cell">{p.body}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-12 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-7">
            <Button to="/get-started" size="lg">
              Create your profile
            </Button>
            <Button to="/contact" variant="quiet">
              Contact
            </Button>
          </div>
        </Container>
      </section>
    </>
  )
}
