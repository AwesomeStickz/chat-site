import cookies from 'js-cookie';
import { lazy, useEffect, useState } from 'react';
import { Route, Switch, useHistory, withRouter } from 'react-router-dom';
import AppLeftSideBar from '../../components.ts/AppLeftSideBar';
import Loader from '../../components.ts/Loader';
import { websiteUtils } from '../../utils/websiteUtils';
import './App.css';

const Channel = lazy(() => import('./Channel'));
const Friends = lazy(() => import('./Friends'));

const App = () => {
    const history = useHistory();

    const [isLoaded, setIsLoaded] = useState(false);
    const [unreadData, setUnreadData] = useState({ pendingFriendRequests: 0, unreadMessages: {} });

    useEffect(() => {
        if (!cookies.get('username') || !cookies.get('loggedIn')) return window.location.replace('/login');

        websiteUtils.connectToWS(setIsLoaded, setUnreadData);
    }, []);

    return !isLoaded ? (
        <Loader />
    ) : (
        <div className='app'>
            <AppLeftSideBar unreadData={unreadData} setUnreadData={setUnreadData} />
            <Switch>
                <Route exact path='/app/channels/:channelID'>
                    <Channel unreadData={unreadData} setUnreadData={setUnreadData} />
                </Route>
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

export default withRouter(App);
