import { Container, Section, SectionHeader } from '../ui/primitives'

const CASES = [
  { name: 'Job applications', fields: 'Name, contact details, degree, recent experience, skills, LinkedIn and GitHub' },
  { name: 'Scholarships', fields: 'Name, date of birth, degree, institution and graduation year' },
  { name: 'University admissions', fields: 'Name, date of birth, contact details, degree and institution' },
  { name: 'Government and professional forms', fields: 'Name, date of birth, contact details and qualifications' },
]

export function UseCases() {
  return (
    <Section labelledBy="usecases-title" className="border-t border-line">
      <Container>
        <SectionHeader
          id="usecases-title"
          eyebrow="Where it helps"
          title="Wherever the same questions come up."
          description="The details FormPilot extracts today cover the questions these applications ask most often."
        />
        <table className="mt-12 w-full border-collapse text-left">
          <caption className="sr-only">Application types and the profile details FormPilot can reuse for them</caption>
          <thead>
            <tr className="border-b border-ink">
              <th scope="col" className="pb-3 text-[13px] font-medium text-muted">Application</th>
              <th scope="col" className="hidden pb-3 text-[13px] font-medium text-muted sm:table-cell">Details FormPilot can fill</th>
            </tr>
          </thead>
          <tbody>
            {CASES.map((c) => (
              <tr key={c.name} className="border-b border-line">
                <th scope="row" className="py-5 pr-8 align-top text-[17px] font-medium text-ink sm:w-[38%]">
                  {c.name}
                  <span className="mt-1.5 block text-[15px] leading-relaxed font-normal text-muted sm:hidden">{c.fields}</span>
                </th>
                <td className="hidden py-5 align-top text-[16px] leading-relaxed text-muted sm:table-cell">{c.fields}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Container>
    </Section>
  )
}
