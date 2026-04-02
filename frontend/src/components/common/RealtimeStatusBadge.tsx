import React from 'react';

type RealtimeStatusBadgeProps = {
  label: string;
  tone?: 'info' | 'success' | 'warning' | 'neutral';
};

const toneClasses: Record<NonNullable<RealtimeStatusBadgeProps['tone']>, string> = {
  info: 'bg-blue-100 text-blue-800 border-blue-200',
  success: 'bg-green-100 text-green-800 border-green-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  neutral: 'bg-gray-100 text-gray-800 border-gray-200'
};

const RealtimeStatusBadge: React.FC<RealtimeStatusBadgeProps> = ({ label, tone = 'info' }) => {
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${toneClasses[tone]}`}>
      {label}
    </span>
  );
};

export default RealtimeStatusBadge;
