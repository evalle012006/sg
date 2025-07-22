import React, { useState } from 'react';
import Image from "next/image";
import { useFormik } from 'formik';
import * as yup from 'yup';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import logo from "/public/sargood-logo.svg";
import Modal from '../../components/ui/genericModal';

const FormLayout = dynamic(() => import('../../components/formLayout'));

export default function BookingEnquiry() {
    const [errors, setErrors] = useState(false);
    const [enquirySubmitted, setEnquirySubmitted] = useState(false);
    const [duplicateEmail, setDuplicateEmail] = useState();
    const [showModal, setShowModal] = useState(false);

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
            const response = await fetch("/api/bookings/enquiry/create-account", {
                method: "POST",
                body: JSON.stringify(values)
            })
            if (response.ok) {
                setErrors(false);
                setEnquirySubmitted(true);
            } else {
                const data = await response.json();
                if (data.type == 'unique violation') {
                    setDuplicateEmail(values.email);
                    setErrors(true)
                }
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
                    <div className="max-w-md w-full mx-auto space-y-8">
                        <div className="flex justify-center">
                            <div className="relative w-40 h-40">
                                <Image alt="logo" layout="fill" objectFit="contain" src={logo.src} />
                            </div>
                        </div>
                        
                        {showModal ? (
                            <Modal title="" confirmLabel={'I Acknowledge'} onConfirm={() => setShowModal(false)} external={true} externalUrl='https://www.sargoodoncollaroy.com'>
                                {/* Modal content */}
                            </Modal>
                        ) : (
                            <div className="space-y-6">
                                {enquirySubmitted ? (
                                    <>
                                        <h1 className="mt-6 text-center text-2xl font-bold text-sargood-blue">
                                            Thank you for creating an account.
                                        </h1>
                                        <div className="bg-green-100 border border-green-400 rounded p-4 text-center">
                                            You will receive an e-mail from no-reply@sargoodoncollaroy.com.au to verify your account and finalise your account set up. If you do not receive this e-mail within 24 hours, please contact our friendly team on (02) 8597 0600
                                        </div>
                                        <div className="text-center">
                                            <a href='https://sargoodoncollaroy.com' className="font-bold underline">Back to Website</a>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <h1 className="mt-6 text-center text-2xl font-bold text-sargood-blue">
                                            Welcome to Sargood on Collaroy!
                                        </h1>
                                        <p className="mt-2 text-center text-sm text-gray-600">
                                            If you have an existing Sargood Guest Portal account, please{' '}
                                            <Link href="/auth/login">
                                                <span className="font-medium text-sargood-blue hover:text-sargood-blue-dark cursor-pointer">
                                                    LOGIN HERE
                                                </span>
                                            </Link>{' '}
                                            to make a booking. If you do not have an account, please complete the information below.
                                        </p>
                                        {errors && (
                                            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                                                <span className="block sm:inline">
                                                    An account with <strong>{duplicateEmail}</strong> already exists. Please use a different email address or{' '}
                                                    <Link href="/auth/login">
                                                        <span className="font-bold underline cursor-pointer">click here</span>
                                                    </Link>{' '}
                                                    to login.
                                                </span>
                                            </div>
                                        )}
                                        <form className="mt-8 space-y-6" onSubmit={formik.handleSubmit} autoComplete='off'>
                                            <div className='grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4'>
                                                <div className="flex flex-col space-y-2">
                                                    <label className="text-sm font-bold text-gray-700 tracking-wide required">
                                                        First Name (Primary Guest)
                                                    </label>
                                                    <input
                                                        className="w-full px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-sargood-blue"
                                                        id="first-name"
                                                        name="first_name"
                                                        type="text"
                                                        autoComplete='off'
                                                        placeholder="First Name"
                                                        value={formik.values.first_name}
                                                        onChange={formik.handleChange}
                                                        onBlur={formik.handleBlur} />
                                                    {(formik.touched.first_name && formik.errors.first_name) && (
                                                        <div className="text-base text-red-600">{formik.errors.first_name}</div>
                                                    )}
                                                </div>
                                                <div className="flex flex-col space-y-2">
                                                    <label className="text-sm font-bold text-gray-700 tracking-wide required">
                                                        Last Name (Primary Guest)
                                                    </label>
                                                    <input
                                                        className="w-full px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-sargood-blue"
                                                        id="last-name"
                                                        name="last_name"
                                                        type="text"
                                                        autoComplete='off'
                                                        placeholder="Last Name"
                                                        value={formik.values.last_name}
                                                        onChange={formik.handleChange}
                                                        onBlur={formik.handleBlur} />
                                                    {(formik.touched.last_name && formik.errors.last_name) && (
                                                        <div className="text-base text-red-600">{formik.errors.last_name}</div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className='grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4'>
                                                <div className="flex flex-col space-y-2">
                                                    <label className="text-sm font-bold text-gray-700 tracking-wide required">
                                                        Email
                                                    </label>
                                                    <input
                                                        className="w-full px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-sargood-blue"
                                                        id="email"
                                                        name="email"
                                                        type="email"
                                                        autoComplete='off'
                                                        placeholder="Email address"
                                                        value={formik.values.email}
                                                        onChange={formik.handleChange}
                                                        onBlur={formik.handleBlur} />
                                                    {(formik.touched.email && formik.errors.email) && (
                                                        <div className='text-base text-red-600'>{formik.errors.email}</div>
                                                    )}
                                                </div>
                                                <div className='flex flex-col space-y-2'>
                                                    <label className="text-sm font-bold text-gray-700 tracking-wide required">
                                                        Phone Number
                                                    </label>
                                                    <input
                                                        className="w-full px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-sargood-blue"
                                                        id="phone-number"
                                                        name="phone_number"
                                                        type="text"
                                                        autoComplete='off'
                                                        placeholder="Phone Number"
                                                        value={formik.values.phone_number}
                                                        onChange={formik.handleChange}
                                                        onBlur={formik.handleBlur} />
                                                    {(formik.touched.phone_number && formik.errors.phone_number) && (
                                                        <div className="text-base text-red-600">{formik.errors.phone_number}</div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <button className="px-4 py-2 my-2 bg-yellow-400 hover:bg-sky-900 hover:text-white rounded focus:outline-none focus:shadow-outline"
                                                    type="submit">
                                                    Create an Account
                                                </button>
                                            </div>
                                        </form>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </FormLayout>
    );
}