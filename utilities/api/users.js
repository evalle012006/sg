export async function getUsers() {

    const response = await fetch('/api/users');

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || 'Something went wrong');
    }

    return data;
}


export async function create(form) {

    const response = await fetch('/api/users/create', {
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

export async function confirmEmail(token) {

    const response = await fetch('/api/users/confirm-email', {
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