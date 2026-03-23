import { useEffect, useState } from 'react';
import { eachDayOfInterval, format, isSameDay, parseISO, subDays } from 'date-fns';

interface ConfigLog {
  version: string;
  timestamp: string;
  action: 'push' | 'revert' | 'pull' | 'checkout';
  env: string;
}

interface EnvHeatCell {
  date: string;
  count: number;
  logs: ConfigLog[];
}

export default function ProjectHeatmap({ projectId }: { projectId: string }) {
  const [envLogs, setEnvLogs] = useState<Record<string, EnvHeatCell[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('corev_token');
    if (!token) {
      return;
    }

    fetch(`http://localhost:8080/api/logs/${projectId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data: ConfigLog[]) => {
        setLoading(false);
        generateEnvHeatmap(data);
      })
      .catch((err) => {
        console.error('Failed to fetch logs:', err);
        setLoading(false);
      });
  }, [projectId]);

  const generateEnvHeatmap = (logs: ConfigLog[]) => {
    const today = new Date();
    const start = subDays(today, 6);
    const days = eachDayOfInterval({ start, end: today });
    const grouped: Record<string, EnvHeatCell[]> = {};
    const envs = Array.from(new Set(logs.map((l) => l.env)));

    for (const env of envs) {
      grouped[env] = days.map((day) => {
        const logsForDay = logs.filter(
          (log) => log.env === env && isSameDay(parseISO(log.timestamp), day),
        );
        return {
          date: format(day, 'yyyy-MM-dd'),
          count: logsForDay.length,
          logs: logsForDay,
        };
      });
    }
    setEnvLogs(grouped);
  };

  const getColor = (count: number): string => {
    if (count === 0) {
      return '#e4f1ff';
    }
    if (count <= 2) {
      return '#d1fae5';
    }
    if (count <= 5) {
      return '#6ee7b7';
    }
    return '#00b894';
  };

  if (loading) {
    return <p>Loading heatmap...</p>;
  }

  const dayLabels = Object.values(envLogs)[0]?.map((cell) => format(parseISO(cell.date), 'EEE'));

  return (
    <div className="w-full max-w-[720px] mx-auto">
      <div className="text-2xl font-bold mb-4">Environment Activity (Last 7 Days)</div>

      {dayLabels && (
        <div className="flex gap-[6px] ml-32 mb-2">
          {dayLabels.map((label, idx) => (
            <span key={idx} className="h-8 flex-1 text-sm text-gray-400 text-center font-extrabold">
              {label}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {Object.entries(envLogs).map(([env, cells]) => (
          <div key={env} className="flex items-center gap-4">
            <span className="w-32 text-sm font-extrabold">{env}</span>
            <div className="flex gap-[6px] flex-1">
              {cells.map((cell, idx) => (
                <div
                  key={idx}
                  className={`relative group h-12 flex-1 rounded-lg ${
                    cell.count === 0 ? 'bg-stripes border-2 border-[#e4f1ff]' : ''
                  }`}
                  style={{ backgroundColor: getColor(cell.count) }}
                >
                  {cell.count > 0 && (
                    <div className="absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white border border-gray-200 shadow-lg rounded-md px-4 py-3 text-xs text-gray-800 w-max min-w-[200px] whitespace-nowrap hidden group-hover:block">
                      <div className="text-[11px] font-semibold text-gray-500 mb-1">
                        {cell.date}
                      </div>
                      <div className="mb-1">
                        <span className="font-medium">Total:</span> {cell.count}
                      </div>
                      {Object.entries(
                        cell.logs.reduce<Record<string, number>>((acc, log) => {
                          acc[log.action] = (acc[log.action] || 0) + 1;
                          return acc;
                        }, {}),
                      ).map(([action, count]) => (
                        <div key={action} className="flex justify-between gap-4">
                          <span>{action}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}

                      {[...new Set(cell.logs.map((log) => log.version))].length > 0 && (
                        <div className="mt-2 text-[11px] text-gray-500 italic">
                          {cell.logs.map((log, i) => (
                            <div key={i} className="truncate">
                              → v{log.version}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 text-sm text-gray-400 font-extrabold flex items-center gap-4">
        <span className="inline-block w-6 h-6 bg-[#e4f1ff] rounded" /> 0
        <span className="inline-block w-6 h-6 bg-[#d1fae5] rounded" /> 1–2
        <span className="inline-block w-6 h-6 bg-[#6ee7b7] rounded" /> 3–5
        <span className="inline-block w-6 h-6 bg-[#00b894] rounded" /> 6+
      </div>
    </div>
  );
}
