import React from 'react';

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

interface RightClickMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export const RightClickMenu: React.FC<RightClickMenuProps> = ({ x, y, items, onClose }) => {
  return (
    <div
      className="fixed inset-0 z-50"
      onClick={onClose}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div
        className="absolute bg-panel border border-border rounded-md shadow-lg py-1 w-56 left-[var(--menu-left)] top-[var(--menu-top)]"
        style={{ ['--menu-left' as any]: `${x}px`, ['--menu-top' as any]: `${y}px` }}
      >
        <ul>
          {items.map((item, index) => (
            <li key={index}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  item.onClick();
                  onClose();
                }}
                disabled={item.disabled}
                className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm text-text-primary hover:bg-interactive disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
