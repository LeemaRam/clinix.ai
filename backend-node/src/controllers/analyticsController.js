import { Consultation } from '../models/Consultation.js';
import { Patient } from '../models/Patient.js';
import { FollowUp } from '../models/FollowUp.js';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getDashboardStats = asyncHandler(async (req, res) => {
  const doctorId = req.user.id;

  // Consultation stats
  const totalConsultations = await Consultation.countDocuments({ doctorId });
  const completedConsultations = await Consultation.countDocuments({ doctorId, status: 'transcribed' });
  const pendingConsultations = await Consultation.countDocuments({ doctorId, status: { $in: ['scheduled', 'in_progress'] } });

  // Patient stats
  const totalPatients = await Patient.countDocuments({ doctorId });

  // Follow-up stats
  const totalFollowUps = await FollowUp.countDocuments({ doctorId });
  const pendingFollowUps = await FollowUp.countDocuments({ doctorId, status: { $in: ['scheduled', 'pending'] } });
  const completedFollowUps = await FollowUp.countDocuments({ doctorId, status: 'completed' });

  // Recent consultations
  const recentConsultations = await Consultation.find({ doctorId })
    .populate('patientId', 'firstName lastName')
    .sort({ createdAt: -1 })
    .limit(5);

  // Upcoming follow-ups
  const upcomingFollowUps = await FollowUp.find({ doctorId, followUpDate: { $gte: new Date() } })
    .populate('patientId', 'firstName lastName')
    .sort({ followUpDate: 1 })
    .limit(5);

  res.json({
    success: true,
    data: {
      consultations: {
        total: totalConsultations,
        completed: completedConsultations,
        pending: pendingConsultations
      },
      patients: {
        total: totalPatients
      },
      followUps: {
        total: totalFollowUps,
        pending: pendingFollowUps,
        completed: completedFollowUps
      },
      recentConsultations,
      upcomingFollowUps
    }
  });
});

export const getConsultationAnalytics = asyncHandler(async (req, res) => {
  const doctorId = req.user.id;

  // Monthly consultations
  const monthlyStats = await Consultation.aggregate([
    { $match: { doctorId: doctorId } },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': -1, '_id.month': -1 } },
    { $limit: 12 }
  ]);

  // Consultation types
  const consultationTypes = await Consultation.aggregate([
    { $match: { doctorId: doctorId } },
    {
      $group: {
        _id: '$consultationType',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);

  res.json({
    success: true,
    data: {
      monthlyStats,
      consultationTypes
    }
  });
});