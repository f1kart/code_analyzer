import React from 'react';
import './TopBarLoader.css';

interface TopBarLoaderProps {
  isLoading: boolean;
}

export const TopBarLoader: React.FC<TopBarLoaderProps> = ({ isLoading }) => {
  if (!isLoading) return null;

  return (
    <div className="top-bar-loader">
      <div className="loader-bar"></div>
    </div>
  );
};
