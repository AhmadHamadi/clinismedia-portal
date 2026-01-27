import axios from 'axios';

export const logout = async (role: 'admin' | 'customer' | 'employee') => {
  try {
    const token = localStorage.getItem(`${role}Token`);
    
    if (token) {
      // Call backend logout endpoint
      await axios.post(`${import.meta.env.VITE_API_BASE_URL}/auth/logout`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    }
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    // Clear all local storage
    localStorage.removeItem('adminToken');
    localStorage.removeItem('customerToken');
    localStorage.removeItem('employeeToken');
    localStorage.removeItem('adminData');
    localStorage.removeItem('customerData');
    localStorage.removeItem('employeeData');
  }
};

export const clearAllSessions = () => {
  localStorage.removeItem('adminToken');
  localStorage.removeItem('customerToken');
  localStorage.removeItem('employeeToken');
  localStorage.removeItem('adminData');
  localStorage.removeItem('customerData');
  localStorage.removeItem('employeeData');
};

export const getCurrentUser = () => {
  const adminData = localStorage.getItem('adminData');
  const customerData = localStorage.getItem('customerData');
  const employeeData = localStorage.getItem('employeeData');
  
  if (adminData) return { ...JSON.parse(adminData), role: 'admin' };
  if (customerData) {
    const u = JSON.parse(customerData);
    return { ...u, role: u.role || 'customer' };
  }
  if (employeeData) return { ...JSON.parse(employeeData), role: 'employee' };
  
  return null;
}; 