import React from 'react';
import AppShell from './AppShell';

const UserLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <AppShell>{children}</AppShell>
  );
};

export default UserLayout; 