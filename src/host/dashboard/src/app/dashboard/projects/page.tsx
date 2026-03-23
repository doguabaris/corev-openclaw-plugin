'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import TextInput from '@/components/ui/TextInput';
import SelectBox from '@/components/ui/SelectBox';
import ProjectCard from '@/components/ui/projects/ProjectCard';
import Modal from '@/components/ui/Modal';

interface Project {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: string;
  activeVersion?: string;
  configCount?: number;
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [modalError, setModalError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const fetchProjects = async () => {
      const token = localStorage.getItem('corev_token');
      if (!token) {
        return router.push('/login');
      }

      try {
        const res = await fetch('http://localhost:8080/api/projects', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          const text = await res.text();
          setError(`Failed to load projects: ${res.status} ${res.statusText} - ${text}`);
          return;
        }

        const data = await res.json();
        setProjects(data);
      } catch {
        setError('Unable to fetch projects.');
      } finally {
        setLoading(false);
      }
    };

    void fetchProjects();
  }, [router]);

  const filteredProjects = useMemo(() => {
    const filtered = projects.filter(
      (p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description?.toLowerCase().includes(search.toLowerCase()),
    );

    return filtered.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sort === 'newest' ? dateB - dateA : dateA - dateB;
    });
  }, [projects, search, sort]);

  return (
    <main className="min-h-screen bg-[#f4faff]">
      <div className="ml-30 mx-auto mt-8">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <h1 className="text-3xl font-bold text-[#333]">All Projects</h1>
          <Button
            onClick={() => setIsModalOpen(true)}
            bgColor="bg-[#AEFFDE]"
            hoverColor="hover:bg-[#92f0c6]"
            height="h-[38px]"
            icon="/add-icon.svg"
          >
            New Project
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="md:col-span-1">
            <TextInput
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              fullWidth={true}
            />
          </div>

          <div className="md:col-span-1 flex md:justify-end">
            <SelectBox
              value={sort}
              onChange={(val) => setSort(val as 'newest' | 'oldest')}
              options={[
                { label: 'Newest', value: 'newest' },
                { label: 'Oldest', value: 'oldest' },
              ]}
              fullWidth={false}
            />
          </div>
        </div>

        {loading && <p>Loading projects...</p>}
        {error && <p className="text-red-600">{error}</p>}

        {!loading && !error && filteredProjects.length === 0 && (
          <p className="text-gray-600">No projects found matching your filters.</p>
        )}

        <ul className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredProjects.map((project) => (
            <ProjectCard key={project._id} {...project} />
          ))}
        </ul>
      </div>
      <Modal
        isOpen={isModalOpen}
        onCloseAction={() => setIsModalOpen(false)}
        title="Create New Project"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setCreating(true);
            setModalError('');
            const token = localStorage.getItem('corev_token');

            try {
              const res = await fetch('http://localhost:8080/api/projects', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ name: newName, description: newDesc }),
              });

              if (!res.ok) {
                const data = await res.json();
                setModalError(data?.error || 'Failed to create project');
                return;
              }

              const { project } = await res.json();
              setProjects((prev) => [project, ...prev]);
              setNewName('');
              setNewDesc('');
              setIsModalOpen(false);
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Unexpected error';
              setModalError(msg);
            } finally {
              setCreating(false);
            }
          }}
          className="space-y-5"
        >
          <TextInput
            id="new-name"
            placeholder="e.g. atlas"
            label="Project Name"
            description="This will define the namespace for your JSON configurations."
            helpText={
              <>
                A short, unique name (e.g. <code className="font-mono">atlas</code>,{' '}
                <code className="font-mono">infra-prod</code>)
              </>
            }
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
          />

          <TextInput
            id="new-desc"
            label="Description"
            placeholder="Optional"
            description="Used to explain the purpose or scope of this project."
            helpText="This will be visible in the project list and version logs."
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />

          {modalError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-300 rounded-md px-3 py-2">
              {modalError}
            </div>
          )}

          <Button
            type="submit"
            height="h-[42px]"
            bgColor="bg-[#AEFFDE]"
            hoverColor="hover:bg-[#92f0c6]"
            className="w-full justify-center"
          >
            {creating ? 'Creating...' : 'Create'}
          </Button>
        </form>
      </Modal>
    </main>
  );
}
