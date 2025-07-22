import { Guest, User } from "../../models";
import { verifyPassword } from "../../utilities/authentication";

export async function confirmEmail(token) {

  const response = await fetch(process.env.APP_URL + '/api/auth/confirm-email', {
    method: 'POST',
    body: JSON.stringify({ token: token }),
    headers: {
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong');
  }

  return data;
}

export async function login(form) {

  const { email, password, type } = form;
  let user;
  if (type === 'guest') {
    user = await Guest.findOne({
      where: {
        email: email,
      },
    });
  } else {
    user = await User.findOne({
      where: {
        email: email,
      },
    });
  }
  if (user == null || user.length === 0) {
    return null;
  }

  if (type === 'guest' && !user.active) {
    throw new Error('Your account has been deactivated. Please contact support.');
  }

  const verify = await verifyPassword(password, user.password);
  if (!verify) {
    return null;
  }
  return user;

}

export async function signup(form) {

  const response = await fetch('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(form),
    headers: {
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong');
  }

  return data;
}
