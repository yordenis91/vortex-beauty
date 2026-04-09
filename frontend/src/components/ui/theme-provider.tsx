import * as React from "react"

type Theme = "light" | "dark"

type ThemeProviderProps = {
  children: React.ReactNode
}

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined)

const getPreferredTheme = (): Theme => {
  if (typeof window === "undefined") {
    return "light"
  }

  const storedTheme = window.localStorage.getItem("theme") as Theme | null
  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme
  }

  // Default to light theme instead of system preference
  return "light"
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(getPreferredTheme)

  React.useEffect(() => {
    const root = document.documentElement
    const nextTheme = getPreferredTheme()

    if (root.classList.contains("dark") && nextTheme === "light") {
      root.classList.remove("dark")
    }

    if (nextTheme === "dark") {
      root.classList.add("dark")
    }

    setThemeState(nextTheme)
  }, [])

  React.useEffect(() => {
    const root = document.documentElement
    root.classList.toggle("dark", theme === "dark")
    window.localStorage.setItem("theme", theme)
  }, [theme])

  const setTheme = (value: Theme) => setThemeState(value)
  const toggleTheme = () => setThemeState((current) => (current === "dark" ? "light" : "dark"))

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = React.useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider")
  }
  return context
}
