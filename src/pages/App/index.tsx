import cookies from 'js-cookie';
import { lazy, useEffect, useState } from 'react';
import { Route, Switch, useHistory } from 'react-router-dom';
import AppLeftSideBar from '../../components.ts/AppLeftSideBar';
import Loader from '../../components.ts/Loader';
import { websiteUtils } from '../../utils/websiteUtils';
import './App.css';

const Channel = lazy(() => import('./Channel'));
const Friends = lazy(() => import('./Friends'));

const SupportApplication = () => {
    const history = useHistory();

    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        if (!cookies.get('username') || !cookies.get('loggedIn')) return window.location.replace('/login');

        websiteUtils.connectToWS(setIsLoaded);
    }, []);

    return !isLoaded ? (
        <Loader />
    ) : (
        <div className='app'>
            <AppLeftSideBar />
            <Switch>
                <Route exact component={Channel} path='/app/channels/:channelID' />
                <Route exact component={Friends} path={['/app', '/app/friends']} />
                <Route
                    render={() => {
                        history.push('/404');
                        return true;
                    }}
                />
            </Switch>
        </div>
    );
};

export default SupportApplication;
