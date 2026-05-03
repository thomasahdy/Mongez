import { BrandIcon } from './Icons'
import mongezMark from '../assets/MongezMLogo.svg'
import mongezWordmark from '../assets/Mongez.svg'

const footerColumns = [
  {
    title: 'Product',
    links: ['Features', 'Results', 'Pricing'],
  },
  {
    title: 'Company',
    links: ['About', 'Blog','Contact'],
  },
  {
    title: 'Legal',
    links: ['Privacy', 'Terms', 'Security'],
  },
]

function FooterSection() {
  return (
    <footer id="footer" className="bg-[#12192d] px-6 py-20 text-white lg:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 border-b border-white/8 pb-14 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-linear-to-br  ">
                <img src={mongezMark} alt="Mongez mark" className="h-12 w-9 object-contain" />
              </div>
              <div className="flex flex-col">
                <img src={mongezWordmark} alt="Mongez" className="h-12 w-auto object-contain" />
              </div>
            </div>
            <p className="mt-6 max-w-md text-lg leading-8 text-slate-400">
              AI-Powered Execution for NGOs & Organizations. Built with precision for teams that demand results.
            </p>
          </div>

          {footerColumns.map((column) => (
            <div key={column.title}>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">{column.title}</p>
              <div className="mt-6 space-y-4">
                {column.links.map((link) => (
                  <a key={link} href="#" className="block text-lg text-slate-400 transition hover:text-white">
                    {link}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-6 pt-8 text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; 2026 Mongez. All rights reserved.</p>
          <div className="flex items-center gap-5 text-xl">
            <a href="#" aria-label="X" className="transition hover:text-white ">
              <BrandIcon name="x" />
            </a>
            <a href="#" aria-label="LinkedIn" className="transition hover:text-white">
              <BrandIcon name="linkedin" />
            </a>
            <a href="#" aria-label="GitHub" className="transition hover:text-white">
              <BrandIcon name="github" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default FooterSection
