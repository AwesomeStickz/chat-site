import { lazy } from 'react';
import { Route, Switch, useHistory, withRouter } from 'react-router-dom';

const Call = lazy(() => import('./Call'));
const Messages = lazy(() => import('./Messages'));

const Channel = (props: any) => {
    const history = useHistory();

    return (
        <Switch>
            <Route exact path='/app/channels/:channelID'>
                <Messages unreadData={props.unreadData} setUnreadData={props.setUnreadData} />
            </Route>
            <Route exact component={Call} path='/app/channels/:channelID/call' />
            <Route
                render={() => {
                    history.push('/404');
                    return true;
                }}
            />
        </Switch>
    );
};

export default withRouter(Channel);
