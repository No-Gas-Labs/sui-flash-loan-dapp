import { TrendingUp, Activity, DollarSign, Clock } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';

interface StatsOverviewProps {
  data: any;
  loading: boolean;
}

export function StatsOverview({ data, loading }: StatsOverviewProps) {
  const formatSUI = (mist: number) => {
    return (mist / 1e9).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card">
            <div className="card-body flex items-center justify-center py-8">
              <LoadingSpinner size="small" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const stats = [
    {
      label: 'Total Volume',
      value: `${formatSUI(data.totalVolume)} SUI`,
      icon: TrendingUp,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20',
    },
    {
      label: 'Total Loans',
      value: data.totalLoans.toLocaleString(),
      icon: Activity,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20',
    },
    {
      label: 'Fees Collected',
      value: `${formatSUI(data.totalFees)} SUI`,
      icon: DollarSign,
      color: 'text-success-400',
      bgColor: 'bg-success-500/20',
    },
    {
      label: 'Last 24h',
      value: `${data.loansLast24h} loans`,
      icon: Clock,
      color: 'text-warning-400',
      bgColor: 'bg-warning-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div key={index} className="card hover:border-slate-600 transition-colors">
            <div className="card-body">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
              <p className="text-sm text-gray-400 mb-1">{stat.label}</p>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}