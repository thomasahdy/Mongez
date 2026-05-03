function iconClassName(className = '') {
  return `h-4 w-4 ${className}`.trim()
}

export function Icon({ name, className = '' }) {
  const base = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.8',
    viewBox: '0 0 24 24',
    className: iconClassName(className),
    'aria-hidden': 'true',
  }

  switch (name) {
    case 'sparkles':
      return (
        <svg {...base}>
          <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z" />
        </svg>
      )
    case 'play':
      return (
        <svg {...base}>
          <path d="M8 6.5v11l9-5.5-9-5.5Z" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'rocket':
      return (
        <svg {...base}>
          <path d="M14 4c3 0 6 3 6 6-2.5 2-5.5 4-9 5-1-3.5-3-6.5-5-9 3-3.5 6-6 8-6Z" />
          <path d="M9 15l-3 3" />
          <path d="M8 18l-2 2" />
        </svg>
      )
    case 'arrow-down':
      return (
        <svg {...base}>
          <path d="M12 5v14" />
          <path d="m6 13 6 6 6-6" />
        </svg>
      )
    case 'trend':
      return (
        <svg {...base}>
          <path d="m4 16 5-5 4 4 7-8" />
          <path d="M14 7h6v6" />
        </svg>
      )
    case 'warning':
      return (
        <svg {...base}>
          <path d="M12 4 3.5 19h17L12 4Z" />
          <path d="M12 9v4" />
          <path d="M12 16h.01" />
        </svg>
      )
    case 'ban':
      return (
        <svg {...base}>
          <circle cx="12" cy="12" r="8" />
          <path d="m8 8 8 8" />
        </svg>
      )
    case 'clock':
      return (
        <svg {...base}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v5l3 2" />
        </svg>
      )
    case 'bars':
      return (
        <svg {...base}>
          <path d="M5 7h14" />
          <path d="M5 12h10" />
          <path d="M5 17h7" />
        </svg>
      )
    case 'user-clock':
      return (
        <svg {...base}>
          <circle cx="9" cy="8" r="3" />
          <path d="M4 18c1.5-3 7.5-3 10 0" />
          <circle cx="18" cy="15" r="3" />
          <path d="M18 14v2l1 1" />
        </svg>
      )
    case 'lock':
      return (
        <svg {...base}>
          <rect x="6" y="11" width="12" height="9" rx="2" />
          <path d="M9 11V8a3 3 0 0 1 6 0v3" />
        </svg>
      )
    case 'users':
      return (
        <svg {...base}>
          <circle cx="8" cy="9" r="2.5" />
          <circle cx="16" cy="9" r="2.5" />
          <path d="M4.5 18c1.5-3 5.5-3 7 0" />
          <path d="M12.5 18c1.5-3 5.5-3 7 0" />
        </svg>
      )
    case 'clipboard':
      return (
        <svg {...base}>
          <rect x="6" y="5" width="12" height="15" rx="2" />
          <path d="M9 5.5h6" />
          <path d="m9 13 2 2 4-4" />
        </svg>
      )
    case 'chart':
      return (
        <svg {...base}>
          <path d="M5 19V9" />
          <path d="M12 19V5" />
          <path d="M19 19v-7" />
        </svg>
      )
    case 'brain':
      return (
        <svg {...base}>
          <path d="M9 6a3 3 0 0 1 6 0 3 3 0 0 1 3 3v1a3 3 0 0 1-2 2.8V15a3 3 0 0 1-3 3h-2a3 3 0 0 1-3-3v-2.2A3 3 0 0 1 6 10V9a3 3 0 0 1 3-3Z" />
        </svg>
      )
    case 'robot':
      return (
        <svg {...base}>
          <rect x="6" y="8" width="12" height="9" rx="2" />
          <path d="M12 4v4" />
          <circle cx="10" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="14" cy="12" r="1" fill="currentColor" stroke="none" />
          <path d="M10 15h4" />
        </svg>
      )
    case 'wand':
      return (
        <svg {...base}>
          <path d="m5 19 8-8" />
          <path d="m14 5 1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2Z" />
        </svg>
      )
    case 'send':
      return (
        <svg {...base}>
          <path d="M4 12 20 5l-4 14-4-5-8-2Z" />
        </svg>
      )
    case 'calendar':
      return (
        <svg {...base}>
          <rect x="4" y="6" width="16" height="14" rx="2" />
          <path d="M8 4v4" />
          <path d="M16 4v4" />
          <path d="M4 10h16" />
        </svg>
      )
    case 'excel':
      return (
        <svg {...base}>
          <rect x="6" y="4" width="12" height="16" rx="2" />
          <path d="m9 9 4 6" />
          <path d="m13 9-4 6" />
        </svg>
      )
    case 'question':
      return (
        <svg {...base}>
          <path d="M9.5 9a2.5 2.5 0 1 1 4 2c-.9.7-1.5 1.2-1.5 2.5" />
          <path d="M12 17h.01" />
        </svg>
      )
    default:
      return (
        <svg {...base}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      )
  }
}

export function BrandIcon({ name, className = '' }) {
  const baseProps = {
    viewBox: '0 0 24 24',
    className: iconClassName(className),
    fill: 'currentColor',
    'aria-hidden': 'true',
  }

  switch (name) {
    case 'x':
      return (
        <svg {...baseProps}>
          <path d="M6 5h3.2l3.1 4.2L16 5h2.4l-5 5.7L19 19h-3.2l-3.5-4.8L8 19H5.6l5.3-6.1L6 5Z" />
        </svg>
      )
    case 'linkedin':
      return (
        <svg {...baseProps}>
          <path d="M6.2 8.5H9V18H6.2V8.5Zm1.4-3.8a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2ZM10.8 8.5h2.7v1.3h.1c.4-.8 1.3-1.6 2.8-1.6 3 0 3.6 2 3.6 4.6V18h-2.8v-4.5c0-1.1 0-2.4-1.5-2.4s-1.7 1.1-1.7 2.3V18h-2.8V8.5Z" />
        </svg>
      )
    case 'github':
      return (
        <svg {...baseProps}>
          <path d="M12 4a8 8 0 0 0-2.5 15.6c.4.1.5-.2.5-.4v-1.5c-2.2.5-2.7-.9-2.7-.9-.4-.9-.9-1.1-.9-1.1-.7-.5 0-.5 0-.5.8 0 1.2.8 1.2.8.7 1.2 1.9.9 2.4.7.1-.5.3-.9.5-1.1-1.8-.2-3.8-.9-3.8-4 0-.9.3-1.7.8-2.2 0-.2-.3-1 .1-2.1 0 0 .7-.2 2.3.8A8 8 0 0 1 12 8a8 8 0 0 1 2.1.3c1.6-1 2.3-.8 2.3-.8.4 1.1.1 1.9.1 2.1.5.6.8 1.4.8 2.2 0 3.1-2 3.8-3.8 4 .3.2.6.7.6 1.5v2.2c0 .2.1.5.5.4A8 8 0 0 0 12 4Z" />
        </svg>
      )
    default:
      return null
  }
}
