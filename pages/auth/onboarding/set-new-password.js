import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useFormik } from "formik";
import * as yup from 'yup';
import Image from "next/image"
import Link from "next/link";
import logo from "/public/sargood-logo-white.svg";

import dynamic from 'next/dynamic';
const FormLayout = dynamic(() => import('./../../../components/formLayout'));
const Spinner = dynamic(() => import('../../../components/ui/spinner'));

function SetNewPasswordPage() {
    const router = useRouter();
    const { token } = router.query;
    const [tokenData, setTokenData] = useState({ email: null, user_type: null });

    const [status, setStatus] = useState("loading");
    const [submitted, setSubmitted] = useState(false);
    const [passwordStatus, setPasswordStatus] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        if (token) {
            validateToken();
        }
    }, [token]);

    const validateToken = async () => {
        const res = await fetch("/api/auth/validate-token", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                token,
                userEmail: tokenData.email ? tokenData.email : null,
                userType: tokenData.user_type ? tokenData.user_type : null,
            }),
        });

        const data = await res.json();
        console.log('data', data)

        if (data.status == "valid") {
            setStatus("valid-token");
            setTokenData(data);
        } else {
            setStatus("invalid-token");
        }
    };

    const formik = useFormik({
        initialValues: { password: '', confirm_password: '' },
        onSubmit: (values) => {
            setSubmitted(true)
            fetch('/api/auth/reset-password', {
                method: 'POST',
                body: JSON.stringify({
                    token: token,
                    password: values.password,
                    confirm_password: values.confirm_password,
                    usertype: tokenData.user_type
                }),
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
            }).then(response => response.json()).then(response => {
                setMessage(response.message)
                setPasswordStatus(response.status)
                setTimeout(() => {
                    if (tokenData.user_type == 'guest') {
                        router.push('/auth/login')
                    } else {
                        router.push('/auth/admin-login')
                    }
                }, 1500);
            })
        },
        validationSchema: yup.object({
            password: yup.string()
                .required('No password provided.')
                .min(8, 'Password is too short - should be 8 characters minimum.'),
            confirm_password: yup.string()
                .oneOf([yup.ref('password'), null], 'Passwords must match')
        }),
    })

    return (
        <FormLayout>
            <div className="w-full max-w-md mx-auto">
                {/* Loading State */}
                {status == 'loading' && (
                    <div className="flex justify-center items-center py-20">
                        <Spinner />
                    </div>
                )}

                {/* Valid Token - Show Form */}
                {status == 'valid-token' && (
                    <div className="w-full">
                        {/* Logo Section */}
                        <div className="flex justify-center mb-6">
                            <div className="relative w-48 h-48 drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                                <Image alt="Sargood Logo" layout="fill" objectFit="contain" src={logo.src} />
                            </div>
                        </div>

                        {/* Form Card */}
                        <div className="bg-white rounded-2xl shadow-xl p-8">
                            <h1 className="text-3xl font-bold text-sea mb-2 text-center">
                                Set New Password
                            </h1>
                            <p className="text-neutral-dark text-center mb-6">
                                for {tokenData.email}
                            </p>

                            {/* Success/Error Message */}
                            {submitted && message && (
                                <div className={`mb-6 p-4 rounded-lg border-l-4 ${
                                    passwordStatus == 'success' 
                                        ? 'bg-green-50 border-green-500 text-green-800' 
                                        : 'bg-red-50 border-red-500 text-red-800'
                                }`}>
                                    <div className="flex items-center">
                                        {passwordStatus == 'success' ? (
                                            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                        ) : (
                                            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                        <p className="font-medium">{message}</p>
                                    </div>
                                </div>
                            )}

                            {/* Form */}
                            <form onSubmit={formik.handleSubmit} className="space-y-5">
                                {/* New Password Field */}
                                <div>
                                    <label 
                                        htmlFor="password" 
                                        className="block text-sm font-semibold text-neutral-darker mb-2"
                                    >
                                        New Password
                                    </label>
                                    <input
                                        id="password"
                                        name="password"
                                        type="password"
                                        value={formik.values.password}
                                        onChange={formik.handleChange}
                                        onBlur={formik.handleBlur}
                                        className="w-full px-4 py-3 text-base border-2 border-neutral-light rounded-lg
                                                 focus:outline-none focus:border-sea focus:ring-2 focus:ring-sea/20
                                                 transition-all duration-200 bg-white text-neutral-darker
                                                 placeholder:text-neutral"
                                        placeholder="Enter new password (min 8 characters)"
                                    />
                                    {formik.touched.password && formik.errors.password && (
                                        <p className="mt-2 text-sm text-red-600 flex items-center">
                                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                            {formik.errors.password}
                                        </p>
                                    )}
                                </div>

                                {/* Confirm Password Field */}
                                <div>
                                    <label 
                                        htmlFor="confirm_password" 
                                        className="block text-sm font-semibold text-neutral-darker mb-2"
                                    >
                                        Confirm Password
                                    </label>
                                    <input
                                        id="confirm_password"
                                        name="confirm_password"
                                        type="password"
                                        value={formik.values.confirm_password}
                                        onChange={formik.handleChange}
                                        onBlur={formik.handleBlur}
                                        className="w-full px-4 py-3 text-base border-2 border-neutral-light rounded-lg
                                                 focus:outline-none focus:border-sea focus:ring-2 focus:ring-sea/20
                                                 transition-all duration-200 bg-white text-neutral-darker
                                                 placeholder:text-neutral"
                                        placeholder="Re-enter your password"
                                    />
                                    {formik.touched.confirm_password && formik.errors.confirm_password && (
                                        <p className="mt-2 text-sm text-red-600 flex items-center">
                                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                            {formik.errors.confirm_password}
                                        </p>
                                    )}
                                </div>

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={submitted && passwordStatus == 'success'}
                                    className="w-full bg-sun hover:bg-sunset text-[#333333] font-extrabold py-3.5 px-6 rounded-lg
                                             transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]
                                             shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed
                                             disabled:transform-none text-base uppercase tracking-wide"
                                >
                                    {submitted && passwordStatus == 'success' ? 'Redirecting...' : 'Set New Password'}
                                </button>
                            </form>
                        </div>

                        {/* Additional Info */}
                        <div className="mt-6 text-center">
                            <p className="text-white text-sm font-medium">
                                Need help?{' '}
                                <a href="mailto:support@sargood.com" className="text-sun hover:text-sunset font-bold transition-colors underline">
                                    Contact Support
                                </a>
                            </p>
                        </div>
                    </div>
                )}

                {/* Invalid Token State */}
                {status == 'invalid-token' && (
                    <div className="w-full">
                        {/* Logo Section */}
                        <div className="flex justify-center mb-6">
                            <div className="relative w-48 h-48 drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                                <Image alt="Sargood Logo" layout="fill" objectFit="contain" src={logo.src} />
                            </div>
                        </div>

                        {/* Error Card */}
                        <div className="bg-white rounded-2xl shadow-xl p-8">
                            <div className="text-center">
                                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
                                    <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                
                                <h1 className="text-2xl font-bold text-neutral-darker mb-3">
                                    Link Expired
                                </h1>
                                
                                <p className="text-neutral-dark mb-6">
                                    Sorry, this password reset link has expired or is invalid.
                                </p>

                                <div className="space-y-3">
                                    <Link href="/auth/forgot-password">
                                        <a className="block w-full bg-sun hover:bg-sunset text-[#333333] font-extrabold py-3.5 px-6 rounded-lg
                                                     transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]
                                                     shadow-md hover:shadow-lg text-base uppercase tracking-wide">
                                            Request New Link
                                        </a>
                                    </Link>

                                    <Link href="/auth/login">
                                        <a className="block w-full bg-white hover:bg-neutral-white text-sea font-semibold py-3.5 px-6 rounded-lg
                                                     border-2 border-sea transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]
                                                     text-base">
                                            Back to Login
                                        </a>
                                    </Link>
                                </div>
                            </div>
                        </div>

                        {/* Additional Info */}
                        <div className="mt-6 text-center">
                            <p className="text-white text-sm font-medium">
                                Need help?{' '}
                                <a href="mailto:support@sargood.com" className="text-sun hover:text-sunset font-bold transition-colors underline">
                                    Contact Support
                                </a>
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </FormLayout>
    );
}

export default SetNewPasswordPage;