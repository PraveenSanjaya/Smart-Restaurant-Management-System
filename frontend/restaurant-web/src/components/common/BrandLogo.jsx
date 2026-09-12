import { Link } from 'react-router-dom'

/**
 * Clickable brand logo. Navigates to the home/landing page ("/") when clicked.
 */
function BrandLogo({ className = '' }) {
  return (
    <Link
      to="/"
      aria-label="Go to Cinnamon Bistro home page"
      className={`inline-flex items-center gap-2 group focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 rounded-md ${className}`}
    >
      <svg
        width="36"
        height="36"
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        <circle cx="24" cy="24" r="22" stroke="#b8860b" strokeWidth="2.5" />
        <path
          d="M24 12c6 0 10 4 10 9s-4 8-8 8-6-2.5-6-5.5 2-5 5-5 4 1.5 4 3.5"
          stroke="#b8860b"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <span className="flex flex-col leading-none">
        <span className="text-xl font-extrabold tracking-tight text-slate-900 group-hover:text-gold-600 transition-colors">
          Cinnamon Bistro
        </span>
        <span className="text-[10px] tracking-[0.35em] text-gold-600 font-semibold">
          BISTRO
        </span>
      </span>
    </Link>
  )
}

export default BrandLogo
