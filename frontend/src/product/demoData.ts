/**
 * Demo Mode dataset: a fictional applicant, Ritesh Kumar, with documents, applications and history.
 * Application fields are not hard-coded: they are produced by running the matcher over the profile.
 */
import { mapField } from './matcher'
import type { ActivityItem, Application, ApplicationField, ApplicationType, DocumentItem, ProfileField, WorkspaceData } from './types'

export const DEMO_PROFILE: ProfileField[] = [
  { key: 'full_name', label: 'Full name', section: 'personal', value: 'Ritesh Kumar', source: 'Resume.pdf', confidence: 0.99, verified: true },
  { key: 'date_of_birth', label: 'Date of birth', section: 'personal', value: '12 May 2003', source: 'National_ID.pdf', confidence: 0.98, verified: true },
  { key: 'nationality', label: 'Nationality', section: 'personal', value: 'Indian', source: 'National_ID.pdf', confidence: 0.97, verified: true },
  { key: 'email', label: 'Email', section: 'contact', value: 'ritesh@example.com', source: 'Resume.pdf', confidence: 0.99, verified: true },
  { key: 'phone', label: 'Phone', section: 'contact', value: '+91 98765 43210', source: 'Resume.pdf', confidence: 0.95, verified: true },
  { key: 'address', label: 'Address', section: 'contact', value: 'Bengaluru, Karnataka, India', source: 'National_ID.pdf', confidence: 0.9, verified: true },
  { key: 'emergency_contact', label: 'Emergency contact', section: 'contact', value: '', source: null, confidence: 0, verified: false },
  { key: 'highest_qualification', label: 'Highest qualification', section: 'education', value: 'B.Tech in Computer Science', source: 'Degree_Certificate.pdf', confidence: 0.98, verified: true },
  { key: 'university', label: 'University', section: 'education', value: 'Northfield Institute of Technology', source: 'Degree_Certificate.pdf', confidence: 0.97, verified: true },
  {
    key: 'graduation_date',
    label: 'Graduation date',
    section: 'education',
    value: '',
    source: null,
    confidence: 0,
    verified: false,
    conflict: [
      { value: 'May 2026', source: 'Resume.pdf' },
      { value: 'June 2026', source: 'Degree_Certificate.pdf' },
    ],
  },
  { key: 'cgpa', label: 'CGPA', section: 'education', value: '8.7 / 10', source: 'Semester_Transcript.pdf', confidence: 0.96, verified: true },
  {
    key: 'experience',
    label: 'Experience',
    section: 'experience',
    value: 'Research Intern, Machine Vision & Intelligence Lab (Jan 2025 to Jun 2025)',
    source: 'Experience_Letter.pdf',
    confidence: 0.94,
    verified: false,
  },
  {
    key: 'projects',
    label: 'Projects',
    section: 'experience',
    value: 'Traffic sign recognition with CNNs; campus event booking app with React and FastAPI',
    source: 'Resume.pdf',
    confidence: 0.88,
    verified: false,
  },
  {
    key: 'skills',
    label: 'Skills',
    section: 'skills',
    value: 'Python, React, FastAPI, Machine Learning, TensorFlow, PostgreSQL',
    source: 'Resume.pdf',
    confidence: 0.96,
    verified: true,
  },
  { key: 'linkedin', label: 'LinkedIn', section: 'contact', value: 'linkedin.com/in/ritesh-kumar', source: 'Resume.pdf', confidence: 0.95, verified: true },
  { key: 'github', label: 'GitHub', section: 'contact', value: 'github.com/ritesh-kumar', source: 'Resume.pdf', confidence: 0.95, verified: true },
]

const minutesAgo = (now: number, m: number) => new Date(now - m * 60_000).toISOString()

