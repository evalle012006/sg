import React from 'react'

import dynamic from 'next/dynamic';
const SignupForm = dynamic(() => import('../../components/auth/signup-form'));
const FormLayout = dynamic(() => import('../../components/formLayout'));

function SignupPage() {
  return (
    <FormLayout>
      <div className="flex items-center w-full">
      <SignupForm />
      </div>
    </FormLayout>
  )
}

export default SignupPage