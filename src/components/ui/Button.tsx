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
  'inline-flex items-center justify-center gap-2 font-bold rounded-lg transition-all duration-150 active:scale-[0.98] focus-ring disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 select-none'

const variantClass: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-white hover:bg-primary-hover shadow-lg shadow-primary/30',
  secondary:
    'bg-slate-100 text-slate-700 hover:bg-slate-200',
  ghost:
    'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  danger:
    'bg-error text-white hover:bg-red-600 shadow-lg shadow-error/30',
  outline:
    'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400',
  success:
    'bg-success text-white hover:bg-emerald-600 shadow-lg shadow-success/30',
}

const sizeClass: Record<ButtonSize, string> = {
  xs: 'h-7 px-2.5 text-xs',
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
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