function demoDocuments(now: number): DocumentItem[] {
  return [
    {
      id: 'doc-resume', name: 'Resume.pdf', category: 'Resume', fileType: 'PDF', sizeKb: 184, pages: 2, status: 'processed', verified: true,
      uploadedAt: minutesAgo(now, 2), message: null,
      extracted: [
        { label: 'Name', value: 'Ritesh Kumar', confidence: 0.99 },
        { label: 'Email', value: 'ritesh@example.com', confidence: 0.99 },
        { label: 'Phone', value: '+91 98765 43210', confidence: 0.95 },
        { label: 'Education', value: 'B.Tech in Computer Science', confidence: 0.96 },
        { label: 'Graduation', value: 'May 2026', confidence: 0.9 },
        { label: 'Skills', value: 'Python, React, FastAPI, Machine Learning, TensorFlow, PostgreSQL', confidence: 0.96 },
        { label: 'Projects', value: 'Traffic sign recognition with CNNs; campus event booking app', confidence: 0.88 },
      ],
    },
    {
      id: 'doc-degree', name: 'Degree_Certificate.pdf', category: 'Education', fileType: 'PDF', sizeKb: 412, pages: 1, status: 'processed', verified: true,
      uploadedAt: minutesAgo(now, 62), message: null,
      extracted: [
        { label: 'Name', value: 'Ritesh Kumar', confidence: 0.98 },
        { label: 'Degree', value: 'B.Tech in Computer Science', confidence: 0.98 },
        { label: 'Organization', value: 'Northfield Institute of Technology', confidence: 0.97 },
        { label: 'Date', value: 'June 2026', confidence: 0.96 },
      ],
    },
    {
      id: 'doc-transcript', name: 'Semester_Transcript.pdf', category: 'Education', fileType: 'PDF', sizeKb: 356, pages: 3, status: 'processed', verified: true,
      uploadedAt: minutesAgo(now, 60 * 26), message: null,
      extracted: [
        { label: 'Name', value: 'Ritesh Kumar', confidence: 0.98 },
        { label: 'CGPA', value: '8.7 / 10', confidence: 0.96 },
        { label: 'Organization', value: 'Northfield Institute of Technology', confidence: 0.97 },
      ],
    },
    {
      id: 'doc-experience', name: 'Experience_Letter.pdf', category: 'Experience', fileType: 'PDF', sizeKb: 228, pages: 1, status: 'needs_review', verified: false,
      uploadedAt: minutesAgo(now, 60 * 27), message: 'The end date is partly unreadable. Check the internship dates before using them.',
      extracted: [
        { label: 'Name', value: 'Ritesh Kumar', confidence: 0.97 },
        { label: 'Role', value: 'Research Intern', confidence: 0.95 },
        { label: 'Organization', value: 'Machine Vision & Intelligence Lab', confidence: 0.94 },
        { label: 'Dates', value: 'Jan 2025 to Jun 2025', confidence: 0.71 },
      ],
    },
    {
      id: 'doc-id', name: 'National_ID.pdf', category: 'Identity', fileType: 'PDF', sizeKb: 298, pages: 1, status: 'processed', verified: true,
      uploadedAt: minutesAgo(now, 60 * 28), message: null,
      extracted: [
        { label: 'Name', value: 'Ritesh Kumar', confidence: 0.99 },
        { label: 'Date of birth', value: '12 May 2003', confidence: 0.98 },
        { label: 'Nationality', value: 'Indian', confidence: 0.97 },
        { label: 'Address', value: 'Bengaluru, Karnataka, India', confidence: 0.9 },
      ],
    },
    {
      id: 'doc-photo', name: 'Passport_Photo.jpg', category: 'Identity', fileType: 'JPG', sizeKb: 96, pages: null, status: 'processed', verified: true,
      uploadedAt: minutesAgo(now, 60 * 28), message: null, extracted: [],
    },
    {
      id: 'doc-tf', name: 'TensorFlow_Certificate.pdf', category: 'Certificates', fileType: 'PDF', sizeKb: 175, pages: 1, status: 'processed', verified: true,
      uploadedAt: minutesAgo(now, 60 * 50), message: null,
      extracted: [
        { label: 'Name', value: 'Ritesh Kumar', confidence: 0.98 },
        { label: 'Certificate', value: 'TensorFlow Developer Certificate', confidence: 0.97 },
        { label: 'Date', value: 'March 2025', confidence: 0.95 },
      ],
    },
    {
      id: 'doc-reco', name: 'Recommendation_Letter.pdf', category: 'Other', fileType: 'PDF', sizeKb: 142, pages: 1, status: 'processed', verified: false,
      uploadedAt: minutesAgo(now, 60 * 52), message: null,
      extracted: [
        { label: 'Name', value: 'Ritesh Kumar', confidence: 0.97 },
        { label: 'Organization', value: 'Northfield Institute of Technology', confidence: 0.93 },
      ],
    },
  ]
}

