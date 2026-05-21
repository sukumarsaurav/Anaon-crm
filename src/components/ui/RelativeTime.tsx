'use client'

import { useState, useEffect } from 'react'
import { formatRelative } from '@/lib/utils'

interface Props {
  date: string | null | undefined
  className?: string
}

export default function RelativeTime({ date, className }: Props) {
  const [text, setText] = useState(formatRelative(date))

  useEffect(() => {
    setText(formatRelative(date))
    const id = setInterval(() => setText(formatRelative(date)), 60_000)
    return () => clearInterval(id)
  }, [date])

  return (
    <span className={className} suppressHydrationWarning>
      {text}
    </span>
  )
}
