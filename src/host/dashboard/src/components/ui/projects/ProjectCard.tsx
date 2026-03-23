'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface ProjectCardProps {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: string;
  activeVersion?: string;
  configCount?: number;
  envCount?: number;
}

export default function ProjectCard(project: ProjectCardProps) {
  const router = useRouter();

  return (
    <li className="bg-white hover:bg-[#e4f1ff] border-2 border-[#333333] rounded-[30px] p-6 flex flex-col justify-between h-[260px] transition-all duration-200 hover:-translate-y-[10px]">
      <div>
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-4xl font-semibold text-[#333]">{project.name.toLowerCase()}</h2>
          {project.activeVersion && (
            <span className="text-4xl text-gray-500 font-semibold">v{project.activeVersion}</span>
          )}
        </div>
        <p className="text-lg text-gray-600">{project.description || 'No description'}</p>
        <p className="text-2xl text-gray-400 mt-2">
          Created{' '}
          {new Date(project.createdAt).toLocaleString(undefined, {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={() => router.push(`/dashboard/projects/${project.slug}`)}
          className="inline-flex items-center justify-center gap-2 rounded-full text-sm font-bold text-[#333333] transition-colors cursor-pointer px-5 py-2 border-2 border-[#333333] bg-[#AEFFDE] hover:bg-[#B6F4C7]"
        >
          <Image src="/source-icon.svg" alt="Icon" width={24} height={24} />
          See project
        </button>
        <div className="ml-auto flex items-center gap-4 text-[#333] font-medium text-xl">
          <div className="flex items-center gap-1">
            <Image src="/config-icon.svg" alt="Configs" width={20} height={20} />
            <span>{project.configCount ?? 0}</span>
          </div>
          <div className="flex items-center gap-1">
            <Image src="/environment.icon.svg" alt="Envs" width={20} height={20} />
            <span>{project.envCount ?? 1}</span>
          </div>
        </div>
      </div>
    </li>
  );
}
