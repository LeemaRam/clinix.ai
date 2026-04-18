import React from 'react';

type RealtimeStatusBadgeProps = {
  label: string;
  tone?: 'info' | 'success' | 'warning' | 'neutral';
};

const toneClasses: Record<NonNullable<RealtimeStatusBadgeProps['tone']>, string> = {
  info: 'bg-primary-50 text-primary-700 border-primary-200',
  success: 'bg-success-50 text-success-700 border-success-200',
  warning: 'bg-warning-50 text-warning-700 border-warning-200',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200'
};

const RealtimeStatusBadge: React.FC<RealtimeStatusBadgeProps> = ({ label, tone = 'info' }) => {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClasses[tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${tone === 'success' ? 'bg-success-500' : tone === 'warning' ? 'bg-warning-500' : tone === 'neutral' ? 'bg-slate-400' : 'bg-primary-500'}`} />
      {label}
    </span>
  );
};

export default RealtimeStatusBadge;