/** Typical field labels for each application type, worded the way real forms word them. */
export const TEMPLATE_FIELDS: Record<ApplicationType, string[]> = {
  job: [
    'Full Name', 'Email', 'Phone', 'Current Address', 'Highest Qualification', 'University', 'Graduation Date', 'CGPA',
    'Skills', 'Professional Experience', 'Projects', 'LinkedIn Profile', 'GitHub Profile', 'Emergency Contact',
  ],
  scholarship: [
    'Name of Applicant', 'Date of Birth', 'Nationality', 'Contact Email', 'Mobile Number', 'Highest Educational Qualification',
    'Name of Institution', 'Aggregate Score', 'Year of Passing', 'Family Annual Income', 'Statement of Purpose',
  ],
  admission: [
    'Full Legal Name', 'Date of Birth', 'Citizenship', 'Email Address', 'Phone Number', 'Latest Degree Earned', 'Institution',
    'GPA', 'Graduation Date', 'Research Experience', 'Statement of Purpose', 'GRE Score', 'Letters of Recommendation',
  ],
  government: ['Applicant Name', 'Date of Birth', 'Nationality', 'Residential Address', 'Mobile Number', 'Email ID', 'Emergency Contact Number'],
  custom: [],
}

/** Profile keys that a form label is known NOT to be answerable from, even if words overlap. */
const UNANSWERABLE = new Set(['Family Annual Income', 'Statement of Purpose', 'GRE Score', 'Letters of Recommendation'])

export function buildFields(labels: string[], profile: ProfileField[]): ApplicationField[] {
  return labels.map((label) => {
    const field = mapField(label, profile)
    if (UNANSWERABLE.has(label)) {
      return {
        ...field,
        section: 'Additional Information',
        value: '',
        status: 'missing' as const,
        profileKey: null,
        source: null,
        confidence: 0,
        reasoning: `“${label}” asks for something only you can provide. It isn't in any of your documents.`,
      }
    }
    return field
  })
}

export function documentFields(names: string[]): ApplicationField[] {
  return names.map((name, i) => ({
    id: `docf-${name}-${i}`,
    section: 'Documents',
    label: name.replace(/_/g, ' ').replace(/\.\w+$/, ''),
    required: true,
    value: name,
    status: 'mapped' as const,
    profileKey: null,
    source: name,
    confidence: 1,
    reasoning: `Attached from your documents. ${name} is processed and verified.`,
    candidates: [],
  }))
}

function application(
  id: string,
  title: string,
  organization: string,
  type: ApplicationType,
  status: Application['status'],
  fields: ApplicationField[],
  now: number,
  createdMin: number,
  updatedMin: number,
  extra: Partial<Application> = {},
): Application {
  return {
    id, title, organization, type, status, fields,
    createdAt: minutesAgo(now, createdMin),
    updatedAt: minutesAgo(now, updatedMin),
    reference: null,
    preparedAt: null,
    ...extra,
  }
}

