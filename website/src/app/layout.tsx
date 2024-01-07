import SidebarProvider from '@/providers/SidebarProvider'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Navbar from '../components/Navbar'
import './globals.css'

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
            <SidebarProvider>
              {children}
            </SidebarProvider>
          </div>
        </div>
      </body>
    </html>
  )
}
