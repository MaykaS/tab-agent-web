import './globals.css'

export const metadata = {
  title: 'Tab Agent — Intelligent Chrome Tab Management',
  description: 'An agentic Chrome extension that groups, protects, and manages your tabs using on-device AI. No API key required.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
