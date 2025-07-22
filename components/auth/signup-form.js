import { useFormik } from "formik";
import { useState } from "react";
import * as yup from "yup";
import Link from "next/link";
import Router from "next/router";
import { signup } from "../../utilities/api/authentication";
import Alert from "../ui/alert";
import Button from "../ui/button";
import Input from "../ui/input";
import Spinner from "../ui/spinner";
import Image from "next/image";
import logo from "/public/sargood-logo.svg";

function SignupForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formError, setFormError] = useState("");

  const formik = useFormik({
    initialValues: {
      email: "",
      first_name: "",
      last_name: "",
      phone_number: "",
      password: "",
    },
    onSubmit: (values) => {
      async function registerForm(form) {
        try {
          setIsLoading(true);
          const result = await signup(form);
          if (result) {
            setIsLoading(false);
            setIsSuccess(true);
          }
        } catch (e) {
          setIsLoading(false);
          setFormError(e.message);
          console.log(e);
        }
      }
      registerForm(values);
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
          /^(\+?\d{0,4})?\s?-?\s?(\(?\d{3}\)?)\s?-?\s?(\(?\d{3}\)?)\s?-?\s?(\(?\d{4}\)?)?$/,
          "Invalid phone number"
        ),

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
    <>
      <div className="rounded-xl w-full max-w-md mx-auto">
        {isLoading ? (
          <Spinner />
        ) : (
          (isSuccess ||
            formError) && (
            <Alert color={`${formError ? "bg-red-500" : "bg-green-500"}`}>
              {formError ? formError : isSuccess && "Successfully Registered! Please check your email."}
            </Alert>
          )
        )}
        <div className="m-4">
          <div className="flex justify-center">
            <div className="relative w-40 h-40">
              <Image alt="logo" layout="fill" objectFit="contain" src={logo.src} />
            </div>
          </div>
          <h1 className="my-4 text-2xl font-bold text-gray-800">
            Sign up
          </h1>
          <form onSubmit={formik.handleSubmit}>
            <Input
              name="first_name"
              label={"First Name"}
              type={"text"}
              value={formik.values.first_name}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.errors.first_name}
            />
            <Input
              name="last_name"
              label={"Last Name"}
              type={"text"}
              value={formik.values.last_name}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.errors.last_name}
            />
            <Input
              name="phone_number"
              label={"Phone Number"}
              type={"text"}
              value={formik.values.phone_number}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.errors.phone_number}
            />
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
              label={"Sign up"}
              submit
            />
            <Link href="/auth/login">
              <span className="cursor-pointer block text-sargood-blue decoration-2 hover:underline font-medium">
                Already a Member ? Login
              </span>
            </Link>
          </form>
        </div>
      </div>
    </>
  );
}

export default SignupForm;
