'use client'

import { useState } from 'react'
import { cn, getInitials } from '@/lib/utils'

interface AvatarProps {
  name: string
  src?: string | null
  /** Tailwind size classes, e.g. `size-10`. */
  className?: string
  /** Tailwind text size for the initials fallback. */
  textClassName?: string
}

/** Round avatar: photo when it loads, initials otherwise (missing URL or broken image). */
export default function Avatar({ name, src, className = 'size-10', textClassName = 'text-sm' }: AvatarProps) {
  const [failed, setFailed] = useState(false)
  const showImage = !!src && !failed

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center shrink-0 overflow-hidden rounded-full bg-primary-100 text-primary-700 font-semibold',
        textClassName,
        className,
      )}
    >
      {showImage ? (
        // Storage URLs are signed/remote; next/image would need per-host config for little gain at this size.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{getInitials(name)}</span>
      )}
    </span>
  )
}
