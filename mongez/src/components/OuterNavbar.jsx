import mongezWordmark from '../assets/Mongez.svg'
import mongezMark from '../assets/MongezMLogo.svg'

function Navbar() {
  const navLinks = ['Features', 'AI Assistant', 'Results', 'Testimonials']

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
        <a href="#hero" className="flex items-center gap-0 text-slate-900">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-linear-to-br  ">
            <img src={mongezMark} alt="Mongez mark" className="h-10 w-9 object-contain" />
          </div>
          <div className="flex flex-col">
            <img src={mongezWordmark} alt="Mongez" className="h-12 w-auto object-contain" />
          </div>
        </a>

        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 lg:flex">
          {navLinks.map((link) => (
            <a
              key={link}
              href={`#${link.toLowerCase().replace(/\s+/g, '-')}`}
              className="transition hover:text-sky-600"
            >
              {link}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <a href="#footer" className="text-sm font-semibold text-slate-600 transition hover:text-slate-900">
            Log In
          </a>
          <a
            href="#final-cta"
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_20px_45px_rgba(14,165,233,0.35)] transition hover:-translate-y-0.5"
          >
            Get Started
          </a>
        </div>
      </div>
    </header>
  )
}

export default Navbar
