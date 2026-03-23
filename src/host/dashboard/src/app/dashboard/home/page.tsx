'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import CopySecretBox from '@/components/ui/CopySecretBox';
import WelcomeBanner from '@/components/ui/WelcomeBanner';
import ProjectCard from '@/components/ui/projects/ProjectCard';

interface Project {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: string;
  activeVersion?: string;
  configCount?: number;
  envCount?: number;
}

export default function DashboardHomePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProjects = () => {
      const token = localStorage.getItem('corev_token');
      if (!token) {
        return router.push('/login');
      }

      fetch('http://localhost:8080/api/projects', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(async (res) => {
          if (!res.ok) {
            const text = await res.text();
            setError(`Failed to load projects: ${res.status} ${res.statusText} - ${text}`);
            return;
          }
          return res.json();
        })
        .then((data) => {
          if (data) {
            setProjects(data);
          }
        })
        .catch(() => setError('Unable to fetch projects.'))
        .finally(() => setLoading(false));
    };

    if ('requestIdleCallback' in window) {
      requestIdleCallback(fetchProjects);
    } else {
      setTimeout(fetchProjects, 0);
    }
  }, [router]);

  const latestTwo = useMemo(
    () =>
      projects
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 2),
    [projects],
  );

  return (
    <main className="min-h-screen bg-[#f4faff] px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <WelcomeBanner email="abaris@null.net" />
        <CopySecretBox />

        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-[#333]">Recent Projects</h1>
          <Button
            onClick={() => router.push('/dashboard/projects')}
            bgColor="bg-[#AEFFDE]"
            hoverColor="hover:bg-[#92f0c6]"
            height="h-[38px]"
            icon={'/arrow-right.svg'}
          >
            View all
          </Button>
        </div>

        {loading && <p>Loading projects...</p>}
        {error && <p className="text-red-600">{error}</p>}

        {!loading && !error && projects.length === 0 && (
          <p className="text-gray-600">You don’t have any projects yet.</p>
        )}

        <ul className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {latestTwo.map((project) => (
            <ProjectCard key={project._id} {...project} />
          ))}
        </ul>
      </div>
    </main>
  );
}
