import React, { ReactNode } from 'react';

interface CardDataStatsProps {
  title: string;
  total: string;
  setSelectKey: (key: string | null) => void;
  children: ReactNode;
  isLoading?: boolean;
  isActive?: boolean;
}

const CardDataStats: React.FC<CardDataStatsProps> = ({
  title,
  total,
  setSelectKey,
  children,
  isLoading = false,
  isActive = false,
}) => {
  return (
    <div
      onClick={() => !isLoading && setSelectKey(isActive ? null : title)}
      className={`rounded-sm border duration-200 py-6 px-7.5 shadow-default dark:bg-boxdark ${isActive
          ? 'bg-blue-50 border-primary dark:bg-meta-4 scale-105'
          : 'bg-white border-stroke dark:border-strokedark'
        } ${isLoading ? 'opacity-60 cursor-not-allowed' : 'hover:scale-105 hover:cursor-pointer'
        }`}
    >
      <div className='grid grid-cols-12 justify-between items-center'>
        <div className='col-span-10'>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <h4 className="text-title-md font-bold text-black dark:text-white">
                {isLoading ? '...' : total}
              </h4>
              <span className="text-sm font-medium hover:underline cursor-pointer">{title}</span>
            </div>
          </div>
        </div>
        <div className='col-span-2'>
          <div className=''>
            <div className="flex h-11.5 w-11.5 items-center justify-center rounded-full bg-meta-2 dark:bg-meta-4">
              {isLoading ? (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              ) : (
                children
              )}
            </div>
          </div>
        </div>
        <div></div>
      </div>
    </div>
  );
};

export default CardDataStats;
