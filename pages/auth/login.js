import React from "react";
import dynamic from 'next/dynamic';
const SigninForm = dynamic(() => import('../../components/auth/signin-form'));
const FormLayout = dynamic(() => import('../../components/formLayout'));

function SignupPage() {
  return (
    <FormLayout>
      <div className="flex items-center w-full">
        <SigninForm type={"guest"} />
      </div>
    </FormLayout>
  );
}

export default SignupPage;
