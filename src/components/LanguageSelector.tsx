import React from 'react';
import { SUPPORTED_LANGUAGES } from '../constants';

interface LanguageSelectorProps {
  selectedLanguage: string;
  onChange: (language: string) => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  selectedLanguage,
  onChange,
}) => {
  return (
    <select
      id="language-selector"
      value={selectedLanguage}
      onChange={(e) => onChange(e.target.value)}
      className="bg-gray-700/60 border border-gray-600 rounded-md shadow-sm py-1 px-2 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-brand-blue"
      aria-label="Select programming language"
    >
      {SUPPORTED_LANGUAGES.map((lang) => (
        <option key={lang.value} value={lang.value}>
          {lang.label}
        </option>
      ))}
    </select>
  );
};
