import React, { useState } from 'react';
import Image from "next/image";
import { useFormik } from 'formik';
import * as yup from 'yup';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import logo from "/public/sargood-logo-white.svg";
import Modal from '../../components/ui/genericModal';

const FormLayout = dynamic(() => import('../../components/formLayout'));

export default function BookingEnquiry() {
    const [errors, setErrors] = useState(false);
    const [enquirySubmitted, setEnquirySubmitted] = useState(false);
    const [duplicateEmail, setDuplicateEmail] = useState();
    const [showModal, setShowModal] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const formik = useFormik({
        initialValues: {
            first_name: "",
            last_name: "",
            email: "",
            phone_number: "",
            email_verified: false,
        },
        onSubmit: async (values) => {
            setErrors(false);
            setIsLoading(true);
            try {
                const response = await fetch("/api/bookings/enquiry/create-account", {
                    method: "POST",
                    body: JSON.stringify(values)
                });
                
                if (response.ok) {
                    setErrors(false);
                    setEnquirySubmitted(true);
                } else {
                    const data = await response.json();
                    if (data.type == 'unique violation') {
                        setDuplicateEmail(values.email);
                        setErrors(true);
                    }
                }
            } catch (error) {
                console.error('Error creating account:', error);
                setErrors(true);
            } finally {
                setIsLoading(false);
            }
        },
        validationSchema: yup.object({
            first_name: yup
                .string()
                .min(2, "Too Short!")
                .max(50, "Too Long!")
                .required("First name is required"),
            last_name: yup
                .string()
                .min(2, "Too Short!")
                .max(50, "Too Long!")
                .required("Last name is required"),
            phone_number: yup
                .string()
                .required("Phone number is required")
                .matches(
                    /^\(?(\d{3})\)?[- ]?(\d{3})[- ]?(\d{2,4})$/,
                    "Invalid phone number"
                ),
            email: yup
                .string()
                .email("Must be a valid email")
                .required("Email is required"),
        }),
    });

    return (
        <FormLayout>
            <div className="h-full w-full overflow-y-auto">
                <div className="min-h-full flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8">
                    <div className="w-full max-w-lg mx-auto">
                        {showModal ? (
                            <Modal 
                                title="" 
                                confirmLabel={'I Acknowledge'} 
                                onConfirm={() => setShowModal(false)} 
                                external={true} 
                                externalUrl='https://www.sargoodoncollaroy.com'
                            >
                                {/* Modal content */}
                            </Modal>
                        ) : (
                            <>
                                {/* Logo Section */}
                                <div className="flex justify-center mb-8">
                                    <div className="relative w-48 h-48 drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                                        <Image 
                                            alt="Sargood Logo" 
                                            layout="fill" 
                                            objectFit="contain" 
                                            src={logo.src} 
                                        />
                                    </div>
                                </div>

                                {/* Form Card with White Background */}
                                <div className="bg-white rounded-2xl shadow-xl p-8">
                                    {enquirySubmitted ? (
                                        <>
                                            <h1 className="text-3xl font-bold text-sea mb-4 text-center">
                                                Thank You!
                                            </h1>
                                            <div className="bg-green-50 border-2 border-green-400 rounded-lg p-6 text-center mb-6">
                                                <p className="text-neutral-darker">
                                                    You will receive an email from <strong>no-reply@sargoodoncollaroy.com.au</strong> to verify your account and finalize your account setup.
                                                </p>
                                                <p className="text-neutral-darker mt-3">
                                                    If you do not receive this email within 24 hours, please contact our friendly team on <strong>(02) 8597 0600</strong>
                                                </p>
                                            </div>
                                            <div className="text-center">
                                                <a 
                                                    href='https://sargoodoncollaroy.com' 
                                                    className="text-sea hover:text-blend-darker font-bold text-base 
                                                             cursor-pointer transition-colors duration-200 inline-block
                                                             hover:underline decoration-2 underline-offset-2"
                                                >
                                                    Back to Website
                                                </a>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <h1 className="text-3xl font-bold text-sea mb-3 text-center">
                                                Create Your Account
                                            </h1>
                                            <p className="text-neutral-dark text-center mb-6 text-sm">
                                                If you have an existing Sargood Guest Portal account, please{' '}
                                                <Link href="/auth/login">
                                                    <span className="text-sea hover:text-blend-darker font-semibold cursor-pointer transition-colors duration-200 hover:underline decoration-2 underline-offset-2">
                                                        LOGIN HERE
                                                    </span>
                                                </Link>
                                            </p>

                                            {/* Error Alert */}
                                            {errors && (
                                                <div className="bg-red-50 border-2 border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6" role="alert">
                                                    <p className="font-medium text-sm">
                                                        An account with <strong>{duplicateEmail}</strong> already exists. Please use a different email address or{' '}
                                                        <Link href="/auth/login">
                                                            <span className="font-bold underline cursor-pointer hover:text-red-900">
                                                                click here
                                                            </span>
                                                        </Link>{' '}
                                                        to login.
                                                    </p>
                                                </div>
                                            )}

                                            {/* Form - Single Column Layout */}
                                            <form onSubmit={formik.handleSubmit} autoComplete='off' className="space-y-4">
                                                {/* First Name */}
                                                <div>
                                                    <label 
                                                        htmlFor="first_name" 
                                                        className="block text-sm font-semibold text-neutral-darker mb-2"
                                                    >
                                                        First Name (Primary Guest) <span className="text-red-500">*</span>
                                                    </label>
                                                    <input
                                                        id="first_name"
                                                        name="first_name"
                                                        type="text"
                                                        autoComplete='off'
                                                        placeholder="First Name"
                                                        value={formik.values.first_name}
                                                        onChange={formik.handleChange}
                                                        onBlur={formik.handleBlur}
                                                        className="w-full px-4 py-3 text-base border-2 border-neutral-light rounded-lg
                                                                 focus:outline-none focus:border-sea focus:ring-2 focus:ring-sea/20
                                                                 transition-all duration-200 bg-white text-neutral-darker
                                                                 placeholder:text-neutral"
                                                    />
                                                    {(formik.touched.first_name && formik.errors.first_name) && (
                                                        <p className="mt-2 text-sm text-red-600 flex items-center">
                                                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                            </svg>
                                                            {formik.errors.first_name}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Last Name */}
                                                <div>
                                                    <label 
                                                        htmlFor="last_name" 
                                                        className="block text-sm font-semibold text-neutral-darker mb-2"
                                                    >
                                                        Last Name (Primary Guest) <span className="text-red-500">*</span>
                                                    </label>
                                                    <input
                                                        id="last_name"
                                                        name="last_name"
                                                        type="text"
                                                        autoComplete='off'
                                                        placeholder="Last Name"
                                                        value={formik.values.last_name}
                                                        onChange={formik.handleChange}
                                                        onBlur={formik.handleBlur}
                                                        className="w-full px-4 py-3 text-base border-2 border-neutral-light rounded-lg
                                                                 focus:outline-none focus:border-sea focus:ring-2 focus:ring-sea/20
                                                                 transition-all duration-200 bg-white text-neutral-darker
                                                                 placeholder:text-neutral"
                                                    />
                                                    {(formik.touched.last_name && formik.errors.last_name) && (
                                                        <p className="mt-2 text-sm text-red-600 flex items-center">
                                                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                            </svg>
                                                            {formik.errors.last_name}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Email */}
                                                <div>
                                                    <label 
                                                        htmlFor="email" 
                                                        className="block text-sm font-semibold text-neutral-darker mb-2"
                                                    >
                                                        Email Address <span className="text-red-500">*</span>
                                                    </label>
                                                    <input
                                                        id="email"
                                                        name="email"
                                                        type="email"
                                                        autoComplete='off'
                                                        placeholder="Email address"
                                                        value={formik.values.email}
                                                        onChange={formik.handleChange}
                                                        onBlur={formik.handleBlur}
                                                        className="w-full px-4 py-3 text-base border-2 border-neutral-light rounded-lg
                                                                 focus:outline-none focus:border-sea focus:ring-2 focus:ring-sea/20
                                                                 transition-all duration-200 bg-white text-neutral-darker
                                                                 placeholder:text-neutral"
                                                    />
                                                    {(formik.touched.email && formik.errors.email) && (
                                                        <p className="mt-2 text-sm text-red-600 flex items-center">
                                                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                            </svg>
                                                            {formik.errors.email}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Phone Number */}
                                                <div>
                                                    <label 
                                                        htmlFor="phone_number" 
                                                        className="block text-sm font-semibold text-neutral-darker mb-2"
                                                    >
                                                        Phone Number <span className="text-red-500">*</span>
                                                    </label>
                                                    <input
                                                        id="phone_number"
                                                        name="phone_number"
                                                        type="text"
                                                        autoComplete='off'
                                                        placeholder="Phone Number"
                                                        value={formik.values.phone_number}
                                                        onChange={formik.handleChange}
                                                        onBlur={formik.handleBlur}
                                                        className="w-full px-4 py-3 text-base border-2 border-neutral-light rounded-lg
                                                                 focus:outline-none focus:border-sea focus:ring-2 focus:ring-sea/20
                                                                 transition-all duration-200 bg-white text-neutral-darker
                                                                 placeholder:text-neutral"
                                                    />
                                                    {(formik.touched.phone_number && formik.errors.phone_number) && (
                                                        <p className="mt-2 text-sm text-red-600 flex items-center">
                                                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                            </svg>
                                                            {formik.errors.phone_number}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Submit Button */}
                                                <button
                                                    type="submit"
                                                    disabled={isLoading}
                                                    className="w-full bg-sun hover:bg-sunset text-[#333333] font-extrabold py-3.5 px-6 rounded-lg
                                                             transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]
                                                             shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed
                                                             disabled:transform-none text-base uppercase tracking-wide mt-6"
                                                >
                                                    {isLoading ? 'Creating Account...' : 'Create an Account'}
                                                </button>
                                            </form>
                                        </>
                                    )}
                                </div>

                                {/* Additional Info */}
                                {!enquirySubmitted && (
                                    <div className="mt-6 text-center">
                                        <p className="text-white text-sm font-medium">
                                            Need help?{' '}
                                            <a 
                                                href="tel:0285970600" 
                                                className="text-sun hover:text-sunset font-bold transition-colors underline"
                                            >
                                                Contact Support
                                            </a>
                                        </p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </FormLayout>
    );
}