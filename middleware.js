import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/auth/admin-login",
    // signOut: "/auth/logout",
    // error: "/auth/error", // Error code passed in query string as ?error=
    // verifyRequest: "/auth/verify-request", // (used for check email message)
    newUser: "/auth/login", // If set, new users will be directed here on first sign in
    forgotPassword: "/auth/forgot-password",
    signUp: "/external/create-account",
  },
});

export const config = {
  matcher: ['/dashboard/:path*', '/bookings/:path*', '/settings/:path*', '/guests/:path*', '/notifications/:path*', '/assets-management/:path*',
    '/((?!api|api/bookings/enquiry/create|_next/|favicon.ico|external/booking-enquiry|external/create-account|auth/login|auth/forgot-password|auth/onboarding/set-new-password).*)']
}
