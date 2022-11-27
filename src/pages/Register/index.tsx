import cookies from 'js-cookie';
import { useEffect, useState } from 'react';
import superagent from 'superagent';
import './Register.css';

const Register = () => {
    const [username, setUsername] = useState(cookies.get('username') || '');

    useEffect(() => {
        if (!cookies.get('username')) return window.location.replace('/login');
        if (cookies.get('loggedIn')) return window.location.replace('/app');
    }, []);

    return (
        <div className='register'>
            <div className='register-main'>
                <div className='register-header'>
                    <p>Complete Registration</p>
                </div>
                <div className='register-body'>
                    <input type='text' value={username} onChange={(e) => setUsername(e.target.value)} />
                    <button
                        onClick={async () => {
                            const status = (await superagent.post(`/api/register`).send({ username: username })).status;

                            if (status == 200) window.location.replace('/app');
                        }}
                    >
                        Register
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Register;
