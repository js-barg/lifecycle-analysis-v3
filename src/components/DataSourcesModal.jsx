import React from 'react';
import { X } from 'lucide-react';

const DataSourcesModal = ({ product, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Data Sources</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Vendor Sites:</span>
            <span className="font-medium">{product?.data_sources?.vendor_site || 0}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Third Party:</span>
            <span className="font-medium">{product?.data_sources?.third_party || 0}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Manual Entry:</span>
            <span className="font-medium">{product?.data_sources?.manual_entry || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataSourcesModal;