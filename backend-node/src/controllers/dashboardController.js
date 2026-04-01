import { asyncHandler } from '../utils/asyncHandler.js';
import { Patient } from '../models/Patient.js';
import { Consultation } from '../models/Consultation.js';
import { Report } from '../models/Report.js';

export const stats = asyncHandler(async (req, res) => {
  const doctorId = req.user.id;

  const [patients, consultations, reports] = await Promise.all([
    Patient.countDocuments({ doctorId }),
    Consultation.countDocuments({ doctorId }),
    Report.countDocuments({ doctorId })
  ]);

  res.json({
    totalPatients: patients,
    totalConsultations: consultations,
    totalReports: reports,
    recentActivity: []
  });
});
