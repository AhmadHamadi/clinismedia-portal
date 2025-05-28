// src/App.jsx
import React from 'react';

const App = () => {
  return (
    <div className="min-h-screen bg-[#303b45] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center border border-blue-200">
        <img
          src="/CliniMedia_Logo.png"
          alt="CliniMedia Logo"
          className="w-24 h-24 mx-auto mb-6 rounded-full shadow-md"
        />
        <h1 className="text-3xl font-extrabold text-blue-700 mb-2">
          Welcome to CliniMedia Portal
        </h1>

        <p className="mb-1" style={{ color: '#00FF00' }}>Tailwind CSS is working ✅</p>
        <p className="mb-1" style={{ color: '#FF69B4' }}>This is bright pink text.</p>
        <p className="mb-1" style={{ color: '#FFD700' }}>This is gold (yellow) text.</p>
        <p className="mb-6" style={{ color: '#BA55D3' }}>This is purple text.</p>

        <button className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-full shadow-lg transition-all duration-300">
          Login
        </button>
      </div>
    </div>
  );
};

export default App;
