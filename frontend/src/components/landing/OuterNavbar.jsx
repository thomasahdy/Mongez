import { NavLink } from "react-router";
import mongezWordmark from "../../assets/Mongez.svg";
import mongezMark from "../../assets/MongezMLogo.svg";

function Navbar() {
  const navLinks = ["Features", "AI Assistant", "Results", "Testimonials"];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/90 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6 lg:px-8">
        <a href="#hero" className="flex items-center gap-0 text-slate-900">
          <div className="grid h-10 w-10 place-items-center rounded-xl">
            <img src={mongezMark} alt="Mongez mark" className="h-9 w-8 object-contain" />
          </div>
          <img src={mongezWordmark} alt="Mongez" className="h-11 w-auto object-contain" />
        </a>

        <nav className="hidden items-center gap-8 text-[14px] font-medium text-slate-500 lg:flex">
          {navLinks.map((link) => (
            <a
              key={link}
              href={`#${link.toLowerCase().replace(/\s+/g, '-')}`}
              className="transition-colors hover:text-slate-900"
            >
              {link}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <NavLink to="/login">
            <span className="text-sm font-semibold text-slate-600 transition hover:text-slate-900">
              Log In
            </span>
          </NavLink>
          <NavLink to="/register">
            <span className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(0,168,232,0.3)] transition hover:-translate-y-0.5 hover:bg-sky-600">
              Get Started
            </span>
          </NavLink>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
