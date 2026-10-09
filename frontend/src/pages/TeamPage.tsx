import { motion, useReducedMotion } from 'framer-motion'
import { usePageMeta } from '../hooks/usePageMeta'
import { Container } from '../components/ui/primitives'
import { GITHUB_URL, LINKEDIN_URL } from '../config/site'

type Social = 'LinkedIn' | 'GitHub'

interface Member {
  name: string
  role: string
  description: string
  avatar: string // emoji shown in the avatar
  links: { label: Social; href: string }[]
}

const TEAM: Member[] = [
  {
    name: 'Ritesh Kumar',
    role: 'Software Engineer | AI & ML Enthusiast',
    description: 'AI & ML | Experienced in React, SQL | Passionate about AI, ML, and full-stack development.',
    avatar: '🧑‍💻',
    links: [
      { label: 'LinkedIn', href: LINKEDIN_URL },
      { label: 'GitHub', href: GITHUB_URL },
    ],
  },
  {
    name: 'Menka Kumari',
    role: 'Diploma | Computer Science & Engineering',
    description: 'Computer Science & Engineering student and Team CodeX member, building FormPilot.',
    avatar: '👩‍💻',
    links: [{ label: 'LinkedIn', href: 'https://www.linkedin.com/in/menka-kumari-96661332a' }],
  },
  {
    name: 'Navnita Kumari',
    role: 'Diploma | Computer Science & Engineering',
    description: 'Computer Science & Engineering student and Team CodeX member, building FormPilot.',
    avatar: '👩‍💻',
    links: [{ label: 'LinkedIn', href: 'https://www.linkedin.com/in/navnita-kumari-6713aa371' }],
  },
]

/** Brand logos, in the brands' own colors. */
function SocialLogo({ label }: { label: Social }) {
  if (label === 'LinkedIn') {
    return (
      <svg viewBox="0 0 24 24" className="size-8" aria-hidden>
        <rect width="24" height="24" rx="4" fill="#0A66C2" />
        <path
          fill="#fff"
          d="M7.1 9.6h2.3v7.4H7.1V9.6Zm1.15-3.7a1.33 1.33 0 1 1 0 2.66 1.33 1.33 0 0 1 0-2.66Zm2.6 3.7h2.2v1h.03c.31-.58 1.06-1.2 2.18-1.2 2.33 0 2.76 1.53 2.76 3.53V17h-2.3v-3.6c0-.86-.02-1.97-1.2-1.97-1.2 0-1.38.94-1.38 1.9V17h-2.3V9.6Z"
        />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className="size-8 text-[#1f2328]" aria-hidden fill="currentColor">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.17 1.18a10.9 10.9 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.58.23 2.75.11 3.04.74.8 1.18 1.83 1.18 3.08 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  )
}

function MemberCard({ member, index }: { member: Member; index: number }) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.li
      initial={reduceMotion ? false : { opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay: index * 0.12, ease: [0.22, 1, 0.36, 1] }}
      className="group relative flex flex-col items-center rounded-[28px] border border-[#c7d2fe] bg-white px-7 pt-12 pb-10 text-center shadow-[0_10px_30px_rgba(79,82,217,0.08)] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-2 hover:border-[#a5b4fc] hover:shadow-[0_22px_48px_rgba(79,82,217,0.18)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      {/* Glowing dot, as on a status light */}
      <span aria-hidden className="absolute top-8 left-7 flex size-3">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#4f52d9] opacity-40 motion-reduce:animate-none" />
        <span className="relative inline-flex size-3 rounded-full bg-[#4f52d9] shadow-[0_0_12px_4px_rgba(79,82,217,0.35)]" />
      </span>

      <span
        aria-hidden
        className="flex size-[92px] items-center justify-center rounded-full bg-gradient-to-br from-[#7c7ff2] to-[#5b5ee6] text-[44px] leading-none shadow-[0_12px_28px_rgba(91,94,230,0.35)] ring-[6px] ring-[#eef0ff] transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3 motion-reduce:group-hover:transform-none"
      >
        {member.avatar}
      </span>

      <h3 className="mt-7 text-[28px] font-bold tracking-[-0.025em] text-ink">{member.name}</h3>
      <p className="mt-2 text-[13px] font-bold tracking-[0.08em] text-[#4f52d9] uppercase">{member.role}</p>
      <p className="mt-5 max-w-[36ch] text-[16px] leading-relaxed text-muted">{member.description}</p>

      <div className="mt-8 flex items-center gap-4">
        {member.links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${member.name} on ${link.label}`}
            title={link.label}
            className="rounded-[8px] transition-transform duration-200 hover:-translate-y-0.5 hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#4f52d9] motion-reduce:hover:transform-none"
          >
            <SocialLogo label={link.label} />
          </a>
        ))}
      </div>
    </motion.li>
  )
}

export function TeamPage() {
  usePageMeta({ title: 'Team', path: '/team', description: 'Team CodeX, the people building FormPilot.' })
  return (
    <div
      className="relative"
      style={{
        // Light graph-paper grid behind the team, like an engineering notebook.
        backgroundImage:
          'linear-gradient(to right, rgba(79,82,217,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(79,82,217,0.06) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }}
    >
      <Container className="pt-16 pb-6 text-center sm:pt-20">
        <p className="eyebrow">Team</p>
        <h1 className="display mx-auto mt-3 max-w-[780px] text-[40px] text-ink sm:text-[54px]">Team CodeX</h1>
        <p className="mx-auto mt-5 max-w-[620px] text-[18px] leading-relaxed text-muted">
          The people building FormPilot: one verified profile for every application.
        </p>
      </Container>

      <Container className="pt-10 pb-24 sm:pt-12 lg:pb-32">
        <h2 className="sr-only">Team members</h2>
        <ul className="mx-auto grid max-w-[1120px] gap-7 md:grid-cols-2 lg:grid-cols-3">
          {TEAM.map((member, i) => (
            <MemberCard key={member.name} member={member} index={i} />
          ))}
        </ul>
      </Container>
    </div>
  )
}
