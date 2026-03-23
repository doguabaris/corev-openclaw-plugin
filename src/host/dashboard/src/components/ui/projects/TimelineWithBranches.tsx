'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';
import Image from 'next/image';

interface Config {
  _id: string;
  version: string;
  createdAt: string;
}

interface TimelineProps {
  configs: Config[];
  projectStart: string;
  activeVersion?: string;
}

export default function TimelineWithBranches({
  configs,
  projectStart,
  activeVersion,
}: TimelineProps) {
  const router = useRouter();

  const paramObj = useParams<{ slug: string }>() ?? { slug: '' };
  const { slug } = paramObj;

  const monthColors = [
    '#e74c3c',
    '#e67e22',
    '#f1c40f',
    '#2ecc71',
    '#1abc9c',
    '#3498db',
    '#9b59b6',
    '#8e44ad',
    '#34495e',
    '#16a085',
    '#27ae60',
    '#2c3e50',
  ];

  const sortedConfigs = [...configs].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const groupedByYear = sortedConfigs.reduce<Record<number, Config[]>>((acc, cfg) => {
    const year = new Date(cfg.createdAt).getFullYear();
    if (!acc[year]) {
      acc[year] = [];
    }
    acc[year].push(cfg);
    return acc;
  }, {});
  configs.find((c) => c.version === activeVersion);
  const activeIndex = sortedConfigs.findIndex((c) => c.version === activeVersion);
  const rowHeight = 100;

  const renderYearWithBranch = (year: number) => (
    <div className="relative pr-2 font-bold text-gray-400 -mt-1">
      <div className="">{year}</div>
    </div>
  );

  return (
    <div className="grid grid-cols-[60px_105px_1fr] h-fit">
      {Object.entries(groupedByYear)
        .sort(([a], [b]) => parseInt(b) - parseInt(a))
        .map(([yearStr, yearConfigsRaw]) => {
          const year = parseInt(yearStr);
          const yearConfigs = yearConfigsRaw.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
          return yearConfigs.map((cfg, indexInYear) => {
            const date = new Date(cfg.createdAt);
            const month = format(date, 'LLL', { locale: enUS });
            const monthColor = monthColors[date.getMonth()];
            const visualIndex = sortedConfigs.findIndex((c) => c._id === cfg._id);

            const latestConfig = sortedConfigs[sortedConfigs.length - 1];
            const isReverted =
              cfg.version === latestConfig.version && activeVersion !== latestConfig.version;

            return (
              <React.Fragment key={cfg._id}>
                {indexInYear === 0 ? renderYearWithBranch(year) : <div />}

                <div
                  className="relative text-right pl-2 w-[50px] flex items-center h-auto"
                  style={{
                    borderLeft: `4px solid ${monthColor}`,
                    color: monthColor,
                  }}
                >
                  <span className="absolute right-12 top-0 w-4 h-4 bg-white rounded-full border-2 border-[#e4f1ff] transform translate-x-1/2" />
                  <div className="pl-1 font-extrabold">{month}</div>
                </div>

                <div className="relative pl-6 border-l-4 border-[#e4f1ff] pb-8 h-fit">
                  {isReverted &&
                    activeIndex !== -1 &&
                    (() => {
                      const topOffset = 10;
                      const bottomOffset = 10;
                      const revertHeight = (visualIndex - activeIndex) * rowHeight - bottomOffset;

                      return (
                        <>
                          <div
                            className="absolute"
                            style={{
                              left: '-55px',
                              top: `${topOffset}px`,
                              transform: 'rotate(360deg) scaleX(-1)',
                              transformOrigin: 'center',
                              zIndex: 1,
                            }}
                          >
                            <Image
                              src="/curved-connector.svg"
                              alt="connector"
                              width={60}
                              height={20}
                            />
                          </div>

                          <div
                            className="absolute"
                            style={{
                              left: '-55px',
                              top: `${topOffset + revertHeight}px`,
                              transform: 'rotate(180deg)',
                              transformOrigin: 'center',
                              zIndex: 1,
                            }}
                          >
                            <Image
                              src="/curved-connector.svg"
                              alt="connector"
                              width={60}
                              height={20}
                            />
                          </div>

                          <div
                            className="absolute -left-[50px] z-0"
                            style={{
                              top: `${topOffset + 38}px`,
                              height: `${revertHeight - 30}px`,
                              borderLeft: '2px dashed #e17055',
                            }}
                          />
                        </>
                      );
                    })()}

                  <div className="absolute -left-3.5 top-0 w-6 h-6 z-20">
                    {cfg.version === activeVersion && (
                      <div className="absolute inset-0 rounded-full bg-[#00b894] opacity-30 animate-ping z-[-1]" />
                    )}
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[0.75rem] font-bold
      ${
              isReverted
                ? 'bg-[#ffe5e5] border-2 border-[#e17055] text-[#e17055]'
                : cfg.version === activeVersion
                  ? 'bg-[#AEFFDE] border-2 border-[#00b894] text-[#333]'
                  : 'bg-[#f0f0f0] border-2 border-[#ccc] text-[#666]'
              }
    `}
                    >
                      {visualIndex}
                    </div>
                  </div>

                  <div className="pl-6 space-y-1">
                    <p className="text-lg font-bold text-[#333] flex items-center">
                      {cfg.version}
                      {cfg.version === activeVersion && (
                        <span className="ml-2 pl-2 pr-3 py-[2px] text-xs rounded-full bg-[#d1fce6] text-[#00b894] font-bold border border-[#00b894] inline-flex items-center gap-1">
                          <span className="w-2 h-2 bg-[#00b894] rounded-full inline-block" />
                          Active
                        </span>
                      )}
                      {isReverted && (
                        <span className="ml-2 px-2 py-[2px] text-xs rounded-full bg-[#fff0f0] text-[#e17055] font-bold border border-[#e17055] inline-flex items-center">
                          Reverted
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-gray-500 mb-5">{format(date, 'Pp')}</p>
                    <Button
                      bgColor="bg-[#f0f0f0]"
                      hoverColor="hover:bg-[#e0e0e0]"
                      onClick={() => router.push(`/dashboard/projects/${slug}/${cfg.version}`)}
                      height="h-[38px]"
                      icon="/arrow-right.svg"
                    >
                      View Configuration
                    </Button>
                  </div>
                </div>
              </React.Fragment>
            );
          });
        })}

      {/* Add bottom dot for the last year's line */}
      <div />
      <div className="relative pl-2 w-[50px]">
        <span className="absolute right-12 bottom-0 w-4 h-4 bg-white rounded-full border-2 border-[#e4f1ff] transform translate-x-1/2" />
      </div>
      <div className="relative pl-6 border-l-4 border-[#e4f1ff]" />

      {projectStart && (
        <>
          <div
            className="flex items-center text-left pr-2 font-bold text-gray-700 relative"
            style={{ height: '100px' }}
          ></div>

          <div className="text-right pr-2 text-gray-500" />

          <div className="relative pr-2 font-bold text-gray-700">
            <div className="absolute -left-3.5 ml-1 top-0 w-6 h-6 bg-[#d1fce6] border-2 border-[#00b894] rounded-full flex items-center justify-center text-xs font-black text-[#00b894]">
              P
            </div>
            <div className="pl-6">
              <p className="text-sm font-medium text-[#00b894]">Project created</p>
              <p className="text-sm text-gray-500">{format(new Date(projectStart), 'Pp')}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
