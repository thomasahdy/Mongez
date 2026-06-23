import React from 'react';

/**
 * Skeleton Loader Component
 * Renders a pulse-animated placeholder block for loading states.
 * @param {Object} props - Component properties
 * @param {string} [props.className] - CSS classes for dimensions and border radii
 */
export default function Skeleton({ className, ...props }) {
  return (
    <div
      className={`animate-pulse bg-slate-200 dark:bg-slate-800 rounded-lg ${className || ''}`}
      {...props}
    />
  );
}