/** Fills every open issue, as if the applicant had already finished this one. */
function completed(fields: ApplicationField[]): ApplicationField[] {
  return fields.map((f) =>
    f.status === 'conflict'
      ? { ...f, value: 'June 2026', source: 'Degree_Certificate.pdf', status: 'confirmed', confidence: 1, reasoning: 'Confirmed by you.' }
      : f.status === 'missing'
        ? { ...f, value: 'Sunita Kumar, +91 91234 56780', source: null, status: 'confirmed', confidence: 1, reasoning: 'Entered by you.' }
        : f,
  )
}

export function createDemoWorkspace(now = Date.now()): WorkspaceData {
  const profile = DEMO_PROFILE.map((f) => ({ ...f, conflict: f.conflict?.map((c) => ({ ...c })) }))

  const applications: Application[] = [
    application(
      'app-swe', 'Software Engineer', 'Northwind Labs', 'job', 'needs_review',
      [...buildFields(TEMPLATE_FIELDS.job, profile), ...documentFields(['Resume.pdf', 'Degree_Certificate.pdf', 'Semester_Transcript.pdf', 'Experience_Letter.pdf'])],
      now, 60 * 3, 15,
    ),
    application('app-scholarship', 'Merit Scholarship 2026', 'National Merit Trust', 'scholarship', 'needs_review',
      buildFields(TEMPLATE_FIELDS.scholarship, profile), now, 60 * 30, 60 * 2),
    application('app-grad', 'MS in Computer Science', 'Westbrook University', 'admission', 'draft',
      buildFields(TEMPLATE_FIELDS.admission, profile), now, 60 * 48, 60 * 20),
    application('app-research', 'Research Assistant', 'Machine Vision & Intelligence Lab', 'job', 'prepared',
      completed(buildFields(['Full Name', 'Email', 'Phone', 'Highest Qualification', 'University', 'Skills', 'Professional Experience'], profile)),
      now, 60 * 72, 15, { reference: 'FP-2026-00118', preparedAt: minutesAgo(now, 15) }),
    application('app-intern', 'Data Analyst Intern', 'Brightlane Analytics', 'job', 'ready',
      buildFields(['Full Name', 'Email', 'Phone', 'University', 'CGPA', 'Skills', 'LinkedIn Profile'], profile), now, 60 * 96, 60 * 5),
    application('app-passport', 'Passport Renewal', 'Regional Passport Office', 'government', 'draft',
      buildFields(TEMPLATE_FIELDS.government, profile), now, 60 * 120, 60 * 100),
  ]

  const activity: ActivityItem[] = [
    { id: 'act-1', kind: 'information_extracted', title: 'Resume processed', detail: '7 details extracted from Resume.pdf', at: minutesAgo(now, 2) },
    { id: 'act-2', kind: 'application_approved', title: 'Application prepared', detail: 'Research Assistant at Machine Vision & Intelligence Lab', at: minutesAgo(now, 15), applicationId: 'app-research' },
    { id: 'act-3', kind: 'conflict_detected', title: 'Conflict detected in certificate', detail: 'Graduation date differs between Resume.pdf and Degree_Certificate.pdf', at: minutesAgo(now, 60) },
    { id: 'act-4', kind: 'document_uploaded', title: 'Document uploaded', detail: 'Degree_Certificate.pdf', at: minutesAgo(now, 62) },
    { id: 'act-5', kind: 'fields_mapped', title: 'Fields mapped', detail: '14 fields mapped for Software Engineer at Northwind Labs', at: minutesAgo(now, 60 * 3) },
    { id: 'act-6', kind: 'application_created', title: 'Application created', detail: 'Software Engineer at Northwind Labs', at: minutesAgo(now, 60 * 3), applicationId: 'app-swe' },
    { id: 'act-7', kind: 'profile_updated', title: 'Profile updated', detail: 'CGPA added from Semester_Transcript.pdf', at: minutesAgo(now, 60 * 26) },
  ]

  return {
    user: { name: 'Ritesh Kumar', email: 'ritesh@example.com' },
    profile,
    documents: demoDocuments(now),
    applications,
    activity,
  }
}
