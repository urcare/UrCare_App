import React, { createContext, useContext, useEffect } from 'react';

export type ThemeMode = 'light';

interface ThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => {},
  setTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    try {
      localStorage.setItem('urcare_theme', 'light');
      document.documentElement.classList.add('light-mode');
      document.documentElement.classList.remove('dark-mode');
    } catch (e) {}
  }, []);

  const toggleTheme = () => {
    // Light mode locked
  };

  const setTheme = () => {
    // Light mode locked
  };

  return (
    <ThemeContext.Provider value={{ theme: 'light', toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
