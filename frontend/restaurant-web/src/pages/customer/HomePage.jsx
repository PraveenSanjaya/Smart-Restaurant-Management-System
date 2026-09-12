import { Link } from 'react-router-dom'
import BrandLogo from '../../components/common/BrandLogo.jsx'

function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-8 py-6">
        <BrandLogo />
        <Link
          to="/login"
          className="rounded-lg bg-gradient-to-r from-gold-600 to-gold-500 px-5 py-2 font-bold text-slate-900 shadow-sm hover:opacity-90 transition"
        >
          Sign in
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900">
          Welcome to Cinnamon Bistro
        </h1>
        <p className="mt-4 max-w-xl text-slate-500">
          Reserve a table, browse the menu, and manage your orders — all in one place.
        </p>
      </main>
    </div>
  )
}

export default HomePage
