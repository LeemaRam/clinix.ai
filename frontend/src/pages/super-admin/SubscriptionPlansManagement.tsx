import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FaPlus,
  FaPencilAlt,
  FaTrash,
  FaEye,
  FaEyeSlash,
  FaDollarSign,
  FaUsers,
  FaChartBar
} from 'react-icons/fa';
import { SubscriptionPlan, CreatePlanRequest } from '../../types/subscription';
import { toast } from 'react-toastify';
import { adminSubscriptionApi } from '../../services/subscriptionService';

interface PlanFormData {
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'month' | 'year' | 'trial';
  transcriptionsPerMonth: number;
  diskSpaceGB: number;
  features: string[];
  popular: boolean;
  trial_days: number;
  admin_only: boolean;
}

const SubscriptionPlansManagement: React.FC = () => {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [formData, setFormData] = useState<PlanFormData>({
    name: '',
    description: '',
    price: 0,
    currency: 'USD',
    interval: 'month',
    transcriptionsPerMonth: 0,
    diskSpaceGB: 0,
    features: [''],
    popular: false,
    trial_days: 0,
    admin_only: false
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const data = await adminSubscriptionApi.getPlans();
      setPlans(data.plans);
    } catch (error) {
      console.error('Failed to fetch plans:', error);
      toast.error(t('superAdmin.errorFetchingPlans'));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: 0,
      currency: 'USD',
      interval: 'month',
      transcriptionsPerMonth: 0,
      diskSpaceGB: 0,
      features: [''],
      popular: false,
      trial_days: 0,
      admin_only: false
    });
    setEditingPlan(null);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (plan: SubscriptionPlan) => {
    setFormData({
      name: plan.name,
      description: plan.description,
      price: plan.price,
      currency: plan.currency,
      interval: plan.interval,
      transcriptionsPerMonth: plan.transcriptionsPerMonth,
      diskSpaceGB: plan.diskSpaceGB,
      features: plan.features,
      popular: plan.popular || false,
      trial_days: plan.trial_days || 0,
      admin_only: plan.admin_only || false
    });
    setEditingPlan(plan);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleFeatureChange = (index: number, value: string) => {
    const newFeatures = [...formData.features];
    newFeatures[index] = value;
    setFormData({ ...formData, features: newFeatures });
  };

  const addFeature = () => {
    setFormData({ ...formData, features: [...formData.features, ''] });
  };

  const removeFeature = (index: number) => {
    if (formData.features.length > 1) {
      const newFeatures = formData.features.filter((_, i) => i !== index);
      setFormData({ ...formData, features: newFeatures });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const request: CreatePlanRequest = {
        name: formData.name,
        description: formData.description,
        price: formData.price,
        currency: formData.currency,
        interval: formData.interval,
        transcriptionsPerMonth: formData.transcriptionsPerMonth,
        diskSpaceGB: formData.diskSpaceGB,
        features: formData.features.filter(f => f.trim() !== ''),
        trial_days: formData.interval === 'trial' ? formData.trial_days : undefined,
        admin_only: formData.admin_only
      };

      if (editingPlan) {
        // Update existing plan
        await adminSubscriptionApi.updatePlan(editingPlan.id, request);
        toast.success(t('superAdmin.planUpdated'));
      } else {
        // Create new plan
        await adminSubscriptionApi.createPlan(request);
        toast.success(t('superAdmin.planCreated'));
      }

      closeModal();
      fetchPlans(); // Refresh the list
    } catch (error) {
      console.error('Failed to save plan:', error);
      toast.error(t('superAdmin.errorCreatingPlan'));
    } finally {
      setSubmitting(false);
    }
  };

  const togglePlanStatus = async (plan: SubscriptionPlan) => {
    try {
      const result = await adminSubscriptionApi.togglePlanStatus(plan.id);
      
      // Update local state
      setPlans(plans.map(p => 
        p.id === plan.id ? result.plan : p
      ));
      
      toast.success(result.message === 'Plan activated successfully' ? t('superAdmin.planActivated') : t('superAdmin.planDeactivated'));
    } catch (error) {
      console.error('Failed to toggle plan status:', error);
      toast.error(t('superAdmin.errorUpdatingPlanStatus'));
    }
  };

  const deletePlan = async (plan: SubscriptionPlan) => {
    const confirmed = window.confirm(
      `${t('superAdmin.confirmDeletePlan')} "${plan.name}" ${t('superAdmin.planDeleteMessage')}`
    );

    if (!confirmed) return;

    try {
      await adminSubscriptionApi.deletePlan(plan.id);
      
      setPlans(plans.filter(p => p.id !== plan.id));
      toast.success(t('superAdmin.planDeleted'));
    } catch (error) {
      console.error('Failed to delete plan:', error);
      toast.error(t('superAdmin.errorDeletingPlan'));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('superAdmin.subscriptionPlansManagement')}</h1>
          <p className="text-gray-600 mt-1">{t('superAdmin.manageSubscriptionPlans')}</p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center"
        >
          <FaPlus className="h-4 w-4 mr-2" />
          {t('superAdmin.createPlan')}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FaChartBar className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">{t('superAdmin.totalPlans')}</p>
              <p className="text-2xl font-bold text-gray-900">{plans.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <FaEye className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">{t('superAdmin.activePlans')}</p>
              <p className="text-2xl font-bold text-gray-900">
                {plans.filter(p => p.active).length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <FaDollarSign className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">{t('superAdmin.avgPrice')}</p>
              <p className="text-2xl font-bold text-gray-900">
                ${Math.round(plans.reduce((sum, p) => sum + p.price, 0) / plans.length || 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Plans Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('superAdmin.plan')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('superAdmin.price')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('superAdmin.limits')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('superAdmin.status')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('superAdmin.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {plans.map((plan) => (
                <tr key={plan.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div>
                        <div className="flex items-center">
                          <div className="text-sm font-medium text-gray-900">
                            {plan.name}
                          </div>
                          {plan.popular && (
                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {t('superAdmin.popular')}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">{plan.description}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {plan.interval === 'trial' 
                        ? `${plan.trial_days || 0} ${t('superAdmin.days')} ${t('superAdmin.trial')}`
                        : `$${plan.price}/${plan.interval === 'month' ? t('superAdmin.month') : t('superAdmin.year')}`
                      }
                    </div>
                    <div className="text-sm text-gray-500">
                      {plan.interval === 'trial' ? t('superAdmin.trialPlan') : plan.currency}
                      {plan.admin_only && (
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          {t('superAdmin.adminOnly')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {plan.transcriptionsPerMonth} {t('superAdmin.transcriptions')}
                    </div>
                    <div className="text-sm text-gray-500">
                      {plan.diskSpaceGB}{t('superAdmin.gb')} {t('superAdmin.storage')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      plan.active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {plan.active ? t('superAdmin.active') : t('superAdmin.inactive')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => openEditModal(plan)}
                        className="text-blue-600 hover:text-blue-900"
                        title={t('superAdmin.editPlan')}
                      >
                        <FaPencilAlt className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => togglePlanStatus(plan)}
                        className={`${
                          plan.active ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'
                        }`}
                        title={plan.active ? t('superAdmin.deactivatePlan') : t('superAdmin.activatePlan')}
                      >
                        {plan.active ? (
                          <FaEyeSlash className="h-4 w-4" />
                        ) : (
                          <FaEye className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => deletePlan(plan)}
                        className="text-red-600 hover:text-red-900"
                        title={t('superAdmin.deletePlan')}
                      >
                        <FaTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl bg-white rounded-lg shadow-lg">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingPlan ? t('superAdmin.editExistingPlan') : t('superAdmin.createNewPlan')}
              </h3>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('superAdmin.planName')}
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('superAdmin.interval')}
                  </label>
                  <select
                    value={formData.interval}
                    onChange={(e) => setFormData({ ...formData, interval: e.target.value as 'month' | 'year' | 'trial' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="month">{t('superAdmin.monthly')}</option>
                    <option value="year">{t('superAdmin.yearly')}</option>
                    <option value="trial">{t('superAdmin.trial')}</option>
                  </select>
                </div>
              </div>

              <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('superAdmin.description')}
              </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('superAdmin.price')}
                  </label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    required
                    min="0"
                    step="0.01"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('superAdmin.transcriptionsPerMonthLabel')}
                  </label>
                  <input
                    type="number"
                    value={formData.transcriptionsPerMonth}
                    onChange={(e) => setFormData({ ...formData, transcriptionsPerMonth: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    required
                    min="0"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('superAdmin.storageGB')}
                  </label>
                  <input
                    type="number"
                    value={formData.diskSpaceGB}
                    onChange={(e) => setFormData({ ...formData, diskSpaceGB: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    required
                    min="0"
                  />
                </div>
              </div>

              <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('superAdmin.features')}
              </label>
                {formData.features.map((feature, index) => (
                  <div key={index} className="flex mb-2">
                    <input
                      type="text"
                      value={feature}
                      onChange={(e) => handleFeatureChange(index, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                      placeholder={t('superAdmin.featureDescription')}
                    />
                    {formData.features.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeFeature(index)}
                                              className="ml-2 px-3 py-2 text-red-600 hover:text-red-900"
                    >
                      <FaTrash className="h-4 w-4" />
                    </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addFeature}
                  className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                >
                  {t('superAdmin.addFeature')}
                </button>
              </div>

              {/* Trial Days - Only show for trial plans */}
              {formData.interval === 'trial' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('superAdmin.trialDays')}
                  </label>
                  <input
                    type="number"
                    value={formData.trial_days}
                    onChange={(e) => setFormData({ ...formData, trial_days: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    min="1"
                    max="365"
                    placeholder="15"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {t('superAdmin.trialDaysDescription')}
                  </p>
                </div>
              )}

              <div className="flex items-center space-x-6">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.popular}
                    onChange={(e) => setFormData({ ...formData, popular: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-900">
                    {t('superAdmin.markAsPopular')}
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.admin_only}
                    onChange={(e) => setFormData({ ...formData, admin_only: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-900">
                    {t('superAdmin.adminOnlyPlan')}
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {submitting ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {editingPlan ? t('superAdmin.updating') : t('superAdmin.creating')}
                    </div>
                  ) : (
                    editingPlan ? t('superAdmin.updatePlan') : t('superAdmin.createPlan')
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionPlansManagement; 