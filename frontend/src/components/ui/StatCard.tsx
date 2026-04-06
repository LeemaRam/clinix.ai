import React from 'react';

type StatCardProps = {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  tone?: 'primary' | 'accent' | 'success' | 'warning' | 'error';
  description?: string;
};

const toneStyles: Record<NonNullable<StatCardProps['tone']>, string> = {
  primary: 'from-primary-500 to-primary-600 text-white',
  accent: 'from-accent-500 to-accent-600 text-white',
  success: 'from-success-500 to-success-600 text-white',
  warning: 'from-warning-500 to-warning-600 text-white',
  error: 'from-error-500 to-error-600 text-white'
};

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, tone = 'primary', description }) => {
  return (
    <div className="section-card p-5 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
          {description && <p className="mt-2 text-sm text-slate-500">{description}</p>}
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${toneStyles[tone]} shadow-soft`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

export default StatCard;