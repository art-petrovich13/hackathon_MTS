// src/context/ThemeContext.tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Theme = 'dark' | 'light'

interface ThemeContextValue {
  theme: Theme
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggle: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Читаем сохранённую тему из localStorage, по умолчанию dark
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('iaas-theme') as Theme) ?? 'dark'
  })

  // Применяем атрибут data-theme на <html> — CSS-переменные реагируют на него
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('iaas-theme', theme)
  }, [theme])

  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)