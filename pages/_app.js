import { AbilityContext } from './../services/acl/can'
import { ToastContainer } from 'react-toastify';
import '../styles/globals.css'
import 'animate.css';
import 'react-toastify/dist/ReactToastify.css';
import { SessionProvider } from "next-auth/react"
import { store, persistor } from "./../store/index"
import { Provider } from "react-redux"
import { PersistGate } from 'redux-persist/integration/react';
import Head from 'next/head';
import Script from 'next/script';
import { AbilityBuilder, PureAbility } from '@casl/ability';
import { useEffect } from 'react';

function MyApp({ Component, pageProps: session, ...pageProps }) {

  const getLayout = Component.getLayout || ((page) => page)
  const { user } = store.getState();
  const { can, build } = new AbilityBuilder(PureAbility);
  if (user.user && user.user.type == 'user' && user.user.Roles) {
    user.user.Roles.map(role => {
      if (role.name == 'Administrator') {
        can('manage', 'all');
      }
      role.Permissions.map(permission => {
        can(permission.action, permission.subject);
      });
    });
  } else {
    can('Read', 'Booking');
  }

  const ability = build();


  const updateAbility = async (ability) => {

    if (!user.user) return;

    if (user.user.type != 'user') {
      console.log('clearing interval')
      clearInterval(intervalId);
      return;
    }

    if (user.user?.type == 'user') {
      const { can, rules } = new AbilityBuilder(PureAbility);
      console.log('updating ability')
      const response = await fetch("/api/" + user.user.type + "s/by-email/" + user.user.email, {
        method: "POST",
        body: JSON.stringify(user),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const userData = await response.json();
        const updatedUser = structuredClone(user.user);
        updatedUser.Roles = userData.Roles;
        store.dispatch({ type: 'user/updateUser', payload: updatedUser });
        if (userData && userData.Roles) {
          userData.Roles.map(role => {
            if (role.name == 'Administrator') {
              clearInterval(intervalId);
              can('manage', 'all');
            }
            role.Permissions.map(permission => {
              can(permission.action, permission.subject);
            });
          });
        } else {
          can('Read', 'Booking');
        }
        ability.update(rules);
      }
    }
  }

  // let intervalId;
  // intervalId = setInterval(() => {
  //   try {
  //     updateAbility(ability);
  //   }
  //   catch (err) {
  //     console.log(err);
  //     clearInterval(intervalId);
  //   }
  // }, 30000);

  useEffect(() => {
    // <script data-jsd-embedded data-key="3d7bb2cf-8c1b-4f02-9193-0d4983ccde2d" data-base-url="https://jsd-widget.atlassian.com" src="https://jsd-widget.atlassian.com/assets/embed.js"></script>
    if (user.user && user.user != undefined && user.user.type == 'user' && user.user.Roles) {
      console.log('adding script tag')
      const script = document.createElement('script');

      script.src = "https://jsd-widget.atlassian.com/assets/embed.js";
      script.id = 'jiraWidget';
      script.setAttribute('async', true);
      script.setAttribute('data-jsd-embedded', '');
      script.setAttribute('data-key', "3d7bb2cf-8c1b-4f02-9193-0d4983ccde2d");
      script.setAttribute('data-base-url', "https://jsd-widget.atlassian.com");

      document.body.appendChild(script);

      script.addEventListener('load', (event)=>{
        window.document.dispatchEvent(new Event("DOMContentLoaded", {
          bubbles: true,
          cancelable: true
          }));
        }
      )
      return () => {
        document.body.removeChild(script);
      }
    } else {
      console.log('removing script tag')
      const scriptTag = document.querySelectorAll('iframe');
      if (scriptTag.length > 0) {
        scriptTag[0]?.remove();
      }
    }
  }, [user]);

  return (
    <>
      <Head>
        <title>Sargood on Collaroy</title>
        <link rel="icon" href="/favicon.ico" type="image/x-icon" />
        <link rel="shortcut icon" href="/favicon.ico" type="image/x-icon" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700;800&display=swap" rel="stylesheet" />
      </Head>
      <Script strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`} />
      <Script id='google-analytics' strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `window.dataLayer = window.dataLayer || [];
                                function gtag(){dataLayer.push(arguments);}
                                gtag('js', new Date());
                                gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}', {
                                    page_path: window.location.pathname,
                                });
                            `,
        }}
      />
      {getLayout(
        <Provider store={store}>
          <PersistGate loading={null} persistor={persistor}>
            <AbilityContext.Provider value={ability}>
              <SessionProvider session={session}>
                <Component {...pageProps} />
                <ToastContainer
                  position="top-right"
                  autoClose={5000}
                  hideProgressBar={false}
                  newestOnTop={false}
                  closeOnClick
                  rtl={false}
                  pauseOnFocusLoss
                  draggable
                  pauseOnHover
                  theme="light" />
              </SessionProvider>
            </AbilityContext.Provider>
          </PersistGate>
        </Provider>)}
    </>
  )
}

export default MyApp
