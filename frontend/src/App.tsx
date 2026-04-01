import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import PatientEdit from './pages/PatientEdit';
import NewConsultation from './pages/NewConsultation';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Register from './pages/Register';
import PastConsultations from './pages/PastConsultations';
import Pricing from './pages/Pricing';
import SubscriptionManagement from './pages/SubscriptionManagement';
import SubscriptionSuccess from './pages/SubscriptionSuccess';
import SubscriptionCancel from './pages/SubscriptionCancel';
import SuperAdminDashboard from './pages/super-admin/SuperAdminDashboard';
import UserManagement from './pages/super-admin/UserManagement';
import LanguageSettings from './pages/super-admin/LanguageSettings';
import SubscriptionPlansManagement from './pages/super-admin/SubscriptionPlansManagement';
import { AuthProvider } from './context/AuthContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ProtectedRoute from './components/auth/ProtectedRoute';
import SuperAdminRoute from './components/auth/SuperAdminRoute';
import UserLayout from './components/layout/UserLayout';
import AdminLayout from './components/layout/AdminLayout';


function App() {

  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          {/* User Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <UserLayout>
                  <Dashboard />
                </UserLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/patients"
            element={
              <ProtectedRoute>
                <UserLayout>
                  <Patients />
                </UserLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/patients/:id"
            element={
              <ProtectedRoute>
                <UserLayout>
                  <PatientDetail />
                </UserLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/patients/:id/edit"
            element={
              <ProtectedRoute>
                <UserLayout>
                  <PatientEdit />
                </UserLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/new-consultation"
            element={
              <ProtectedRoute>
                <UserLayout>
                  <NewConsultation />
                </UserLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/new-consultation/:patientId"
            element={
              <ProtectedRoute>
                <UserLayout>
                  <NewConsultation />
                </UserLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <UserLayout>
                  <Reports />
                </UserLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/past-consultations"
            element={
              <ProtectedRoute>
                <UserLayout>
                  <PastConsultations />
                </UserLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <UserLayout>
                  <Settings />
                </UserLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/pricing"
            element={
              <ProtectedRoute>
                <UserLayout>
                  <Pricing />
                </UserLayout>
              </ProtectedRoute>
            }
          />
          {/* <Route
            path="/subscription"
            element={
              <ProtectedRoute>
                <UserLayout>
                  <SubscriptionManagement />
                </UserLayout>
              </ProtectedRoute>
            }
          /> */}
          <Route path="/subscription/success" element={<SubscriptionSuccess />} />
          <Route path="/subscription/cancel" element={<SubscriptionCancel />} />

          {/* Super Admin Routes */}
          <Route
            path="/super-admin"
            element={
              <SuperAdminRoute>
                <AdminLayout>
                  <SuperAdminDashboard />
                </AdminLayout>
              </SuperAdminRoute>
            }
          />
          <Route
            path="/super-admin/users"
            element={
              <SuperAdminRoute>
                <AdminLayout>
                  <UserManagement />
                </AdminLayout>
              </SuperAdminRoute>
            }
          />
          <Route
            path="/super-admin/languages"
            element={
              <SuperAdminRoute>
                <AdminLayout>
                  <LanguageSettings />
                </AdminLayout>
              </SuperAdminRoute>
            }
          />
          <Route
            path="/super-admin/subscription-plans"
            element={
              <SuperAdminRoute>
                <AdminLayout>
                  <SubscriptionPlansManagement />
                </AdminLayout>
              </SuperAdminRoute>
            }
          />
        </Routes>
        <ToastContainer position="top-right" autoClose={5000} />
      </Router>
    </AuthProvider>
  );
}

export default App;