interface DashboardBoxProps {
  title: string;
  description: string;
  onClick: () => void;
}

export const DashboardBox = ({ title, description, onClick }: DashboardBoxProps) => (
  <div
    onClick={onClick}
    className="cursor-pointer rounded-xl bg-white p-6 shadow-md hover:shadow-lg transition flex flex-col justify-center items-center text-center h-48"
  >
    <h2 className="text-xl font-semibold mb-2" style={{ color: "#303b45" }}>
      {title}
    </h2>
    <p className="text-sm text-black">{description}</p>
  </div>
);
