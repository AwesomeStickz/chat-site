import cookies from 'js-cookie';
import { useEffect } from 'react';
import { constants } from '../../utils/constants';
import './Login.css';

const Login = () => {
    useEffect(() => {
        if (cookies.get('loggedIn') && cookies.get('username')) return window.location.replace('/app');
    }, []);

    return (
        <div className='login'>
            <div className='login-main'>
                <div className='login-header'>
                    <p>Welcome Back!</p>
                </div>
                <div className='login-google-acc btn-transition' onClick={() => window.location.replace(`${constants.backendBaseURL}/oauth/google`)}>
                    <img src='/assets/google-logo.svg' alt='google logo' />
                    <p>Login With Google</p>
                </div>
            </div>
        </div>
    );
};

export default Login;
