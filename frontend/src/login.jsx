// src/Login.jsx
import React from 'react';

const Login = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#303b45] p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 space-y-6">
        <div className="text-center">
          <img
            src="/CliniMedia_Logo.png"
            alt="CliniMedia Logo"
            className="w-20 h-20 mx-auto mb-4"
          />

          <h1 className="text-red-500 text-2xl">Tailwind working in Login.jsx</h1>
          <h2 className="text-2xl font-bold text-gray-800">Sign in to CliniMedia</h2>
          <p className="text-sm text-gray-500">Enter your credentials below</p>
        </div>

        <form className="space-y-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              type="text"
              placeholder="yourusername"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold transition-all"
          >
            Sign In
          </button>
        </form>

        <div className="text-center text-sm text-gray-500">
          Don’t have an account? <span className="text-blue-600 underline cursor-pointer">Contact Admin</span>
        </div>
      </div>
    </div>
  );
};

export default Login;
