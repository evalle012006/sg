import Image from "next/image";
import Link from "next/link";
import logo from "/public/sargood-logo.svg";

export default function Custom404() {
    return (
        <div className="flex flex-col justify-center items-center h-screen">
            <div className="relative w-36 h-36 pb-6">
                <Image src={logo.src} layout='fill' objectFit="contain" alt="Sargood on Collaroy Logo" />
            </div>
            <h1 className="text-4xl font-bold">404 - Page Not Found</h1>
            <p className="text-xl">The page you are looking for does not exist.</p>
            <Link href="/dashboard" className="mt-10 text-sky-300 hover:text-sky-500">Go back home</Link>
        </div>
    )
}