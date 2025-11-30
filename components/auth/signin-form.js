import { useFormik } from "formik";
import { useState } from "react";
import * as yup from "yup";
import Image from "next/image";
import Link from "next/link";
import { signIn } from "next-auth/react"
import { useRouter } from 'next/router'
import { useDispatch } from "react-redux";
import { userActions } from "./../../store/userSlice";

import dynamic from 'next/dynamic';
const Alert = dynamic(() => import('../ui/alert'));
const Button = dynamic(() => import('../ui/button'));
const Input = dynamic(() => import('../ui/input'));
const Spinner = dynamic(() => import('../ui/spinner'));
import logo from "/public/sargood-logo-white.svg";


function SigninForm(props) {
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [userType, setUserType] = useState(props.type);
  const dispatch = useDispatch();
  const router = useRouter();
  const { callbackUrl } = router.query;

  const formik = useFormik({
    initialValues: {
      email: "",
      password: "",
    },
    onSubmit: (values) => {
      async function loginForm(form) {
        try {
          setIsLoading(true);
          const response = await signIn('credentials', { ...form, type: userType, redirect: false });

          setIsLoading(false);
          if (response.error || response?.status?.ok == false || response?.status == 401) {
            setFormError("You have entered an invalid username or password.");
          } else {
            setFormError();
            const userResponse = await fetch("/api/" + userType + "s/by-email/" + values.email, {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
              },
            }).then((res) => res.json());

            if (userResponse) {
              const userData = { ...userResponse, type: userType };
              dispatch(userActions.updateUser(userData));
              if (callbackUrl) {
                window.location.href = callbackUrl;
              }
              else if (userData.hasOwnProperty('Roles') && userData.Roles.length > 0 &&
                (userData.Roles[0].Permissions.some(p => p.subject.includes('Dashboard')) ||
                  userData.Roles.some(r => r.name == 'Administrator'))) {
                window.location.href = "/dashboard";
              } else {
                console.log('false logic')
                window.location.href = "/bookings";
              }
            }
          }
        } catch (e) {
          setIsLoading(false);
          setFormError('Something went wrong. Please try again.');
          console.log(e);
        }
      }
      loginForm(values);
    },
    validationSchema: yup.object({
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
          {userType == 'user' ? 'Administrator' : 'Guest'} Login
        </h1>
        <p className="text-neutral-dark text-center mb-6">
          Welcome back! Please sign in to continue
        </p>

        {/* Loading/Error State */}
        {isLoading ? (
          <div className="py-4">
            <Spinner />
          </div>
        ) : formError ? (
          <div className="mb-4">
            <Alert color="bg-red-500">{formError}</Alert>
          </div>
        ) : null}

        {/* Form */}
        <form onSubmit={formik.handleSubmit} className="space-y-5">
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
              placeholder="Enter your password"
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
                     disabled:transform-none text-base uppercase tracking-wide"
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
          </button>

          {/* Forgot Password Link */}
          <div className="text-center pt-2">
            <Link href={`/auth/forgot-password?userType=${userType}`}>
              <span className="text-sea hover:text-blend-darker font-semibold text-sm 
                             cursor-pointer transition-colors duration-200 inline-block
                             hover:underline decoration-2 underline-offset-2">
                Forgot your password?
              </span>
            </Link>
          </div>
        </form>
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

export default SigninForm;