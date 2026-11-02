import type { Order } from './types'

// Deterministic sample orders (seeded), so test results are stable between reloads.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

const NAMES = ['ava', 'liam', 'noah', 'mia', 'arjun', 'zara', 'leo', 'emma', 'kai', 'isha', 'omar', 'lucia', 'ravi', 'chloe', 'tom', 'yuki']
const DOMAINS = ['gmail.com', 'outlook.com', 'company.co', 'proton.me', 'tempmail.io']

export const ORDERS: (Order & { id: string })[] = (() => {
  const r = rng(42)
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]
  return Array.from({ length: 40 }, (_, i) => {
    const customerType = pick(['new', 'new', 'returning', 'returning', 'returning', 'vip'])
    const accountAgeDays = customerType === 'new' ? Math.floor(r() * 7) : Math.floor(30 + r() * 900)
    const paymentMethod = pick(['card', 'card', 'card', 'paypal', 'paypal', 'crypto', 'bank_transfer', 'gift_card'])
    const billingMatchesShipping = r() > 0.2
    const base = 10 + Math.round(r() * r() * 1600)
    let riskScore = Math.round(r() * 35)
    if (customerType === 'new') riskScore += 20
    if (paymentMethod === 'crypto' || paymentMethod === 'gift_card') riskScore += 20
    if (!billingMatchesShipping) riskScore += 15
    return {
      id: `#${(1041 + i).toString()}`,
      orderTotal: base,
      itemCount: 1 + Math.floor(r() * 8),
      customerType,
      accountAgeDays,
      country: pick(['US', 'US', 'US', 'CA', 'GB', 'DE', 'IN', 'BR', 'NG']),
      paymentMethod,
      shippingSpeed: pick(['standard', 'standard', 'express', 'overnight']),
      category: pick(['electronics', 'fashion', 'home', 'grocery', 'gaming']),
      riskScore: Math.min(99, riskScore),
      couponUsed: r() > 0.7,
      billingMatchesShipping,
      email: `${pick(NAMES)}${Math.floor(r() * 90 + 10)}@${pick(DOMAINS)}`,
    }
  })
})()
