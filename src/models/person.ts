import { z } from 'zod'

export const InterestSchema = z.object({
  name: z.string(),
  category: z.string(),
  linkedinUrl: z.string().optional(),
})

export type Interest = z.infer<typeof InterestSchema>

export const ContactSchema = z.object({
  type: z.string(),
  value: z.string(),
  label: z.string().optional(),
})

export type Contact = z.infer<typeof ContactSchema>

export const PositionSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  duration: z.string().optional(),
  location: z.string().optional(),
  employmentType: z.string().optional(),
})

export type Position = z.infer<typeof PositionSchema>

export const ExperienceSchema = z.object({
  company: z.string().optional(),
  companyUrl: z.string().optional(),
  positions: z.array(PositionSchema).default([]),
})

export type Experience = z.infer<typeof ExperienceSchema>

export const EducationSchema = z.object({
  institutionName: z.string().optional(),
  degree: z.string().optional(),
  linkedinUrl: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  description: z.string().optional(),
})

export type Education = z.infer<typeof EducationSchema>

export const AccomplishmentSchema = z.object({
  category: z.string(),
  title: z.string(),
  issuer: z.string().optional(),
  issuedDate: z.string().optional(),
  credentialId: z.string().optional(),
  credentialUrl: z.string().optional(),
  description: z.string().optional(),
})

export type Accomplishment = z.infer<typeof AccomplishmentSchema>

export const PatentSchema = z.object({
  title: z.string(),
  issuer: z.string().optional(),
  number: z.string().optional(),
  issuedDate: z.string().optional(),
  url: z.string().optional(),
  description: z.string().optional(),
})

export type Patent = z.infer<typeof PatentSchema>

export const PersonSchema = z.object({
  linkedinUrl: z.string().refine((url) => url.includes('linkedin.com/in/'), {
    message: 'Must be a valid LinkedIn profile URL (contains /in/)',
  }),
  name: z.string().optional(),
  location: z.string().optional(),
  about: z.string().optional(),
  openToWork: z.boolean().default(false),
  experiences: z.array(ExperienceSchema).default([]),
  educations: z.array(EducationSchema).default([]),
  patents: z.array(PatentSchema).default([]),
  interests: z.array(InterestSchema).default([]),
  accomplishments: z.array(AccomplishmentSchema).default([]),
  contacts: z.array(ContactSchema).default([]),
})

export type PersonData = z.infer<typeof PersonSchema>

/**
 * Factory function to create and validate a Person data object
 * @param data - Raw person data to validate
 * @returns Validated PersonData object
 */
export function createPerson(data: PersonData): PersonData {
  return PersonSchema.parse(data)
}

/**
 * Get the company name from the person's most recent experience
 * @param person - PersonData object
 * @returns Company name or undefined if no experiences
 */
export function getPersonCompany(person: PersonData): string | undefined {
  return person.experiences[0]?.company
}

/**
 * Get the job title from the person's most recent experience
 * @param person - PersonData object
 * @returns Job title or undefined if no experiences
 */
export function getPersonJobTitle(person: PersonData): string | undefined {
  return person.experiences[0]?.positions[0]?.title
}

/**
 * Convert PersonData to a formatted string representation
 * @param person - PersonData object
 * @returns Formatted string with person details
 */
export function personToString(person: PersonData): string {
  return (
    `<Person ${person.name}\n` +
    `  Company: ${getPersonCompany(person)}\n` +
    `  Title: ${getPersonJobTitle(person)}\n` +
    `  Location: ${person.location}\n` +
    `  Experiences: ${person.experiences.length}\n` +
    `  Education: ${person.educations.length}\n` +
    `  Patents: ${person.patents.length}>`
  )
}
