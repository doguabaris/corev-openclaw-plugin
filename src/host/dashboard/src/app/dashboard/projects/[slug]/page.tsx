'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import TimelineWithBranches from '@/components/ui/projects/TimelineWithBranches';
import SelectBox from '@/components/ui/SelectBox';
import ProjectHeatmap from '@/components/ui/projects/ProjectHeatmap';

interface Config {
  _id: string;
  version: string;
  config: Record<string, unknown>;
  createdAt: string;
}

interface ProjectMeta {
  _id: string;
  activeVersions?: Record<string, string>;
}

export default function ProjectDetailPage() {
  const paramObj = useParams<{ slug: string }>() ?? { slug: '' };
  const { slug } = paramObj;
  const router = useRouter();
  const [env, setEnv] = useState('production');
  const [projectMeta, setProjectMeta] = useState<ProjectMeta>({
    _id: '',
    activeVersions: { production: '' },
  });
  const availableEnvs = Object.keys(projectMeta.activeVersions || {});
  const [configs, setConfigs] = useState<Config[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [newVersion, setNewVersion] = useState('');
  const [newConfig, setNewConfig] = useState('{}');
  const [viewMode, setViewMode] = useState<'timeline' | 'table'>('timeline');
  const [showRevertForm, setShowRevertForm] = useState(false);
  const [selectedRevertVersion, setSelectedRevertVersion] = useState('');
  const projectStart = configs[configs.length - 1]?.createdAt;

  const activeVersion = projectMeta.activeVersions?.[env];
  const activeConfig = configs.find((c) => c.version === activeVersion) ?? configs[0];

  const fetchAll = useCallback(async () => {
    const token = localStorage.getItem('corev_token');
    if (!token) {
      return;
    }

    setLoading(true);
    try {
      const [pmRes, cfgRes] = await Promise.all([
        fetch(`http://localhost:8080/api/projects/${slug}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`http://localhost:8080/api/configs/${slug}/all`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'x-corev-env': env,
          },
        }),
      ]);

      if (pmRes.ok) {
        const pmData: ProjectMeta = await pmRes.json();
        setProjectMeta(pmData);
      }

      if (!cfgRes.ok) {
        setError(`Failed to fetch configs: ${cfgRes.statusText}`);
        return;
      }

      const data: Config[] = await cfgRes.json();
      setConfigs(data);
      setError('');
    } catch (err) {
      console.error('[fetchAll error]', err);
      setError((err as Error).message || 'Failed to load project or configs.');
    } finally {
      setLoading(false);
    }
  }, [env, slug]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll, env]);

  const handleAddConfig = async () => {
    const token = localStorage.getItem('corev_token');
    if (!token) {
      return;
    }

    try {
      const payload = {
        name: slug,
        version: newVersion,
        config: JSON.parse(newConfig),
      };

      const res = await fetch(`http://localhost:8080/api/configs/${slug}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-corev-env': env,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        setError(`Failed to upload config: ${res.status} ${res.statusText} - ${text}`);
        return;
      }

      await fetchAll();
      setNewVersion('');
      setNewConfig('{}');
      setShowForm(false);
      setError('');
    } catch (e) {
      console.error('[handleAddConfig]', e);
      setError((e as Error).message || 'Invalid JSON or request failed');
    }
  };

  const handleRevert = async (version: string) => {
    if (!version) {
      return;
    }
    if (!confirm(`Revert project to version ${version}?`)) {
      return;
    }

    const token = localStorage.getItem('corev_token');
    if (!token) {
      return;
    }

    try {
      const getRes = await fetch(`http://localhost:8080/api/configs/${slug}/${version}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-corev-env': env,
        },
      });

      if (!getRes.ok) {
        const text = await getRes.text();
        alert(
          `Failed to fetch version ${version}:\n${getRes.status} ${getRes.statusText}\n${text}`,
        );
        return;
      }

      const cfg: Config = await getRes.json();

      const postRes = await fetch(`http://localhost:8080/api/configs/${slug}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-corev-env': env,
        },
        body: JSON.stringify({
          name: slug,
          version: cfg.version,
          config: cfg.config,
        }),
      });

      if (!postRes.ok) {
        const text = await postRes.text();
        alert(`Failed to revert to ${version}:\n${postRes.status} ${postRes.statusText}\n${text}`);
        return;
      }

      await fetchAll();
      alert(`Successfully reverted to version ${version}`);
      setShowRevertForm(false);
      setSelectedRevertVersion('');
    } catch (e) {
      console.error('[handleRevert]', e);
      alert('Unexpected error while reverting: ' + ((e as Error).message || 'Unknown error'));
    }
  };

  const activeBg = 'bg-[#e4f1ff]';
  const activeHover = 'hover:bg-[#92f0c6]';
  const inactiveBg = 'bg-transparent';
  const inactiveHover = 'hover:bg-transparent';

  return (
    <div className="ml-30 mx-auto mt-8 space-y-8">
      <div className="flex justify-between items-center mb-16">
        <h1 className="text-2xl font-bold">
          Project: <span className="text-[#00b894]">{slug}</span>
        </h1>

        <div className="flex space-x-2  h-[48px] rounded-full p-1 bg-[#e4f1ff]">
          {availableEnvs.map((e) => (
            <button
              key={e}
              onClick={() => setEnv(e)}
              className={`px-4 py-1 rounded-full text-sm cursor-pointer font-extrabold transition-all duration-200 ${
                env === e
                  ? 'bg-[#333333] text-white'
                  : 'bg-transparent text-[#333333] hover:bg-[#ffff]'
              }`}
            >
              {e}
            </button>
          ))}
        </div>

        <div className="flex justify-end space-x-2">
          <Button
            height={'h-[48px]'}
            onClick={() => setViewMode('timeline')}
            bgColor={viewMode === 'timeline' ? activeBg : inactiveBg}
            hoverColor={viewMode === 'timeline' ? activeHover : inactiveHover}
            icon="/timeline-icon.svg"
            hideBorder={true}
          >
            Timeline{' '}
          </Button>
          <Button
            height={'h-[48px]'}
            onClick={() => setViewMode('table')}
            bgColor={viewMode === 'table' ? activeBg : inactiveBg}
            hoverColor={viewMode === 'table' ? activeHover : inactiveHover}
            icon="/table-icon.svg"
            hideBorder={true}
          >
            Table{' '}
          </Button>
        </div>

        <Button
          onClick={() => setShowForm(!showForm)}
          bgColor="bg-[#AEFFDE]"
          height={'h-[48px]'}
          icon={'/add-icon.svg'}
          hoverColor="hover:bg-[#92f0c6]"
        >
          {showForm ? 'Cancel' : 'Add Config'}
        </Button>
      </div>

      {showForm && (
        <div className="space-y-4 border border-[#ccc] rounded-lg p-4 bg-white">
          <input
            type="text"
            placeholder="Version (e.g. 1.0.1)"
            className="w-full border px-4 py-2 rounded"
            value={newVersion}
            onChange={(e) => setNewVersion(e.target.value)}
          />
          <textarea
            rows={6}
            placeholder='Config JSON (e.g. {"env": "prod"})'
            className="w-full border px-4 py-2 rounded font-mono"
            value={newConfig}
            onChange={(e) => setNewConfig(e.target.value)}
          />
          <Button
            onClick={handleAddConfig}
            bgColor="bg-[#AEFFDE]"
            hoverColor="hover:bg-[#92f0c6]"
            height="h-[38px]"
          >
            Save Config
          </Button>
        </div>
      )}

      <div className={'flex justify-between'}>
        {!loading && !error && configs.length > 0 && activeConfig && (
          <div className="grid w-3/5">
            <div className="border-2 border-[#333333] h-fit rounded-xl bg-[#fff] p-4 mb-10 mr-10">
              <h2 className="text-lg font-semibold">Active Configuration</h2>
              <div className={'flex justify-between'}>
                <div>
                  <div>
                    <span className="font-semibold">Created At:</span>{' '}
                    {new Date(activeConfig.createdAt).toLocaleString()}
                  </div>
                  <div className="w-96 mt-3 text-sm text-gray-600">
                    {env === 'production' ? (
                      <>
                        This version is currently active and serves as the latest configuration
                        deployed for this project.
                      </>
                    ) : (
                      <>
                        You are currently viewing the <strong>{env}</strong> environment.
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <span className={'font-extrabold text-xl text-gray-400'}>v:</span>
                  <span className={'font-extrabold text-6xl'}>{activeConfig.version}</span>
                </div>
              </div>
              <div className="flex space-x-2 mt-5 justify-between">
                <Button
                  onClick={() =>
                    router.push(`/dashboard/projects/${slug}/${activeConfig.version}?env=${env}`)
                  }
                  bgColor="bg-white"
                  hoverColor="hover:bg-[#B6F4C7]"
                  height="h-[38px]"
                  icon="/arrow-right.svg"
                  iconPosition="right"
                >
                  See the configuration
                </Button>
                <Button
                  onClick={() => setShowRevertForm((f) => !f)}
                  bgColor="bg-[#ffcccc]"
                  hoverColor="hover:bg-[#ffaaaa]"
                  height="h-[38px]"
                  icon="/revert-icon.svg"
                >
                  Revert
                </Button>
              </div>

              {showRevertForm && (
                <div className="space-y-2 mt-10 bg-white p-6 border-2 border-[#333333] rounded-xl">
                  <SelectBox
                    textColor="text-[#1e1e1e]"
                    placeholderColor="text-[#333333]"
                    borderColor="#333333"
                    value={selectedRevertVersion}
                    onChange={setSelectedRevertVersion}
                    options={[
                      { label: '-- select version --', value: '' },
                      ...configs
                        .filter((cfg) => cfg.version !== projectMeta.activeVersions?.production)
                        .map((cfg) => ({ label: cfg.version, value: cfg.version })),
                    ]}
                  />
                  <div className="flex space-x-2 mt-6 justify-between">
                    <Button
                      onClick={() => handleRevert(selectedRevertVersion)}
                      disabled={!selectedRevertVersion}
                      bgColor="bg-[#ffcccc]"
                      hoverColor="hover:bg-[#ffaaaa]"
                      height="h-[38px]"
                    >
                      Confirm Revert
                    </Button>
                    <Button
                      onClick={() => {
                        setShowRevertForm(false);
                        setSelectedRevertVersion('');
                      }}
                      hideBorder={true}
                      hoverColor="hover:bg-[#dddddd]"
                      height="h-[38px]"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <div className={'mr-10'}>
              <ProjectHeatmap projectId={projectMeta._id} />
            </div>
          </div>
        )}
        {loading ? (
          <p>Loading...</p>
        ) : error ? (
          <p className="text-red-600">{error}</p>
        ) : configs.length === 0 ? (
          <p>No configs found for this project.</p>
        ) : viewMode === 'timeline' ? (
          <TimelineWithBranches
            configs={configs}
            projectStart={projectStart}
            activeVersion={projectMeta.activeVersions?.[env]}
          />
        ) : (
          <table className="w-4/7 text-sm border-2 border-[#333333] h-fit rounded-xl bg-[#333333] overflow-hidden">
            <thead className="bg-[#e4f1ff] border-b h-[60px]">
              <tr>
                <th className="text-left px-4 py-3 font-extrabold">Version</th>
                <th className="text-left px-4 py-3 font-extrabold">Created At</th>
                <th className="text-right px-4 py-3 font-extrabold">Action</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((cfg) => (
                <tr key={cfg._id} className="border-b bg-[#fff] h-[60px] hover:bg-[#f9f9f9]">
                  <td className="px-4 py-3 font-extrabold">{cfg.version}</td>
                  <td className="px-4 py-3 font-extrabold text-gray-500">
                    {new Date(cfg.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      bgColor="bg-[#f0f0f0]"
                      hoverColor="hover:bg-[#e0e0e0]"
                      onClick={() => router.push(`/dashboard/projects/${slug}/${cfg.version}`)}
                      height="h-[38px]"
                      icon="/arrow-right.svg"
                    >
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
