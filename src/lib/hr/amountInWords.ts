/** Rupees in words, Indian numbering (lakh / crore): 123456 → "One Lakh Twenty-Three Thousand Four Hundred Fifty-Six". */
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function belowHundred(n: number): string {
  if (n < 20) return ONES[n]
  return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '')
}

function belowThousand(n: number): string {
  const h = Math.floor(n / 100)
  const rest = n % 100
  return [h ? `${ONES[h]} Hundred` : '', rest ? belowHundred(rest) : ''].filter(Boolean).join(' ')
}

export function amountInWords(amount: number): string {
  let n = Math.round(Math.abs(amount))
  if (n === 0) return 'Zero'
  const parts: string[] = []
  const crore = Math.floor(n / 10_000_000); n %= 10_000_000
  const lakh = Math.floor(n / 100_000); n %= 100_000
  const thousand = Math.floor(n / 1000); n %= 1000
  if (crore) parts.push(`${amountInWords(crore)} Crore`)
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`)
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`)
  if (n) parts.push(belowThousand(n))
  return parts.join(' ')
}

/** "Rupees Forty Thousand Only". */
export function rupeesInWords(amount: number): string {
  return `Rupees ${amountInWords(amount)} Only`
}
