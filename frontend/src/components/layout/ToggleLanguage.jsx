import React from 'react'
import { useState } from "react";
import Button from '../ui/Button';
const ToggleLanguage = ({setLanguage, language}) => {
  const toggleLanguage = () => {
    setLanguage((prev) => (prev === "en" ? "ar" : "en"));
  };

  return (
    <Button onClick={toggleLanguage} size='sm' className='border-none'>
        <span
        className={`transition ${
          language === "en" ? "text-blue-600 font-semibold" : "text-gray-500"
        }`}
      >
        EN
      </span>

      <div className="relative h-5 w-10 rounded-full bg-gray-300">
        <div
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-300 ${
            language === "ar" ? "right-5" : "left-1"
          }`}
        />
      </div>

      <span
        className={`transition ${
          language === "ar" ? "text-blue-600 font-semibold" : "text-gray-500"
        }`}
      >
        عَ
      </span>
    </Button>
    
  );

}

export default ToggleLanguage
