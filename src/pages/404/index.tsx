import { useHistory } from 'react-router-dom';
import './404.css';

const E404 = () => {
    const history = useHistory();

    return (
        <div className='E404'>
            <h1>
                Oops.. It's a 404<br></br>AKA Page Not Found
            </h1>
            <button className='E404-btn btn-transition' onClick={() => history.push('/')}>
                Take me to home
            </button>
        </div>
    );
};

export default E404;
