import React, { useState, useEffect, useRef } from 'react';
import { useSpaces, useSetActiveSpace } from '../../hooks/api/useSpaces';
import SpaceSwitcherSkeleton from './SpaceSwitcherSkeleton';

export default function SpaceSwitcher() {
  const { data, isLoading } = useSpaces();
  const { mutate: selectSpace } = useSetActiveSpace();
  const [activeSpace, setActiveSpaceState] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const spaces = data?.spaces || [];

  useEffect(() => {
    if (data) {
      const spacesList = data.spaces || [];
      const savedActiveId = localStorage.getItem('activeSpaceId');
      const apiActiveId = data.activeSpaceId;
      const activeId = savedActiveId || apiActiveId || (spacesList[0]?.id);

      const active = spacesList.find(s => s.id === activeId) || spacesList[0];
      setActiveSpaceState(active);

      if (active && active.id !== savedActiveId) {
        localStorage.setItem('activeSpaceId', active.id);
      }
    }
  }, [data]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSpaceSelect = (space) => {
    if (space.id === activeSpace?.id) {
      setIsOpen(false);
      return;
    }

    selectSpace(space.id, {
      onSuccess: () => {
        setActiveSpaceState(space);
        setIsOpen(false);
        // Trigger reload to refresh page content with new space context
        window.location.reload();
      },
    });
  };

  if (isLoading) {
    return <SpaceSwitcherSkeleton />;
  }

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Dropdown Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 transition-all text-left outline-none cursor-pointer"
      >
        {activeSpace?.logo ? (
          <img src={activeSpace.logo} alt="" className="w-6 h-6 rounded-md object-cover" />
        ) : (
          <div className="w-6 h-6 rounded-md bg-indigo-500 dark:bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {activeSpace?.name ? activeSpace.name.charAt(0).toUpperCase() : 'M'}
          </div>
        )}
        
        <span className="flex-1 text-sm font-semibold truncate text-slate-800 dark:text-slate-200">
          {activeSpace?.name || 'Select Workspace'}
        </span>

        {/* Chevron down icon */}
        <svg
          className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 py-1.5 max-h-60 overflow-y-auto animate-slideDown">
          {spaces.length === 0 ? (
            <div className="px-4 py-3 text-xs text-slate-400 text-center">
              No spaces found.
            </div>
          ) : (
            spaces.map((space) => (
              <button
                key={space.id}
                type="button"
                onClick={() => handleSpaceSelect(space)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors cursor-pointer ${
                  space.id === activeSpace?.id
                    ? 'bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 font-semibold'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300'
                }`}
              >
                {space.logo ? (
                  <img src={space.logo} alt="" className="w-5.5 h-5.5 rounded-md object-cover shrink-0" />
                ) : (
                  <div className="w-5.5 h-5.5 rounded-md bg-indigo-500 flex items-center justify-center text-white text-xxs font-bold shrink-0">
                    {space.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="truncate text-xs font-semibold">{space.name}</div>
                  {space.memberCount !== undefined && (
                    <div className="text-xxs text-slate-400 dark:text-slate-500">
                      {space.memberCount} {space.memberCount === 1 ? 'member' : 'members'}
                    </div>
                  )}
                </div>
                {space.id === activeSpace?.id && (
                  <svg className="w-4 h-4 text-indigo-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
