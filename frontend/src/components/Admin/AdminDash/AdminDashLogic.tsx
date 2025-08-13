interface DashboardBoxProps {
  title: string;
  description: string;
  onClick: () => void;
  notificationCount?: number;
}

export const DashboardBox = ({ title, description, onClick, notificationCount }: DashboardBoxProps) => (
  <div className="relative">
    <div
      onClick={onClick}
      className="cursor-pointer rounded-xl bg-white p-6 shadow-md hover:shadow-lg transition flex flex-col justify-center items-center text-center h-48"
    >
      <h2 className="text-xl font-semibold mb-2" style={{ color: "#303b45" }}>
        {title}
      </h2>
      <p className="text-sm text-black">{description}</p>
    </div>
    {notificationCount && notificationCount > 0 && (
      <span className="absolute top-2 right-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
        {notificationCount}
      </span>
    )}
  </div>
);
