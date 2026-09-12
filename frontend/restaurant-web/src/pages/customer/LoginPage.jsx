import { useState } from 'react'
import BrandLogo from '../../components/common/BrandLogo.jsx'

function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)

  function handleSubmit(event) {
    event.preventDefault()
    // TODO: wire up to identity-service auth endpoint
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      <div className="flex flex-col justify-center px-8 sm:px-16 py-12">
        <BrandLogo className="mb-16" />

        <div className="max-w-sm w-full mx-auto lg:mx-0">
          <h1 className="text-3xl font-extrabold text-slate-900">Welcome back</h1>
          <p className="mt-2 text-slate-500">Please enter your details to sign in</p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                className="mt-1 w-full rounded-lg border border-slate-200 bg-blue-50/40 px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-gold-500"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative mt-1">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="w-full rounded-lg border border-slate-200 bg-blue-50/40 px-4 py-3 pr-10 text-slate-800 focus:outline-none focus:ring-2 focus:ring-gold-500"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-slate-600">
                <input type="checkbox" className="rounded border-slate-300 text-gold-600 focus:ring-gold-500" />
                Remember for 30 days
              </label>
              <a href="#" className="font-semibold text-gold-600 hover:text-gold-500">
                Forgot password
              </a>
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-gradient-to-r from-gold-600 to-gold-500 py-3 font-bold tracking-wide text-slate-900 shadow-sm hover:opacity-90 transition"
            >
              SIGN IN
            </button>

            <p className="text-center text-sm text-slate-500">
              Don&apos;t have an account?{' '}
              <a href="#" className="font-semibold text-gold-600 hover:text-gold-500">
                Sign up
              </a>
            </p>
          </form>
        </div>
      </div>

      <div className="hidden lg:block relative bg-gradient-to-br from-amber-100 via-orange-50 to-stone-200">
        <div className="absolute inset-0 flex items-center justify-center p-12 text-center">
          <p className="max-w-xs text-stone-500 text-sm">
            Restaurant interior image goes here — drop your asset into
            <code className="mx-1 rounded bg-white/60 px-1">src/assets/images/</code>
            and reference it in this panel.
          </p>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
