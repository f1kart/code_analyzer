/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Dark theme colors for proper contrast
        background: '#1a202c', // Dark background
        panel: '#2d3748', // Dark panels
        'panel-light': '#374151', // Lighter dark panels
        interactive: '#4a5568', // Interactive elements
        border: '#4a5568', // Borders
        'text-primary': '#f7fafc', // Light text for primary content
        'text-secondary': '#cbd5e0', // Light gray for secondary text
        'text-tertiary': '#a0aec0', // Medium gray for tertiary text
        'brand-blue': '#63b3ed', // Lighter blue for branding
        'brand-green': '#68d391', // Lighter green for success
        'brand-red': '#fc8181', // Lighter red for errors
        'brand-purple': '#b794f4', // Lighter purple for accents
        'brand-orange': '#f6ad55', // Orange for warnings
        'brand-yellow': '#f6e05e', // Yellow for info
      },
    },
  },
  plugins: [],
}
