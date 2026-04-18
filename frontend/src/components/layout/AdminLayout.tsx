import React from 'react';
import AppShell from './AppShell';

const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AppShell>{children}</AppShell>
);

export default AdminLayout; 