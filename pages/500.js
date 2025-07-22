import Image from "next/image";
import logo from "/public/sargood-logo.svg";

export default function Custom500() {
    return (
        <div className="flex flex-col justify-center items-center h-screen">
            <div className="relative w-36 h-36 pb-6">
                <Image src={logo.src} layout='fill' objectFit="contain" alt="Sargood on Collaroy Logo" />
            </div>
            <h1 className="text-4xl font-bold">500 - Server-side error occurred</h1>
            <p className="text-xl">An error occurred on the server-side. Please try again later.</p>
        </div>
    )
}
