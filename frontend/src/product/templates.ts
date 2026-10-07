import type { ApplicationType } from './types'

/** Typical field labels for each application type, worded the way real forms word them. */
export const TEMPLATE_FIELDS: Record<ApplicationType, string[]> = {
  job: [
    'Full Name', 'Email', 'Phone', 'Date of Birth', 'Highest Qualification', 'University', 'Graduation Year',
    'Skills', 'Professional Experience', 'LinkedIn Profile', 'GitHub Profile', 'Current Address', 'Emergency Contact',
  ],
  scholarship: [
    'Name of Applicant', 'Date of Birth', 'Contact Email', 'Mobile Number', 'Highest Educational Qualification',
    'Name of Institution', 'Year of Passing', 'Family Annual Income', 'Statement of Purpose',
  ],
  admission: [
    'Full Legal Name', 'Date of Birth', 'Email Address', 'Phone Number', 'Latest Degree Earned', 'Institution',
    'Graduation Year', 'Research Experience', 'Statement of Purpose',
  ],
  government: ['Applicant Name', 'Date of Birth', 'Residential Address', 'Mobile Number', 'Email ID'],
  custom: [],
}
