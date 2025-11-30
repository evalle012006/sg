import React from "react";
import Image from "next/image";
import HeroImage from '/public/auth-hero-image3.png';

function FormLayout(props) {
  const { children } = props;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left side - Hero Image (hidden on mobile, visible on large screens) */}
      <div className="hidden lg:block lg:w-[65%] relative overflow-hidden">
        <Image 
          alt="Sargood on Collaroy" 
          layout="fill" 
          priority={true} 
          objectFit="cover" 
          src={HeroImage.src} 
          className="object-cover"
        />
      </div>

      {/* Right side - Form Area with Blue Background */}
      <div className="w-full lg:w-[35%] bg-[#00467F] flex items-center justify-center p-5 overflow-y-auto">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  );
}

export default FormLayout;