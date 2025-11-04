
import React from 'react';
import { WaterOrder, WaterOrderStatus } from '../types';
import { CheckCircleIcon, XCircleIcon, ClockIcon, RefreshIcon } from './icons';

interface WaterOrderListProps {
  orders: WaterOrder[];
  title: string;
  actions?: (order: WaterOrder) => React.ReactNode;
}

const getStatusPill = (status: WaterOrderStatus) => {
  switch (status) {
    case WaterOrderStatus.AwaitingApproval:
      return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800 flex items-center"><ClockIcon className="h-4 w-4 mr-1" />Awaiting Approval</span>;
    case WaterOrderStatus.Pending:
      return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800 flex items-center"><ClockIcon className="h-4 w-4 mr-1" />Pending</span>;
    case WaterOrderStatus.Approved:
      return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 flex items-center"><CheckCircleIcon className="h-4 w-4 mr-1" />Approved</span>;
    case WaterOrderStatus.InProgress:
      return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 flex items-center"><RefreshIcon className="h-4 w-4 mr-1 animate-spin" />In Progress</span>;
    case WaterOrderStatus.Completed:
      return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 flex items-center"><CheckCircleIcon className="h-4 w-4 mr-1" />Completed</span>;
    case WaterOrderStatus.Cancelled:
      return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800 flex items-center"><XCircleIcon className="h-4 w-4 mr-1" />Cancelled</span>;
  }
};

const WaterOrderList: React.FC<WaterOrderListProps> = ({ orders, title, actions }) => {
  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Field</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount (AF)</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              {actions && <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {orders.length === 0 ? (
                <tr>
                    <td colSpan={actions ? 6: 5} className="text-center py-4 text-sm text-gray-500">No orders to display.</td>
                </tr>
            ) : (
                orders.map(order => (
                <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{order.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.fieldName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.orderDate}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.requestedAmount}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getStatusPill(order.status)}</td>
                    {actions && <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{actions(order)}</td>}
                </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default WaterOrderList;