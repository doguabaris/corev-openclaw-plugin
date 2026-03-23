'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Editor, { OnMount } from '@monaco-editor/react';
import type * as monacoEditor from 'monaco-editor';
import Button from '@/components/ui/Button';
import {
  Copy,
  Download,
  RotateCcw,
  Maximize2,
  Scissors,
  Save,
  X,
} from 'lucide-react';

interface Config {
  version: string;
  config: Record<string, unknown>;
  createdAt: string;
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative group">
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={onClick}
        className="h-8 w-8 cursor-pointer grid place-items-center rounded-md bg-[#333333] hover:bg-[#3a3a3a] text-white border border-[#4a4a4a] shadow-sm"
      >
        {children}
      </button>
      <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-2 py-1 text-xs text-white/90 bg-[#00b894] z-50 opacity-0 group-hover:opacity-100 transition-opacity">
        {label}
      </span>
    </div>
  );
}

export default function ConfigDetailPage() {
  const params = useParams() as { slug: string; version: string };
  const { slug, version } = params;
  const searchParams = useSearchParams();
  const env = searchParams?.get('env') ?? 'production';
  const router = useRouter();

  const [config, setConfig] = useState<Config | null>(null);
  const [jsonText, setJsonText] = useState<string>('{}');
  const [parsedJson, setParsedJson] = useState<Record<string, unknown> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [info, setInfo] = useState('');
  const [saving, setSaving] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const editorRef = useRef<monacoEditor.editor.IStandaloneCodeEditor | null>(
    null,
  );
  const fsRef = useRef<HTMLDivElement | null>(null);

  const isValid = parsedJson !== null && jsonError === '';

  useEffect(() => {
    async function fetchConfig(): Promise<void> {
      const token = localStorage.getItem('corev_token');
      if (!token) {
        setLoading(false);
        setApiError('Not authenticated');
        return;
      }

      setLoading(true);
      setApiError('');
      setInfo('');

      try {
        const res = await fetch(
          `http://localhost:8080/api/configs/${slug}/${version}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'x-corev-env': env,
            },
          },
        );

        if (!res.ok) {
          const text = await res.text();
          setApiError(
            `Failed to fetch config: ${res.status} ${res.statusText} - ${text}`,
          );
          return;
        }

        const data = (await res.json()) as Config;
        setConfig(data);
        const pretty = JSON.stringify(data.config ?? {}, null, 2);
        setJsonText(pretty);
        setParsedJson(data.config ?? {});
        setJsonError('');
      } catch {
        setApiError('Failed to load config.');
      } finally {
        setLoading(false);
      }
    }

    void fetchConfig();
  }, [slug, version, env]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && isFullscreen) {
        void exitFullscreen();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFullscreen]);

  useEffect(() => {
    const onFsChange = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);
      editorRef.current?.layout();
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    if (!isFullscreen) {
      return;
    }
    const el = fsRef.current;
    if (el && el.requestFullscreen && !document.fullscreenElement) {
      void el.requestFullscreen();
    }
  }, [isFullscreen]);

  const enterFullscreen = (): void => {
    setIsFullscreen(true);
  };

  const exitFullscreen = async (): Promise<void> => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (e) {
      console.error('exitFullscreen failed', e);
    } finally {
      setIsFullscreen(false);
    }
  };

  const handleBeforeMount = useCallback((monaco: typeof monacoEditor) => {
    monaco.editor.defineTheme('corevDark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'number', foreground: 'F78C6C' },
        { token: 'string', foreground: 'C3E88D' },
        { token: 'keyword', foreground: 'C792EA', fontStyle: 'bold' },
        { token: 'delimiter', foreground: 'D4D4D4' },
        { token: 'property', foreground: '82AAFF' },
      ],
      colors: {
        'editor.background': '#333333',
        'editor.foreground': '#e6e6e6',
        'editorLineNumber.foreground': '#8a8a8a',
        'editorLineNumber.activeForeground': '#d0d0d0',
        'editorCursor.foreground': '#A6E3A1',
        'editor.selectionBackground': '#4a4a4a',
        'editor.inactiveSelectionBackground': '#3f3f3f',
        'editorIndentGuide.activeBackground': '#555555',
        'editorIndentGuide.background': '#444444',
        'editorBracketMatch.border': '#6b6b6b',
        'editorWidget.background': '#2f2f2f',
        'editorSuggestWidget.background': '#2f2f2f',
        'editorSuggestWidget.selectedBackground': '#3a3a3a',
      },
    });

    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: true,
      enableSchemaRequest: false,
      schemas: [],
    });
  }, []);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    setTimeout(() => {
      editor.getAction('editor.action.formatDocument')?.run();
    }, 0);

    if (monaco?.KeyMod && monaco?.KeyCode) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        void handleSave();
      });
      editor.addCommand(monaco.KeyCode.F11, () => enterFullscreen());
    }
  };

  const handleEditorChange = (value?: string) => {
    const text = value ?? '';
    setJsonText(text);
    try {
      const parsed = JSON.parse(text);
      setParsedJson(parsed);
      setJsonError('');
    } catch {
      setParsedJson(null);
      setJsonError('Invalid JSON');
    }
  };

  const handleFormat = () => {
    try {
      const obj = JSON.parse(jsonText);
      const pretty = JSON.stringify(obj, null, 2);
      setJsonText(pretty);
      setParsedJson(obj);
      setJsonError('');
      setInfo('Formatted');
      setTimeout(() => setInfo(''), 1200);
    } catch {
      setJsonError('Invalid JSON. Cannot format.');
    }
  };

  const handleRevert = () => {
    if (!config) {
      return;
    }
    const pretty = JSON.stringify(config.config ?? {}, null, 2);
    setJsonText(pretty);
    setParsedJson(config.config ?? {});
    setJsonError('');
    setInfo('Reverted to last fetched');
    setTimeout(() => setInfo(''), 1200);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonText);
      setInfo('Copied');
      setTimeout(() => setInfo(''), 1200);
    } catch {
      setApiError('Copy failed');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([jsonText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}@${version}.${env}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = useCallback(async (): Promise<void> => {
    const token = localStorage.getItem('corev_token');
    if (!token) {
      setApiError('Not authenticated');
      return;
    }
    if (!isValid || !parsedJson) {
      setJsonError('Fix JSON before saving');
      return;
    }

    setSaving(true);
    setApiError('');
    setInfo('');

    try {
      const res = await fetch(
        `http://localhost:8080/api/configs/${slug}/${version}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'x-corev-env': env,
          },
          body: JSON.stringify({ config: parsedJson }),
        },
      );

      if (!res.ok) {
        const text = await res.text();
        setApiError(`Update failed: ${res.status} ${res.statusText} - ${text}`);
        return;
      }

      setConfig((prev) => (prev ? { ...prev, config: parsedJson } : prev));
      setInfo('Saved');
      setTimeout(() => setInfo(''), 1200);
    } catch {
      setApiError('Update failed. Check connection or JSON.');
    } finally {
      setSaving(false);
    }
  }, [slug, version, env, isValid, parsedJson]);

  const handleDelete = async (): Promise<void> => {
    const confirmed = confirm(
      `Delete version ${version}\n from project "${slug}"?`,
    );
    if (!confirmed) {
      return;
    }

    const token = localStorage.getItem('corev_token');
    if (!token) {
      setApiError('Not authenticated');
      return;
    }

    try {
      const res = await fetch(
        `http://localhost:8080/api/configs/${slug}/${version}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            'x-corev-env': env,
          },
        },
      );

      if (!res.ok) {
        const text = await res.text();
        setApiError(`Delete failed: ${res.status} ${res.statusText} - ${text}`);
        return;
      }

      alert('Config deleted.');
      router.push(`/dashboard/projects/${slug}?env=${env}`);
    } catch {
      setApiError('Failed to delete config.');
    }
  };

  const stats = useMemo(() => {
    const lines = jsonText.split('\n').length;
    const chars = jsonText.length;
    return { lines, chars };
  }, [jsonText]);

  const EditorPanel = (
    <div className="rounded-xl shadow overflow-hidden border-2 border-[#333333]">
      <div className="flex items-center justify-between bg-[#333333] text-[#e6fff5] px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-md/5 opacity-90">
            {slug}@{version}.{env}.json
          </span>
        </div>
        <div className="flex items-center gap-2">
          <IconButton label="Format" onClick={handleFormat}>
            <Scissors size={16} />
          </IconButton>
          <IconButton label="Copy" onClick={handleCopy}>
            <Copy size={16} />
          </IconButton>
          <IconButton label="Download" onClick={handleDownload}>
            <Download size={16} />
          </IconButton>
          <IconButton label="Revert" onClick={handleRevert}>
            <RotateCcw size={16} />
          </IconButton>
          <IconButton label="Fullscreen" onClick={enterFullscreen}>
            <Maximize2 size={16} />
          </IconButton>
        </div>
      </div>

      <div className="border-t border-[#333333]">
        <Editor
          height="540px"
          defaultLanguage="json"
          theme="corevDark"
          value={jsonText}
          beforeMount={handleBeforeMount}
          onMount={handleMount}
          onChange={handleEditorChange}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineHeight: 22,
            roundedSelection: true,
            formatOnPaste: true,
            formatOnType: true,
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
          }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#2d2d2d] text-[#cfd9d5]">
        <div className="text-xs">
          {isValid ? (
            <span className="text-emerald-300">Valid JSON</span>
          ) : (
            <span className="text-rose-300">Invalid JSON</span>
          )}
          <span className="mx-2">•</span>
          <span>{stats.lines} lines</span>
          <span className="mx-2">•</span>
          <span>{stats.chars} chars</span>
        </div>
        <Button
          onClick={handleSave}
          height="h-[36px]"
          bgColor={isValid ? 'bg-[#AEFFDE]' : 'bg-[#d7e7de]'}
          hoverColor={isValid ? 'hover:bg-[#92f0c6]' : ''}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="ml-30 mx-auto mt-8 space-y-6">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <h1 className="text-2xl font-bold">
          Project: <span className="text-[#00b894]">{slug}</span>
        </h1>
        <div className="flex items-center gap-2 h-[36px]">
          <span className="h-[36px] text-lg font-semibold px-3 flex items-center text-[#006b5f] bg-[#eafff6] rounded">
            Version: <span className="ml-1 text-[#00b894]">{version}</span>
          </span>
          <span className="h-[36px] text-lg font-semibold px-3 flex items-center text-[#5b2c00] bg-[#fff4e6] rounded">
            Env: <span className="ml-1 text-[#e17055]">{env}</span>
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => router.back()}
            height="h-[36px]"
            bgColor="bg-[#eeeeee]"
            hoverColor="hover:bg-[#dddddd]"
          >
            ← Back
          </Button>
          <Button
            onClick={handleDelete}
            height="h-[36px]"
            bgColor="bg-[#ffe3e3]"
            hoverColor="hover:bg-[#ffcccc]"
          >
            Delete
          </Button>
        </div>
      </div>

      {loading && <p>Loading...</p>}
      {!loading && apiError && (
        <div className="rounded border border-red-300 bg-red-50 text-red-700 px-3 py-2 text-sm">
          {apiError}
        </div>
      )}
      {!loading && info && (
        <div className="rounded border border-emerald-300 bg-emerald-50 text-emerald-700 px-3 py-2 text-sm">
          {info}
        </div>
      )}

      {!loading && config && EditorPanel}
      {!loading && !apiError && !config && <p>No config found.</p>}

      {isFullscreen && (
        <div
          ref={fsRef}
          className="fixed inset-0 z-[1000] bg-[#333333] text-white"
        >
          <div className="absolute top-3 left-4 flex items-center gap-2">
            <span className="font-semibold">{slug}</span>
            <span className="px-2 py-0.5 text-xs rounded bg-emerald-400/90 text-emerald-950">
              v{version}
            </span>
            <span className="px-2 py-0.5 text-xs rounded bg-amber-300/90 text-amber-950">
              {env}
            </span>
          </div>
          <div className="absolute top-3 right-4 flex items-center gap-2">
            <IconButton label="Format" onClick={handleFormat}>
              <Scissors size={16} />
            </IconButton>
            <IconButton label="Save" onClick={handleSave}>
              <Save size={16} />
            </IconButton>
            <IconButton label="Exit" onClick={exitFullscreen}>
              <X size={16} />
            </IconButton>
          </div>

          <Editor
            height="100vh"
            width="100vw"
            defaultLanguage="json"
            theme="corevDark"
            value={jsonText}
            beforeMount={handleBeforeMount}
            onMount={handleMount}
            onChange={handleEditorChange}
            options={{
              minimap: { enabled: false },
              fontSize: 16,
              lineHeight: 22,
              roundedSelection: true,
              formatOnPaste: true,
              formatOnType: true,
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </div>
      )}
    </div>
  );
}
