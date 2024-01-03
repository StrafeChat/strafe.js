import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '../components/Navbar'
import Sidebar from '@/components/Sidebar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: "strafe.js",
  description: "strafe.js is a powerful Node.js module that allows you to interact with the Strafe API.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className='h-full flex flex-col'>
          <Navbar />
          <div className='flex flex-grow'>
            <Sidebar />
            {children}
          </div>
        </div>
      </body>
    </html>
  )
}
