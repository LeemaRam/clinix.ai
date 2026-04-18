import { asyncHandler } from '../utils/asyncHandler.js';
import { Patient } from '../models/Patient.js';
import { Consultation } from '../models/Consultation.js';
import { Report } from '../models/Report.js';
import { Transcription } from '../models/Transcription.js';
import { FollowUp } from '../models/FollowUp.js';
import { Appointment } from '../models/Appointment.js';
import mongoose from 'mongoose';

export const stats = asyncHandler(async (req, res) => {
  const doctorId = req.user.id;

  const [patients, consultations, reports, recentConsultations] = await Promise.all([
    Patient.countDocuments({ doctorId }),
    Consultation.countDocuments({ doctorId }),
    Report.countDocuments({ doctorId }),
    Consultation.find({ doctorId })
      .populate('patientId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean()
  ]);

  const data = {
    total_patients: patients,
    total_consultations: consultations,
    total_reports: reports,
    recent_patients: recentConsultations.map(c => ({
      consultation_id: c._id.toString(),
      patient: {
        id: c.patientId?._id?.toString(),
        first_name: c.patientId?.firstName || 'Unknown',
        last_name: c.patientId?.lastName || '',
      },
      consultation_date: c.createdAt,
      audio_duration: c.audioDuration || 0,
      recording_type: c.recordingType
    })),
    totalPatients: patients,
    totalConsultations: consultations,
    totalReports: reports,
    recentActivity: []
  };

  res.json({ success: true, data, ...data });
});

export const analyticsOverview = asyncHandler(async (req, res) => {
  const doctorId = req.user.id;
  const [patients, consultations, reports, pendingFollowUps, pendingAppointments] =
    await Promise.all([
      Patient.countDocuments({ doctorId }),
      Consultation.countDocuments({ doctorId }),
      Report.countDocuments({ doctorId }),
      FollowUp.countDocuments({ doctorId, status: 'pending' }),
      Appointment.countDocuments({ doctorId, status: 'pending' })
    ]);
  res.json({ success: true, data: {
    total_patients: patients, total_consultations: consultations,
    total_reports: reports, pending_followups: pendingFollowUps,
    pending_appointments: pendingAppointments
  }});
});

export const consultationTrend = asyncHandler(async (req, res) => {
  const doctorId = req.user.id;
  const trend = await Consultation.aggregate([
    { $match: { doctorId: new mongoose.Types.ObjectId(doctorId) } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                count: { $sum: 1 } } },
    { $sort: { _id: 1 } }, { $limit: 30 }
  ]);
  res.json({ success: true, data: trend });
});

export const topDiagnoses = asyncHandler(async (req, res) => {
  const doctorId = req.user.id;
  const diagnoses = await Transcription.aggregate([
    { $match: { doctorId: new mongoose.Types.ObjectId(doctorId) } },
    { $unwind: '$analysis.assessment' },
    { $group: { _id: '$analysis.assessment', count: { $sum: 1 } } },
    { $sort: { count: -1 } }, { $limit: 10 }
  ]);
  res.json({ success: true, data: diagnoses });
});
