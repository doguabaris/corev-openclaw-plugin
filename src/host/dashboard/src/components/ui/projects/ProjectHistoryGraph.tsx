'use client';

import { useEffect, useState } from 'react';
import { ResponsiveBump } from '@nivo/bump';

interface ConfigLog {
  version: string;
  timestamp: string;
  action: 'push' | 'revert' | 'pull' | 'checkout';
  env: string;
}

export default function ProjectHistoryGraph({ projectId }: { projectId: string }) {
  const [logs, setLogs] = useState<ConfigLog[]>([]);
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
      .then((data) => {
        setLogs(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch logs:', err);
        setLoading(false);
      });
  }, [projectId]);

  const logsToBumpData = (logs: ConfigLog[]) => {
    // Group by env@version
    const grouped: Record<string, ConfigLog[]> = {};
    logs.forEach((log) => {
      const key = `${log.env}@${log.version}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(log);
    });

    return Object.entries(grouped).map(([key, entries]) => ({
      id: key,
      data: entries
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .map((entry, index) => ({
          x: new Date(entry.timestamp).toLocaleDateString('en-CA', {
            year: 'numeric',
            month: '2-digit',
          }),
          y: index + 1,
        })),
    }));
  };

  const bumpData = logsToBumpData(logs);

  const envColorMap: Record<string, string> = {
    production: '#00b894',
    staging: '#0984e3',
    dev: '#fdcb6e',
  };

  const getColor = (serieId: string) => {
    const [env] = serieId.split('@');
    return envColorMap[env] || '#ffff';
  };

  if (loading) {
    return <p>Loading graph...</p>;
  }
  if (!bumpData.length) {
    return <p>No log data available for this project.</p>;
  }

  return (
    <div className="h-[400px]">
      <ResponsiveBump
        data={bumpData}
        colors={({ id }) => getColor(String(id))}
        lineWidth={3}
        activeLineWidth={5}
        inactiveLineWidth={2}
        inactiveOpacity={0.3}
        pointSize={10}
        activePointSize={14}
        inactivePointSize={6}
        pointColor="#ffffff"
        pointBorderWidth={3}
        activePointBorderWidth={3}
        pointBorderColor="#333"
        axisLeft={{ legend: 'change count', legendOffset: -40 }}
        axisBottom={{ legend: 'time (YYYY-MM)', legendOffset: 36 }}
        margin={{ top: 40, right: 100, bottom: 50, left: 60 }}
      />
    </div>
  );
}
