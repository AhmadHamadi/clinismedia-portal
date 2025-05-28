import { MdOutlinePerson } from "react-icons/md"; // Changed to person icon for username
import { FaFingerprint } from "react-icons/fa";
import { FaRegEye, FaRegEyeSlash } from "react-icons/fa";
import { useState } from "react";
import { BsApple } from "react-icons/bs";
import { FaXTwitter } from "react-icons/fa6";

const Login = () => {
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const togglePasswordView = () => setShowPassword(!showPassword);

  return (
    <div className="w-full h-screen flex items-center justify-center bg-gray-900">
      <div className="w-[90%] max-w-sm md:max-w-md lg:max-w-md p-5 bg-gray-900 flex-col flex items-center gap-3 rounded-xl shadow-slate-500 shadow-lg">
        {/* Replace logo */}
        <img src="/CliniMedia_Logo.png" alt="CliniMedia Logo" className="w-20 h-auto mx-auto mb-2" />

        <h1 className="text-lg md:text-xl font-semibold text-white">Welcome Back</h1>
        <p className="text-xs md:text-sm text-gray-400 text-center">
          Don't have an account? <span className="text-blue-500 cursor-pointer">Sign up</span>
        </p>

        <div className="w-full flex flex-col gap-3 mt-2">
          {/* Username input */}
          <div className="w-full flex items-center gap-2 bg-gray-800 p-2 rounded-xl">
            <MdOutlinePerson className="text-gray-400" />
            <input
              type="text"
              placeholder="Username"
              className="bg-transparent border-0 w-full outline-none text-sm md:text-base text-white placeholder-gray-500"
            />
          </div>

          {/* Password input */}
          <div className="w-full flex items-center gap-2 bg-gray-800 p-2 rounded-xl relative">
            <FaFingerprint className="text-gray-400" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
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
        </div>

        <button className="w-full p-2 bg-blue-600 rounded-xl mt-3 hover:bg-blue-700 text-sm md:text-base text-white font-semibold">
          Login
        </button>

        <div className="relative w-full flex items-center justify-center py-3">
          <div className="w-2/5 h-[2px] bg-gray-800"></div>
          <h3 className="font-lora text-xs md:text-sm px-4 text-gray-500">Or</h3>
          <div className="w-2/5 h-[2px] bg-gray-800"></div>
        </div>

        <div className="w-full flex items-center justify-evenly md:justify-between gap-2">
          <div className="p-2 md:px-6 lg:px-10 bg-slate-700 cursor-pointer rounded-xl hover:bg-slate-800">
            <BsApple className="text-lg md:text-xl text-white" />
          </div>
          <div className="p-1 md:px-6 lg:px-10 bg-slate-700 cursor-pointer rounded-xl hover:bg-slate-800">
            <img
              src="/google-icon.png"
              alt="google-icon"
              className="w-6 md:w-8"
            />
          </div>
          <div className="p-2 md:px-6 lg:px-10 bg-slate-700 cursor-pointer rounded-xl hover:bg-slate-800">
            <FaXTwitter className="text-lg md:text-xl text-white" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
