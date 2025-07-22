import { useFormik } from "formik";
import { useContext, useState } from "react";
import * as yup from "yup";
import Image from "next/image";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react"
import { useRouter } from 'next/router'
import { useDispatch } from "react-redux";
import { userActions } from "./../../store/userSlice";

import dynamic from 'next/dynamic';
const Alert = dynamic(() => import('../ui/alert'));
const Button = dynamic(() => import('../ui/button'));
const Input = dynamic(() => import('../ui/input'));
const Spinner = dynamic(() => import('../ui/spinner'));
import logo from "/public/sargood-logo.svg";


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
      <div className="flex justify-center m-4">
        <Image alt="logo" width={170} height={170} src={logo.src} />
      </div>
      <div className="flex justify-center">
        {/* <p className="text-center mb-2 text-sky-900">
          Register for your Sargood Guest Account to enable you to manage your
          details for current and future stays with us
        </p> */}
      </div>
      <form
        onSubmit={formik.handleSubmit}
        className="p-4">
        <h1 className="mb-4 text-2xl font-bold text-gray-800">
          {userType == 'user' && 'Administrator'} Login
        </h1>
        {isLoading ? (
          <Spinner />
        ) : formError ? (
          <Alert color={`bg-red-500`}>{formError}</Alert>
        ) : null}
        <Input
          name="email"
          label={"Email"}
          type={"email"}
          value={formik.values.email}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.errors.email}
        />
        <Input
          name="password"
          label={"Password"}
          type={"password"}
          value={formik.values.password}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.errors.password}
        />
        <Button
          buttonClass={"my-2 bg-yellow-400 hover:bg-sky-900 hover:text-white"}
          label={"Sign in"}
          submit
        />

        <Link href={`/auth/forgot-password?userType=${userType}`}>
          <span className="cursor-pointer block text-sargood-blue decoration-2 hover:underline font-medium">
            Forgot Password
          </span>
        </Link>
      </form>
    </div>
  );
}

export default SigninForm;
