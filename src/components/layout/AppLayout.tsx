import React from 'react';
import Sidebar from './Sidebar';

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-[240px] p-6">
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
