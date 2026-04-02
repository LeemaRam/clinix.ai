import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Users,
  Loader2,
  X,
  Mail,
  User,
  Lock,
  AlertTriangle,
  CreditCard,
  UserCheck,
  UserX
} from 'lucide-react';
import { toast } from 'react-toastify';
import { SubscriptionPlan } from '../../types/subscription';
import { adminSubscriptionApi } from '../../services/subscriptionService';
import { apiFetch, getAuthHeaders, unwrapApiData } from '../../services/apiFetch';

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
  created_at: string;
  last_login?: string;
  is_active: boolean;
  subscription_plan_id?: string;
}

interface CreateUserData {
  full_name: string;
  email: string;
  password: string;
  role: string;
  subscription_plan_id?: string;
}

interface EditUserData {
  id: string;
  full_name: string;
  email: string;
  role: string;
  subscription_plan_id?: string;
}

const UserManagement: React.FC = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [createUserData, setCreateUserData] = useState<CreateUserData>({
    full_name: '',
    email: '',
    password: '',
    role: 'doctor',
    subscription_plan_id: ''
  });
  const [editUserData, setEditUserData] = useState<EditUserData>({
    id: '',
    full_name: '',
    email: '',
    role: 'doctor'
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [trialPlan_Id, setTrialPlanId] = useState('')
  const fetchUsers = async () => {
    try {
      const response = await apiFetch<{ users?: User[] }>({
        path: '/super-admin/users',
        method: 'GET',
        headers: getAuthHeaders()
      });
      const payload = unwrapApiData<{ users?: User[] }>(response.data as any);
      setUsers(payload.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error(t('superAdmin.errorFetchingUsers'));
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscriptionPlans = async () => {
    try {
      setPlansLoading(true);
      const data = await adminSubscriptionApi.getPlans();
      setSubscriptionPlans(data.plans || []);
    } catch (error) {
      console.error('Error fetching subscription plans:', error);
      toast.error(t('superAdmin.errorFetchingPlans'));
    } finally {
      setPlansLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchSubscriptionPlans();
  }, []);

  // Auto-select trial plan as default for new users
  useEffect(() => {
    if (subscriptionPlans.length > 0 && !plansLoading) {
      const trialPlan: any = subscriptionPlans.find(plan => plan.interval === 'trial');
      setTrialPlanId(trialPlan.id)
      if (trialPlan) {
        setCreateUserData(prev => ({
          ...prev,
          subscription_plan_id: trialPlan.id
        }));
      } else {
        // If no trial plan available, select the first available plan
        setCreateUserData(prev => ({
          ...prev,
          subscription_plan_id: subscriptionPlans[0]?.id || ''
        }));
      }
    }
  }, [subscriptionPlans, plansLoading]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    // Ensure subscription plan is selected for doctors
    if (createUserData.role === 'doctor' && !createUserData.subscription_plan_id) {
      toast.error(t('superAdmin.subscriptionPlanRequired'));
      return;
    }

    setCreateLoading(true);

    try {
      // Prepare the data to send, including subscription plan for doctors
      const createData = {
        full_name: createUserData.full_name,
        email: createUserData.email,
        password: createUserData.password,
        role: createUserData.role,
        ...(createUserData.role === 'doctor' && { subscription_plan_id: createUserData.subscription_plan_id })
      };

      const response = await apiFetch<{ user?: User }>({
        path: '/super-admin/users',
        method: 'POST',
        data: createData,
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        }
      });

      const payload = unwrapApiData<{ user?: User }>(response.data as any);
      if (payload.user) {
        setUsers([...users, payload.user]);
      }
      setShowCreateModal(false);
      resetCreateForm();
      toast.success(t('superAdmin.userCreated'));
    } catch (error: any) {
      const message = error.response?.data?.error || t('superAdmin.errorCreatingUser');
      toast.error(message);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();

    // Ensure subscription plan is selected for doctors
    if (editUserData.role === 'doctor' && !editUserData.subscription_plan_id) {
      toast.error(t('superAdmin.subscriptionPlanRequired'));
      return;
    }

    setEditLoading(true);

    try {
      // Prepare the data to send, including subscription plan
      const updateData = {
        full_name: editUserData.full_name,
        email: editUserData.email,
        role: editUserData.role,
        ...(editUserData.role === 'doctor' && { subscription_plan_id: editUserData.subscription_plan_id })
      };

      const response = await apiFetch<{ user?: User }>({
        path: `/super-admin/users/${editUserData.id}`,
        method: 'PUT',
        data: updateData,
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        }
      });

      const payload = unwrapApiData<{ user?: User }>(response.data as any);
      setUsers(users.map(user =>
        user.id === editUserData.id && payload.user ? payload.user : user
      ));
      setShowEditModal(false);
      toast.success(t('superAdmin.userUpdated'));
    } catch (error: any) {
      const message = error.response?.data?.error || t('superAdmin.errorUpdatingUser');
      toast.error(message);
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setDeleteLoading(true);

    try {
      await apiFetch({
        path: `/super-admin/users/${userToDelete.id}`,
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      setUsers(users.filter(user => user.id !== userToDelete.id));
      setShowDeleteModal(false);
      setUserToDelete(null);
      toast.success(t('superAdmin.userDeleted'));
    } catch (error: any) {
      const message = error.response?.data?.error || t('superAdmin.errorDeletingUser');
      toast.error(message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const toggleUserStatus = async (user: User) => {
    try {
      await apiFetch({
        path: `/super-admin/users/${user.id}/toggle-status`,
        method: 'PATCH',
        data: {},
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        }
      });

      setUsers(users.map(u =>
        u.id === user.id ? { ...u, is_active: !u.is_active } : u
      ));

      const statusText = user.is_active ? t('superAdmin.userDeactivated') : t('superAdmin.userActivated');
      toast.success(statusText);
    } catch (error: any) {
      const message = error.response?.data?.error || t('superAdmin.errorUpdatingUserStatus');
      toast.error(message);
    }
  };

  const openEditModal = (user: User) => {
    setEditUserData({
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      subscription_plan_id: user.subscription_plan_id || trialPlan_Id
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (user: User) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const openCreateModal = () => {
    const trialPlan = subscriptionPlans.find(plan => plan.interval === 'trial');
    setCreateUserData({
      full_name: '',
      email: '',
      password: '',
      role: 'doctor',
      subscription_plan_id: trialPlan ? trialPlan.id : (subscriptionPlans[0]?.id || '')
    });
    setShowCreateModal(true);
  };

  const resetCreateForm = () => {
    const trialPlan = subscriptionPlans.find(plan => plan.interval === 'trial');
    setCreateUserData({
      full_name: '',
      email: '',
      password: '',
      role: 'doctor',
      subscription_plan_id: trialPlan ? trialPlan.id : (subscriptionPlans[0]?.id || '')
    });
  };

  const filteredUsers = users.filter(user =>
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'super_admin': return t('superAdmin.superAdmin');
      case 'admin': return t('superAdmin.admin');
      case 'doctor': return t('superAdmin.doctor');
      default: return role;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin': return 'bg-red-100 text-red-800';
      case 'admin': return 'bg-blue-100 text-blue-800';
      case 'doctor': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusDisplay = (isActive: boolean) => {
    return isActive ? t('superAdmin.active') : t('superAdmin.inactive');
  };

  const getStatusBadgeColor = (isActive: boolean) => {
    return isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  const getSubscriptionPlanInfo = (planId: string) => {
    return subscriptionPlans.find(plan => plan.id === planId);
  };

  const isTrialPlan = (planId: string) => {
    const plan = getSubscriptionPlanInfo(planId);
    return plan?.interval === 'trial';
  };

  const getTrialExpirationInfo = (user: User) => {
    if (!user.subscription_plan_id || !isTrialPlan(user.subscription_plan_id)) return null;

    // For now, we'll show that it's a 30-day trial
    // In a real implementation, you'd calculate the actual expiration date
    return {
      daysRemaining: 30, // This would be calculated from the backend
      isExpired: false   // This would be calculated from the backend
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">
          {t('superAdmin.userManagement')}
        </h1>
        <button
          onClick={openCreateModal}
          className="flex items-center px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
        >
          <Plus size={20} className="mr-2" />
          {t('superAdmin.addUser')}
        </button>
      </div>

      {/* Trial Plan Summary */}
      {subscriptionPlans.some(p => p.interval === 'trial') && (
        <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <CreditCard className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-orange-800">
                  {t('superAdmin.trialPlanManagement')}
                </h3>
                <p className="text-orange-600 text-sm">
                  {t('superAdmin.trialPlanSummary')} - 30 {t('superAdmin.days')} {t('superAdmin.freeAccessDefault')}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-orange-800">
                {users.filter(u => u.role === 'doctor' && u.subscription_plan_id && isTrialPlan(u.subscription_plan_id)).length}
              </div>
              <div className="text-sm text-orange-600">
                {t('superAdmin.usersOnTrial')}
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="text-orange-700">
              <span className="font-medium">{t('superAdmin.availableTrialPlans')}:</span> {subscriptionPlans.filter(p => p.interval === 'trial').length}
            </div>
            <div className="text-orange-700">
              <span className="font-medium">{t('superAdmin.doctorsWithoutPlan')}:</span> {users.filter(u => u.role === 'doctor' && !u.subscription_plan_id).length}
            </div>
            <div className="text-orange-700">
              <span className="font-medium">{t('superAdmin.totalDoctors')}:</span> {users.filter(u => u.role === 'doctor').length}
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder={t('superAdmin.searchUsers')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
        />
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('superAdmin.user')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('superAdmin.role')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('superAdmin.subscription')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('superAdmin.status')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('superAdmin.created')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('superAdmin.lastLogin')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('superAdmin.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <Users className="h-5 w-5 text-gray-500" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {user.full_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(user.role)}`}>
                      {getRoleDisplay(user.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.role === 'doctor' ? (
                      user.subscription_plan_id ? (
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${isTrialPlan(user.subscription_plan_id)
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-green-100 text-green-800'
                              }`}>
                              {isTrialPlan(user.subscription_plan_id) ? `🆓 ${t('superAdmin.trialPlan')}` : `💳 ${t('superAdmin.activePlan')}`}
                            </span>
                            <span className="text-xs text-gray-500">
                              {getSubscriptionPlanInfo(user.subscription_plan_id)?.name || t('superAdmin.unknownPlan')}
                            </span>
                          </div>
                          {isTrialPlan(user.subscription_plan_id) && (
                            <div className="text-xs text-orange-600">
                              {getTrialExpirationInfo(user)?.isExpired ? t('superAdmin.expired') : `30 ${t('superAdmin.daysTrial')}`}
                            </div>
                          )}
                          <div className="text-xs text-gray-500">
                            {getSubscriptionPlanInfo(user.subscription_plan_id)?.transcriptionsPerMonth || 0} {t('superAdmin.transcriptions')},
                            {getSubscriptionPlanInfo(user.subscription_plan_id)?.diskSpaceGB || 0}{t('superAdmin.gb')} {t('superAdmin.storage')}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">
                            {t('superAdmin.noPlan')}
                          </span>
                          <div className="text-xs text-gray-400">
                            {t('superAdmin.assignPlanToEnable')}
                          </div>
                        </div>
                      )
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(user.is_active)}`}>
                      {getStatusDisplay(user.is_active)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.last_login
                      ? new Date(user.last_login).toLocaleDateString()
                      : t('superAdmin.never')
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => openEditModal(user)}
                        className="text-cyan-600 hover:text-cyan-900 transition-colors"
                        title={t('superAdmin.editUser')}
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => toggleUserStatus(user)}
                        className="text-blue-600 hover:text-blue-900 transition-colors"
                        title={user.is_active ? t('superAdmin.deactivateUser') : t('superAdmin.activateUser')}
                      >
                        {user.is_active ? <UserX size={16} /> : <UserCheck size={16} />}
                      </button>
                      <button
                        onClick={() => openDeleteModal(user)}
                        className="text-red-600 hover:text-red-900 transition-colors"
                        title={t('superAdmin.deleteUser')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{t('superAdmin.addUser')}</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('auth.fullName')}
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    required
                    value={createUserData.full_name}
                    onChange={(e) => setCreateUserData({ ...createUserData, full_name: e.target.value })}
                    className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('auth.email')}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="email"
                    required
                    value={createUserData.email}
                    onChange={(e) => setCreateUserData({ ...createUserData, email: e.target.value })}
                    className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('auth.password')}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="password"
                    required
                    value={createUserData.password}
                    onChange={(e) => setCreateUserData({ ...createUserData, password: e.target.value })}
                    className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('superAdmin.userRole')}
                </label>
                <select
                  value={createUserData.role}
                  onChange={(e) => setCreateUserData({ ...createUserData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                >
                  <option value="doctor">{t('superAdmin.doctor')}</option>
                  <option value="admin">{t('superAdmin.admin')}</option>
                  <option value="super_admin">{t('superAdmin.superAdmin')}</option>
                </select>
              </div>

              {/* Subscription Plan Selection - Only show for doctors */}
              {createUserData.role === 'doctor' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <div className="flex items-center">
                      <CreditCard className="w-4 h-4 mr-2" />
                      {t('superAdmin.subscriptionPlan')}
                    </div>
                  </label>
                  <select
                    value={createUserData.subscription_plan_id}
                    onChange={(e) => setCreateUserData({ ...createUserData, subscription_plan_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                    disabled={plansLoading}
                    required
                  >
                    {plansLoading ? (
                      <option disabled>{t('superAdmin.loadingPlans')}</option>
                    ) : (
                      <>
                        {/* Trial Plans First - Default for new users */}
                        {subscriptionPlans
                          .filter(plan => plan.interval === 'trial')
                          .map((plan) => (
                            <option key={plan.id} value={plan.id} className="font-semibold">
                              🆓 {plan.name} - 30 {t('superAdmin.days')} {t('superAdmin.trial')} (Default)
                              ({plan.transcriptionsPerMonth} {t('superAdmin.transcriptionsPerMonth')}, {plan.diskSpaceGB}{t('superAdmin.gb')} {t('superAdmin.storage')})
                            </option>
                          ))
                        }
                        {/* Divider */}
                        {subscriptionPlans.some(p => p.interval === 'trial') &&
                          subscriptionPlans.some(p => p.interval !== 'trial') && (
                            <option disabled>───────────</option>
                          )}
                        {/* All Other Plans */}
                        {subscriptionPlans
                          .filter(plan => plan.interval !== 'trial')
                          .map((plan) => (
                            <option key={plan.id} value={plan.id}>
                              ${plan.price}/{plan.interval === 'month' ? t('superAdmin.month') : t('superAdmin.year')} - {plan.name}
                              ({plan.transcriptionsPerMonth} {t('superAdmin.transcriptionsPerMonth')}, {plan.diskSpaceGB}{t('superAdmin.gb')} {t('superAdmin.storage')})
                              {plan.admin_only ? ` - ${t('superAdmin.adminOnly')}` : ''}
                            </option>
                          ))
                        }
                      </>
                    )}
                  </select>
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-gray-500">
                      {t('superAdmin.subscriptionPlanDescription')}
                    </p>
                    {subscriptionPlans.some(p => p.interval === 'trial') && (
                      <p className="text-xs text-orange-600 font-medium">
                        💡 {t('superAdmin.trialPlanTip')} - 30 {t('superAdmin.days')} free access (Default for new users)
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 transition-colors"
                >
                  {createLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin inline mr-2" />
                      {t('superAdmin.creating')}
                    </>
                  ) : (
                    t('common.create')
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{t('superAdmin.editUser')}</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('auth.fullName')}
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    required
                    value={editUserData.full_name}
                    onChange={(e) => setEditUserData({ ...editUserData, full_name: e.target.value })}
                    className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('auth.email')}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="email"
                    required
                    value={editUserData.email}
                    onChange={(e) => setEditUserData({ ...editUserData, email: e.target.value })}
                    className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('superAdmin.userRole')}
                </label>
                <select
                  value={editUserData.role}
                  onChange={(e) => setEditUserData({ ...editUserData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                >
                  <option value="doctor">{t('superAdmin.doctor')}</option>
                  <option value="admin">{t('superAdmin.admin')}</option>
                  <option value="super_admin">{t('superAdmin.superAdmin')}</option>
                </select>
              </div>

              {/* Subscription Plan Selection - Only show for doctors */}
              {editUserData.role === 'doctor' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <div className="flex items-center">
                      <CreditCard className="w-4 h-4 mr-2" />
                      {t('superAdmin.subscriptionPlan')}
                    </div>
                  </label>
                  <select
                    value={editUserData.subscription_plan_id}
                    onChange={(e) => setEditUserData({ ...editUserData, subscription_plan_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                    disabled={plansLoading}
                    required
                  >
                    {plansLoading ? (
                      <option disabled>{t('superAdmin.loadingPlans')}</option>
                    ) : (
                      <>
                        {/* Trial Plans First - Default for new users */}
                        {subscriptionPlans
                          .filter(plan => plan.interval === 'trial')
                          .map((plan) => (
                            <option key={plan.id} value={plan.id} className="font-semibold">
                              🆓 {plan.name} - 30 {t('superAdmin.days')} {t('superAdmin.trial')} (Default)
                              ({plan.transcriptionsPerMonth} {t('superAdmin.transcriptionsPerMonth')}, {plan.diskSpaceGB}{t('superAdmin.gb')} {t('superAdmin.storage')})
                            </option>
                          ))
                        }
                        {/* Divider */}
                        {subscriptionPlans.some(p => p.interval === 'trial') &&
                          subscriptionPlans.some(p => p.interval !== 'trial') && (
                            <option disabled>───────────</option>
                          )}
                        {/* All Other Plans */}
                        {subscriptionPlans
                          .filter(plan => plan.interval !== 'trial')
                          .map((plan) => (
                            <option key={plan.id} value={plan.id}>
                              ${plan.price}/{plan.interval === 'month' ? t('superAdmin.month') : t('superAdmin.year')} - {plan.name}
                              ({plan.transcriptionsPerMonth} {t('superAdmin.transcriptionsPerMonth')}, {plan.diskSpaceGB}{t('superAdmin.gb')} {t('superAdmin.storage')})
                              {plan.admin_only ? ` - ${t('superAdmin.adminOnly')}` : ''}
                            </option>
                          ))
                        }
                      </>
                    )}
                  </select>
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-gray-500">
                      {t('superAdmin.subscriptionPlanDescription')}
                    </p>
                    {subscriptionPlans.some(p => p.interval === 'trial') && (
                      <p className="text-xs text-orange-600 font-medium">
                        💡 {t('superAdmin.trialPlanTip')} - 30 {t('superAdmin.days')} free access (Default for new users)
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 transition-colors"
                >
                  {editLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin inline mr-2" />
                      {t('superAdmin.updating')}
                    </>
                  ) : (
                    t('common.update')
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && userToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  {t('superAdmin.confirmDelete')}
                </h3>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-600">
                {t('superAdmin.deleteUserMessage', { name: userToDelete.full_name })}
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setUserToDelete(null);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={deleteLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleteLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin inline mr-2" />
                    {t('superAdmin.deleting')}
                  </>
                ) : (
                  t('common.delete')
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement; 