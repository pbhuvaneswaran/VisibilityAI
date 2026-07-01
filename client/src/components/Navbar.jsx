import { Link, useLocation } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'

function ResourcesDropdown({ v2 }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const items = [
    { to: '/blog', label: 'Blog', desc: 'Guides on AEO, GEO & SEO' },
    { to: '/use-cases', label: 'Use Cases', desc: 'How teams use the tool' },
    { to: '/case-studies', label: 'Case Studies', desc: 'Real results, real brands' },
  ]

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
      >
        Resources
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-56 bg-white border border-gray-200 rounded-xl shadow-lg py-2 z-50">
          {items.map(({ to, label, desc }) => (
            <Link key={to} to={to} onClick={() => setOpen(false)}
              className="flex flex-col px-4 py-3 hover:bg-gray-50 transition-colors">
              <span className="text-sm font-semibold text-gray-900">{label}</span>
              <span className="text-xs text-gray-400 mt-0.5">{desc}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Navbar({ version = 'v1' }) {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const v2 = version === 'v2'
  const appLink = v2 ? '/v2/app' : '/app'
  const pricingLink = v2 ? '/v2/pricing' : '/pricing'
  const featuresLink = '/features'

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 flex-shrink-0">
          <span className="font-bold text-gray-900 text-xl tracking-tight">Peach</span>
        </Link>

        <div className="hidden md:flex items-center gap-6">
          <Link to={featuresLink}
            className={`text-sm font-medium transition-colors ${location.pathname === featuresLink ? 'text-indigo-600' : 'text-gray-600 hover:text-gray-900'}`}>
            Features
          </Link>
<Link to={pricingLink}
            className={`text-sm font-medium transition-colors ${location.pathname === pricingLink ? 'text-indigo-600' : 'text-gray-600 hover:text-gray-900'}`}>
            Pricing
          </Link>
          <ResourcesDropdown v2={v2} />
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link to={appLink} className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
            Sign in
          </Link>
          <Link to={pricingLink}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            Get started
          </Link>
        </div>

        <button className="md:hidden p-2 text-gray-600" onClick={() => setMobileOpen(!mobileOpen)}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            }
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 px-6 py-4 space-y-3 bg-white">
          <Link to={featuresLink} onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-gray-700 hover:text-indigo-600">Features</Link>
<Link to={pricingLink} onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-gray-700 hover:text-indigo-600">Pricing</Link>
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wide pt-1">Resources</div>
          <Link to="/blog" onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-gray-700 hover:text-indigo-600 pl-2">Blog</Link>
          <Link to="/use-cases" onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-gray-700 hover:text-indigo-600 pl-2">Use Cases</Link>
          <Link to="/case-studies" onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-gray-700 hover:text-indigo-600 pl-2">Case Studies</Link>
          <Link to={pricingLink} onClick={() => setMobileOpen(false)}
            className="block w-full text-center bg-indigo-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg mt-2">
            Get started
          </Link>
        </div>
      )}
    </nav>
  )
}
