import Link from '@docusaurus/Link'

const cards = [
  { to: '/features/safety-gate', title: 'Safety Gate', text: 'Every input checked before any AI call.', icon: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z' },
  { to: '/features/normalisation', title: 'Normalisation', text: 'Brain Rot, brain-rot, brainrot: one key.', icon: 'M4 7h16M4 12h10M4 17h6' },
  { to: '/features/aura', title: 'Aura Lifecycle', text: 'From emerging to parent territory.', icon: 'M3 17l6-6 4 4 8-8M15 7h6v6' },
  { to: '/features/evaluation-harness', title: 'Evaluation Harness', text: 'An exam for the AI, with real scores.', icon: 'M5 12l4 4 10-10' },
]

export default function FeatureCards() {
  return (
    <div className="gad-cards">
      {cards.map((c, i) => (
        <Link key={c.to} to={c.to} className={`gad-card gad-card--${i}`}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={c.icon} /></svg>
          <strong>{c.title}</strong>
          <span>{c.text}</span>
        </Link>
      ))}
    </div>
  )
}
