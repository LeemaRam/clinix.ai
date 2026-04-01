import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex h-screen bg-gray-50">
    <Sidebar />
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-4">
        {children}
      </main>
    </div>
  </div>
);

export default AdminLayout; 