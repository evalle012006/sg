import React, { useState, useEffect } from "react";
import { useFormik } from "formik";
import * as yup from "yup";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";

import dynamic from "next/dynamic";
const Alert = dynamic(() => import("../ui/alert"));
const Spinner = dynamic(() => import("../ui/spinner"));
import logo from "/public/sargood-logo-white.svg";

function SignupForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const router = useRouter();

  const formik = useFormik({
    initialValues: {
      first_name: "",
      last_name: "",
      phone_number: "",
      email: "",
      password: "",
    },
    onSubmit: (values) => {
      async function signupForm(form) {
        try {
          setIsLoading(true);
          const response = await fetch("/api/guests", {
            method: "POST",
            body: JSON.stringify(form),
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (response.status == 200) {
            setIsSuccess(true);
            setFormError("");
          } else {
            const resBody = await response.json();
            setFormError(resBody?.error || "Registration failed. Please try again.");
          }
        } catch (e) {
          console.log(e);
          setFormError("Something went wrong. Please try again.");
        } finally {
          setIsLoading(false);
        }
      }
      signupForm(values);
    },
    validationSchema: yup.object({
      first_name: yup.string().required("First name is required"),
      last_name: yup.string().required("Last name is required"),
      phone_number: yup
        .string()
        .required("Phone number is required")
        .matches(/^[0-9]+$/, "Must be only digits")
        .min(10, "Must be at least 10 digits")
        .max(15, "Must be at most 15 digits"),
      email: yup
        .string()
        .email("Must be a valid email")
        .required("Email is required"),
      password: yup
        .string()
        .required("Password is required")
        .min(6, "Password is too short - should be 6 chars minimum"),
    }),
  });

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Logo Section with enhanced visibility */}
      <div className="flex justify-center mb-6">
        <div className="relative w-48 h-48 drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">
          <Image alt="Sargood Logo" layout="fill" objectFit="contain" src={logo.src} />
        </div>
      </div>

      {/* Form Card with White Background */}
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-3xl font-bold text-sea mb-2 text-center">
          Create Your Account
        </h1>
        <p className="text-neutral-dark text-center mb-6">
          Join us to manage your bookings and stays
        </p>

        {/* Loading/Success/Error State */}
        {isLoading ? (
          <div className="py-4">
            <Spinner />
          </div>
        ) : (
          <>
            {isSuccess && (
              <div className="mb-4">
                <Alert color="bg-green-500">
                  Successfully Registered! Please check your email to verify your account.
                </Alert>
              </div>
            )}
            {formError && (
              <div className="mb-4">
                <Alert color="bg-red-500">{formError}</Alert>
              </div>
            )}
          </>
        )}

        {/* Form */}
        {!isSuccess && (
          <form onSubmit={formik.handleSubmit} className="space-y-4">
            {/* First Name Field */}
            <div>
              <label
                htmlFor="first_name"
                className="block text-sm font-semibold text-neutral-darker mb-2"
              >
                First Name
              </label>
              <input
                id="first_name"
                name="first_name"
                type="text"
                value={formik.values.first_name}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="w-full px-4 py-3 text-base border-2 border-neutral-light rounded-lg
                         focus:outline-none focus:border-sea focus:ring-2 focus:ring-sea/20
                         transition-all duration-200 bg-white text-neutral-darker
                         placeholder:text-neutral"
                placeholder="Enter your first name"
              />
              {formik.touched.first_name && formik.errors.first_name && (
                <p className="mt-2 text-sm text-red-600 flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {formik.errors.first_name}
                </p>
              )}
            </div>

            {/* Last Name Field */}
            <div>
              <label
                htmlFor="last_name"
                className="block text-sm font-semibold text-neutral-darker mb-2"
              >
                Last Name
              </label>
              <input
                id="last_name"
                name="last_name"
                type="text"
                value={formik.values.last_name}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="w-full px-4 py-3 text-base border-2 border-neutral-light rounded-lg
                         focus:outline-none focus:border-sea focus:ring-2 focus:ring-sea/20
                         transition-all duration-200 bg-white text-neutral-darker
                         placeholder:text-neutral"
                placeholder="Enter your last name"
              />
              {formik.touched.last_name && formik.errors.last_name && (
                <p className="mt-2 text-sm text-red-600 flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {formik.errors.last_name}
                </p>
              )}
            </div>

            {/* Phone Number Field */}
            <div>
              <label
                htmlFor="phone_number"
                className="block text-sm font-semibold text-neutral-darker mb-2"
              >
                Phone Number
              </label>
              <input
                id="phone_number"
                name="phone_number"
                type="tel"
                value={formik.values.phone_number}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="w-full px-4 py-3 text-base border-2 border-neutral-light rounded-lg
                         focus:outline-none focus:border-sea focus:ring-2 focus:ring-sea/20
                         transition-all duration-200 bg-white text-neutral-darker
                         placeholder:text-neutral"
                placeholder="Enter your phone number"
              />
              {formik.touched.phone_number && formik.errors.phone_number && (
                <p className="mt-2 text-sm text-red-600 flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {formik.errors.phone_number}
                </p>
              )}
            </div>

            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-neutral-darker mb-2"
              >
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formik.values.email}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="w-full px-4 py-3 text-base border-2 border-neutral-light rounded-lg
                         focus:outline-none focus:border-sea focus:ring-2 focus:ring-sea/20
                         transition-all duration-200 bg-white text-neutral-darker
                         placeholder:text-neutral"
                placeholder="Enter your email"
              />
              {formik.touched.email && formik.errors.email && (
                <p className="mt-2 text-sm text-red-600 flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {formik.errors.email}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-neutral-darker mb-2"
              >
                Password
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
                placeholder="Create a password (min 6 characters)"
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

            {/* Submit Button - Enhanced contrast */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-sun hover:bg-sunset text-[#333333] font-extrabold py-3.5 px-6 rounded-lg
                       transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]
                       shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed
                       disabled:transform-none text-base uppercase tracking-wide mt-2"
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </button>

            {/* Login Link */}
            <div className="text-center pt-4">
              <p className="text-neutral-dark text-sm">
                Already have an account?{' '}
                <Link href="/auth/login">
                  <span className="text-sea hover:text-blend-darker font-semibold 
                               cursor-pointer transition-colors duration-200 inline-block
                               hover:underline decoration-2 underline-offset-2">
                    Sign In
                  </span>
                </Link>
              </p>
            </div>
          </form>
        )}

        {/* Success State - Show Login Button */}
        {isSuccess && (
          <div className="text-center pt-4">
            <Link href="/auth/login">
              <button
                className="w-full bg-sea hover:bg-blend-darker text-white font-bold py-3.5 px-6 rounded-lg
                         transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]
                         shadow-md hover:shadow-lg text-base uppercase tracking-wide"
              >
                Go to Login
              </button>
            </Link>
          </div>
        )}
      </div>

      {/* Additional Info - Enhanced visibility */}
      <div className="mt-6 text-center">
        <p className="text-white text-sm font-medium">
          Need help?{' '}
          <a href="mailto:support@sargood.com" className="text-sun hover:text-sunset font-bold transition-colors underline">
            Contact Support
          </a>
        </p>
      </div>
    </div>
  );
}

export default SignupForm;