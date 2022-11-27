import cookies from 'js-cookie';
import { lazy, useEffect } from 'react';
import { Route, Switch, useHistory } from 'react-router-dom';
import AppLeftSideBar from '../../components.ts/AppLeftSideBar';
import './App.css';

const Channel = lazy(() => import('./Channel'));
const Friends = lazy(() => import('./Friends'));

const SupportApplication = () => {
    const history = useHistory();

    useEffect(() => {
        if (!cookies.get('username') || !cookies.get('loggedIn')) return window.location.replace('/login');
    }, []);

    return (
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
