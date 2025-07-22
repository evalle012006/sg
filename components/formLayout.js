import React from "react";
import Image from "next/image";
import HeroImage from '/public/auth-hero-image3.png';

function FormLayout(props) {
  const { children } = props;

  return (
    <div className="flex h-screen au overflow-hidden">
      <div className="relative w-0 lg:w-[65%] lg:p-5 flex items-center justify-center bg-teal-50">
        <Image alt="Sargood on Collaroy" layout="fill" priority={true} objectFit="fill" src={HeroImage.src} />
      </div>
      <div className="w-full lg:w-[35%] p-5 flex items-center">{children}</div>
    </div>
  );
}

export default FormLayout;
