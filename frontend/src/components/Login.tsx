import { MdOutlinePerson } from "react-icons/md"; // person icon for username
import { FaFingerprint } from "react-icons/fa";
import { FaRegEye, FaRegEyeSlash } from "react-icons/fa";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import logo from "../assets/CliniMedia_Logo.png";

const Login = () => {
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const navigate = useNavigate();

  const togglePasswordView = () => setShowPassword(!showPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await axios.post("http://localhost:5000/api/auth/login", {
        username,
        password,
      });

      const { token, user } = response.data;

      // Store token and user data based on role
      if (user.role === "admin") {
        localStorage.setItem("adminToken", token);
        localStorage.setItem("adminData", JSON.stringify(user));
        navigate("/admin");
      } else if (user.role === "customer") {
        localStorage.setItem("customerToken", token);
        localStorage.setItem("customerData", JSON.stringify(user));
        navigate("/customer/dashboard");
      } else if (user.role === "employee") {
        localStorage.setItem("employeeToken", token);
        localStorage.setItem("employeeData", JSON.stringify(user));
        navigate("/employee/dashboard");
      } else {
        setError("Invalid user role");
      }
    } catch (err: any) {
      console.error("Login error:", err);
      if (err.response && err.response.data && err.response.data.message) {
        setError(err.response.data.message);
      } else {
        setError("Login failed. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-screen flex items-center justify-center bg-gray-900">
      <div className="w-[90%] max-w-sm md:max-w-md lg:max-w-md p-5 bg-gray-900 flex-col flex items-center gap-3 rounded-xl shadow-slate-500 shadow-lg">
        {/* Bigger logo */}
        <img
          src={logo}
          alt="CliniMedia Logo"
          className="w-45 h-auto mx-auto mt-6"
        />

        <h1 className="text-lg md:text-xl font-semibold text-white">Welcome Back</h1>

        {/* Error message */}
        {error && (
          <div className="w-full bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3 mt-2">
          {/* Username input */}
          <div className="w-full flex items-center gap-2 bg-gray-800 p-2 rounded-xl">
            <MdOutlinePerson className="text-gray-400" />
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-transparent border-0 w-full outline-none text-sm md:text-base text-white placeholder-gray-500"
              disabled={loading}
            />
          </div>

          {/* Password input */}
          <div className="w-full flex items-center gap-2 bg-gray-800 p-2 rounded-xl relative">
            <FaFingerprint className="text-gray-400" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-transparent border-0 w-full outline-none text-sm md:text-base text-white placeholder-gray-500"
              disabled={loading}
            />
            {showPassword ? (
              <FaRegEyeSlash
                className="absolute right-5 cursor-pointer text-gray-400"
                onClick={togglePasswordView}
              />
            ) : (
              <FaRegEye
                className="absolute right-5 cursor-pointer text-gray-400"
                onClick={togglePasswordView}
              />
            )}
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full p-2 bg-blue-600 rounded-xl mt-3 hover:bg-blue-700 text-sm md:text-base text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        {/* Removed the 'Or' separator and social login buttons */}
      </div>
    </div>
  );
};

export default Login;
