import React from 'react';

const JobProgress = ({ job, onRefresh }) => {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-blue-900">
            Processing: {job?.status || 'In Progress'}
          </p>
          <p className="text-xs text-blue-700 mt-1">
            Job ID: {job?.job_id}
          </p>
        </div>
        <button 
          onClick={onRefresh}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>
    </div>
  );
};

export default JobProgress;