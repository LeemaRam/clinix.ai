import fs from 'fs';
import { Report } from '../models/Report.js';
import { Consultation } from '../models/Consultation.js';
import { Patient } from '../models/Patient.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { serializeReport, serializePatient } from '../utils/serializers.js';

export const listReports = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 10);

  const [reports, total] = await Promise.all([
    Report.find({ doctorId: req.user.id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Report.countDocuments({ doctorId: req.user.id })
  ]);

  const consultationIds = reports.map((r) => r.consultationId);
  const consultations = await Consultation.find({ _id: { $in: consultationIds } });
  const patientIds = consultations.map((c) => c.patientId);
  const patients = await Patient.find({ _id: { $in: patientIds } });
  const patientMap = new Map(patients.map((p) => [p._id.toString(), serializePatient(p)]));
  const consultationMap = new Map(consultations.map((c) => [c._id.toString(), c]));

  const out = reports.map((r) => {
    const item = serializeReport(r);
    const c = consultationMap.get(r.consultationId.toString());
    item.patient = c ? patientMap.get(c.patientId.toString()) : null;
    return item;
  });

  const data = { reports: out, total, page, pages: Math.ceil(total / limit) };
  res.json({ success: true, data, ...data });
});

export const downloadReport = asyncHandler(async (req, res) => {
  const report = await Report.findOne({ _id: req.params.id, doctorId: req.user.id });
  if (!report) return res.status(404).json({ success: false, error: 'Report not found' });
  if (!report.filePath || !fs.existsSync(report.filePath)) {
    return res.status(404).json({ success: false, error: 'Report file missing' });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="report-${report._id}.pdf"`);
  fs.createReadStream(report.filePath).pipe(res);
});

export const deleteReport = asyncHandler(async (req, res) => {
  const report = await Report.findOneAndDelete({ _id: req.params.id, doctorId: req.user.id });
  if (!report) return res.status(404).json({ success: false, error: 'Report not found' });
  if (report.filePath && fs.existsSync(report.filePath)) fs.unlinkSync(report.filePath);
  res.json({ success: true, data: { deleted: true }, deleted: true });
});

export const getReport = asyncHandler(async (req, res) => {
  const report = await Report.findOne({ _id: req.params.id, doctorId: req.user.id });
  if (!report) return res.status(404).json({ success: false, error: 'Report not found' });

  const consultation = await Consultation.findById(report.consultationId);
  const patient = consultation ? await Patient.findById(consultation.patientId) : null;

  const serialized = serializeReport(report);
  serialized.patient = patient ? serializePatient(patient) : null;
  serialized.download_url = report.filePath ? `/api/reports/${report._id}/download` : '';

  const data = { report: serialized };
  res.json({ success: true, data, ...data });
});
