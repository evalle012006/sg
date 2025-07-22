import '@testing-library/jest-dom';
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import SigninForm from "@/components/auth/signin-form";
import { SessionProvider } from "next-auth/react";
require('node-fetch');
import { store } from "./../../store";
import { Formik, useFormik } from 'formik';

const session = {
    user: {
        name: "Test User",
        email: "<EMAIL>",
        image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
        emailVerified: true,
        sub: "test-user",
        admin: true,
        provider: "email",
        createdAt: "2021-05-12T19:10:18.337Z",
        updatedAt: "2021-05-12T19:10:18.337Z",
        __typename: "User",
        type: "user"
    }
}


describe("SigninForm", () => {
    it("renders email and password inputs", async () => {
        render(
            <SessionProvider session={session}>
                <Provider store={store}>
                    <SigninForm />
                </Provider>
            </SessionProvider>
        );
        await waitFor(() => {
            expect(screen.getByLabelText("Email")).toBeInTheDocument();
            expect(screen.getByLabelText("Password")).toBeInTheDocument();
        });
    });

    it("displays error for invalid email", async () => {
        render(
            <SessionProvider session={session}>
                <Provider store={store}>
                    <SigninForm />
                </Provider>
            </SessionProvider>
        );
        const emailInput = screen.getByLabelText("Email");
        await userEvent.type(emailInput, "invalid");
        expect(screen.getByText("Must be a valid email")).toBeInTheDocument();
    });

    it("displays error for blank password", async () => {
        render(
            <SessionProvider session={session}>
                <Provider store={store}>
                    <SigninForm />
                </Provider>
            </SessionProvider>
        );
        const submitBtn = screen.getByRole("button", { name: "Sign in" });
        await userEvent.click(submitBtn);
        await waitFor(() => {
            expect(screen.getByText("Password is required")).toBeInTheDocument();
        });
    });

    // TODO --->
    // it('calls loginForm on form submit', async () => {

    //     // submit the form and except the private function loginForm to be called once
    //     jest.mock('formik', () => {
    //         useFormik: () => ({
    //             values: {
    //                 email: "test@example.com",
    //                 password: "<PASSWORD>"
    //             },
    //             handleSubmit: () => {
    //                 loginForm = jest.fn();
    //             }
    //         });
    //     });

    //     render(
    //         <SessionProvider session={session}>
    //             <Provider store={store}>
    //                 <SigninForm />
    //             </Provider>
    //         </SessionProvider>
    //     );

    //     const emailInput = screen.getByLabelText("Email");
    //     const passwordInput = screen.getByLabelText("Password");
    //     const submitBtn = screen.getByRole("button", { name: "Sign in" });
    //     await userEvent.type(emailInput, "test@example.com");
    //     await userEvent.type(passwordInput, "TestPassword@232");
    //     await userEvent.click(submitBtn);
    //     await waitFor(() => {
    //         expect(loginForm).toHaveBeenCalledTimes(1);
    //     });
    //     expect(loginForm).toHaveBeenCalledWith({
    //         email: "test@example.com",
    //         password: "TestPassword@232",
    //         type: "user"
    //     });

    // })
});
