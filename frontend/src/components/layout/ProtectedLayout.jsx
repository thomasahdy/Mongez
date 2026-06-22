import React from 'react';
import { Outlet } from 'react-router';
import Sidebar from './Sidebar';

const ProtectedLayout = ({ setLanguage, language }) => {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 font-sans animate-fadeIn">
      <div className="hidden lg:block shrink-0">
        <Sidebar setLanguage={setLanguage} language={language} />
      </div>
      <Outlet />
    </div>
  );
};

export default ProtectedLayout;
