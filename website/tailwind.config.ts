import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      borderColor: {
        DEFAULT: "var(--border)",
      },
      backgroundColor: {
        sidebar: "var(--sidebar)",
        card: "var(--card)",
      }
    },
  },
  plugins: [],
}
export default config