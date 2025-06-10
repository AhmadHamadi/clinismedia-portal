import { MdOutlinePerson } from "react-icons/md"; // person icon for username
import { FaFingerprint } from "react-icons/fa";
import { FaRegEye, FaRegEyeSlash } from "react-icons/fa";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/CliniMedia_Logo.png";

const Login = () => {
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const navigate = useNavigate();

  const togglePasswordView = () => setShowPassword(!showPassword);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // For now, we'll just navigate to the admin dashboard
    // Later we'll add actual authentication logic here
    navigate("/admin");
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

        {/* Removed the sign up text */}

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
            className="w-full p-2 bg-blue-600 rounded-xl mt-3 hover:bg-blue-700 text-sm md:text-base text-white font-semibold"
          >
            Login
          </button>
        </form>

        {/* Removed the 'Or' separator and social login buttons */}
      </div>
    </div>
  );
};

export default Login;
