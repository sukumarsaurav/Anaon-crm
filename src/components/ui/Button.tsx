import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ButtonHTMLAttributes, forwardRef } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'success'
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  /** When set, renders a Next.js <Link> instead of a <button>. */
  href?: string
  /** Open in a new tab. Only meaningful with href. */
  external?: boolean
}

const baseClass =
  'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none'

const variantClass: Record<ButtonVariant, string> = {
  primary:
    'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 focus-visible:ring-indigo-500 shadow-sm hover:shadow-md',
  secondary:
    'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 focus-visible:ring-indigo-500 shadow-sm',
  ghost:
    'text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-400',
  danger:
    'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-500 shadow-sm hover:shadow-md',
  outline:
    'border border-indigo-500 text-indigo-600 hover:bg-indigo-50 focus-visible:ring-indigo-500',
  success:
    'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 focus-visible:ring-emerald-500 shadow-sm hover:shadow-md',
}

const sizeClass: Record<ButtonSize, string> = {
  xs: 'px-2.5 py-1 text-xs',
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
}

const Spinner = () => (
  <svg className="animate-spin h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" aria-hidden="true">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
)

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, href, external, children, ...props }, ref) => {
    const classes = cn(baseClass, variantClass[variant], sizeClass[size], className)

    if (href) {
      // tel:, mailto:, and absolute http(s) URLs render as plain anchors.
      const isPlainAnchor = /^(tel:|mailto:|https?:\/\/)/i.test(href)
      const linkProps = external ? { target: '_blank', rel: 'noopener noreferrer' } : {}
      if (isPlainAnchor) {
        return (
          <a href={href} className={classes} {...linkProps}>
            {loading && <Spinner />}
            {children}
          </a>
        )
      }
      return (
        <Link href={href} className={classes} {...linkProps}>
          {loading && <Spinner />}
          {children}
        </Link>
      )
    }

    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Spinner />}
        {children}
      </button>
    )
  },
)
Button.displayName = 'Button'
export default Button
