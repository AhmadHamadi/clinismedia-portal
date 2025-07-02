import React from "react";

const INVOICE_LINK = "https://your-invoice-link.com"; // Update this link monthly as needed

const DecorativeSparkle = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-2 animate-pulse">
    <path d="M16 2L18.09 10.26L26 12L18.09 13.74L16 22L13.91 13.74L6 12L13.91 10.26L16 2Z" fill="#98c6d5"/>
  </svg>
);

const CustomerInvoicePage: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] px-2 py-8 bg-gradient-to-br from-[#f8fafc] to-[#e0f2fe]">
    <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-10 flex flex-col items-center border border-[#e0e7ef] relative">
      <div className="absolute top-6 right-6 opacity-20 rotate-12">
        <DecorativeSparkle />
      </div>
      <div className="absolute bottom-6 left-6 opacity-10 -rotate-12">
        <DecorativeSparkle />
      </div>
      <DecorativeSparkle />
      <h1 className="text-3xl font-extrabold text-[#60a5fa] mb-2 tracking-tight text-center font-sans">
        View Your Latest Invoice
      </h1>
      <p className="text-gray-600 text-center mb-6 max-w-md font-medium">
        Access your most recent invoice securely. Download or print for your records. New invoices are added every month—check back often!
      </p>
      <a
        href={INVOICE_LINK}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 px-8 py-3 bg-[#98c6d5] text-white rounded-xl font-bold text-lg shadow-lg hover:bg-[#1877f3] hover:scale-105 transition-all duration-200 ease-in-out focus:outline-none focus:ring-4 focus:ring-[#98c6d5]/40"
      >
        <span className="inline-block align-middle mr-2">🔗</span> View
      </a>
    </div>
  </div>
);

export default CustomerInvoicePage; 