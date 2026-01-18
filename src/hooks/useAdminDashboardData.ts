import { useState, useEffect, useCallback } from 'react';
import {
  adminService,
  AdminStats,
  SystemAlert,
  UserManagementData,
  SystemConfiguration,
} from '../services/adminService';

export const useAdminDashboardData = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [userData, setUserData] = useState<UserManagementData | null>(null);
  const [configuration, setConfiguration] = useState<SystemConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [stats, alerts, userData, configuration] = await Promise.all([
        adminService.getStats(),
        adminService.getAlerts(),
        adminService.getUserManagementData(),
        adminService.getSystemConfiguration(),
      ]);
      setStats(stats);
      setAlerts(alerts);
      setUserData(userData);
      setConfiguration(configuration);
    } catch (err) {
      setError('Failed to load dashboard data.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [loadDashboardData]);

  const updateConfiguration = async (newConfig: Partial<SystemConfiguration>) => {
    try {
      await adminService.updateSystemConfiguration(newConfig);
      await loadDashboardData();
    } catch (err) {
      setError('Failed to update configuration.');
      console.error(err);
    }
  };

  return {
    stats,
    alerts,
    userData,
    configuration,
    loading,
    error,
    loadDashboardData,
    updateConfiguration,
  };
};
