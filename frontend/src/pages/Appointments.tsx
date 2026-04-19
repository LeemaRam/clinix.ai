import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getAppointments, updateAppointment } from '../services/appointmentService';

interface Appointment {
  _id: string;
  patientName: string;
  patientPhone: string;
  preferredDate: string;
  reason: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: string;
}

const Appointments = () => {
  const { t } = useTranslation();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const response = await getAppointments();
      const payload = response?.data?.data ?? response?.data;
      setAppointments(Array.isArray(payload) ? payload : []);
    } catch (err) {
      setError('Failed to load appointments');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'confirmed' | 'cancelled') => {
    try {
      setUpdating(id);
      await updateAppointment(id, status);
      await fetchAppointments();
    } catch (err) {
      console.error('Failed to update appointment', err);
    } finally {
      setUpdating(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'confirmed': return 'text-green-600 bg-green-100';
      case 'cancelled': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock size={16} />;
      case 'confirmed': return <CheckCircle size={16} />;
      case 'cancelled': return <XCircle size={16} />;
      default: return <Clock size={16} />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Appointments</h1>

      <div className="space-y-4">
        {appointments.map((appointment) => (
          <div key={appointment._id} className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-4 mb-2">
                  <h3 className="text-lg font-semibold">{appointment.patientName}</h3>
                  <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs ${getStatusColor(appointment.status)}`}>
                    {getStatusIcon(appointment.status)}
                    <span className="capitalize">{appointment.status}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-600">Phone</p>
                    <p className="font-medium">{appointment.patientPhone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Preferred Date</p>
                    <p className="font-medium">{new Date(appointment.preferredDate).toLocaleDateString()}</p>
                  </div>
                </div>

                {appointment.reason && (
                  <div className="mb-4">
                    <p className="text-sm text-gray-600">Reason</p>
                    <p className="text-sm">{appointment.reason}</p>
                  </div>
                )}

                <div className="text-sm text-gray-500">
                  Booked on: {new Date(appointment.createdAt).toLocaleString()}
                </div>
              </div>

              <div className="ml-4 flex flex-col space-y-2">
                {appointment.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleUpdateStatus(appointment._id, 'confirmed')}
                      disabled={updating === appointment._id}
                      className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-400"
                    >
                      {updating === appointment._id ? (
                        <Loader2 size={16} className="animate-spin mr-2" />
                      ) : (
                        <CheckCircle size={16} className="mr-2" />
                      )}
                      Confirm
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(appointment._id, 'cancelled')}
                      disabled={updating === appointment._id}
                      className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-400"
                    >
                      {updating === appointment._id ? (
                        <Loader2 size={16} className="animate-spin mr-2" />
                      ) : (
                        <XCircle size={16} className="mr-2" />
                      )}
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}

        {appointments.length === 0 && (
          <div className="text-center py-12">
            <Clock size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No appointments</h3>
            <p className="text-gray-500">Appointments will appear here when patients book them.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Appointments;