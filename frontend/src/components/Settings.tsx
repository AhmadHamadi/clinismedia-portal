// src/components/AdminSettingsPage.tsx
import SidebarMenu from "./SidebarMenu";

const AdminSettings = () => {
  return (
    <div className="flex min-h-screen bg-gray-100 font-sans">
      <SidebarMenu />
      <div className="flex-1 p-6">
        <h1 className="text-2xl font-bold text-[#303b45] mb-4">Admin Settings</h1>
        <p>Admin settings configuration UI goes here.</p>
      </div>
    </div>
  );
};

export default AdminSettings;
