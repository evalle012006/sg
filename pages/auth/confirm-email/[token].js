import React, { useEffect, useState } from "react";
import Link from 'next/link';
import { useRouter } from "next/router";
import { confirmEmail } from "../../../utilities/api/authentication";
import Image from "next/image";

import dynamic from 'next/dynamic';
const Spinner = dynamic(() => import('../../../components/ui/spinner'));

function EmailConfirm() {
  const router = useRouter();
  const { token } = router.query;
  const [isVerified, setIsVerified] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function verifyToken(token) {
      setLoading(true);
      try {
        const result = await confirmEmail(token);
        setIsVerified(result);
        setLoading(false);
      } catch (e) {
        setError(e.message);
        // setError("Invalid Token");
        console.log(e);
        setLoading(false);
      }
    }
    verifyToken(token);
  }, [token]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  } else {
    return (
      <div className="flex items-center justify-center h-screen w-full border-red-200 border">
        <div className="flex flex-col justify-center pt-4 px-4 lg:w-1/3 w-full">
          <div>
          <h1
            className={`${
              Object.entries(isVerified).length !== 0 ? "text-green-500" : "text-red-500"
            } text-center text-3xl mb-2`}
          >
            {Object.entries(isVerified).length !== 0 ? "Email Verified!":  error ? error   : null}
          </h1>
          </div>
          {
            Object.entries(isVerified).length !== 0 && <div>
            <p className="font-bold text-lg text-center text-sky-700">
              <Link href="/login">
                Click Here to Login
              </Link>
              </p>
            </div>
          }
          <Image
            src="/email.svg"
            width={450}
            height={300}
            alt={"email-verification"}
          />
        </div>
      </div>
    );
  }
}

export default EmailConfirm;
