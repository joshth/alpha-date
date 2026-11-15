import Link from '@docusaurus/Link'
import useBaseUrl from '@docusaurus/useBaseUrl'

export default function Hero() {
  return (
    <header className="gad-hero">
      <img className="gad-banner" src={useBaseUrl('/img/banner.svg')} alt="Gen Alpha Decoder" />
      <p className="gad-tagline">Slang, decoded safely. A lexicon pipeline that guards, checks and explains.</p>
      <div className="gad-cta">
        <Link className="gad-btn gad-btn--primary" to="/getting-started">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
          Get started
        </Link>
        <Link className="gad-btn gad-btn--alt" to="/api">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7l-5 5 5 5M15 7l5 5-5 5" /></svg>
          API reference
        </Link>
      </div>
    </header>
  )
}
