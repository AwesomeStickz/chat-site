import cookies from 'js-cookie';
import { lazy, useEffect, useState } from 'react';
import { Route, Switch, useHistory, withRouter } from 'react-router-dom';
import AppLeftSideBar from '../../components.ts/AppLeftSideBar';
import Loader from '../../components.ts/Loader';
import { websiteUtils } from '../../utils/websiteUtils';
import { WebSocketEvent, WebSocketOP } from '../../utils/websocketEvents';
import './App.css';

const Channel = lazy(() => import('./Channel'));
const Friends = lazy(() => import('./Friends'));

const App = () => {
    const history = useHistory();

    const [isLoaded, setIsLoaded] = useState(false);
    const [unreadData, setUnreadData] = useState({ pendingFriendRequests: 0, unreadMessages: {} });
    const [displayCallDivType, setDisplayCallDivType] = useState('');
    const [callData, setCallData] = useState({ channelID: '', username: '', type: '' });

    useEffect(() => {
        if (!cookies.get('username') || !cookies.get('loggedIn')) return window.location.replace('/login');

        websiteUtils.connectToWS(setIsLoaded, setUnreadData);

        websiteUtils.attachMessageListenerToWS((message: WebSocketEvent) => {
            if (message.op === WebSocketOP.CALL_CREATE) {
                setDisplayCallDivType('incoming');
                setCallData(message.d);
            } else if (message.op === WebSocketOP.CALL_ACK) {
                setDisplayCallDivType('outgoing');
                setCallData(message.d);
            } else if (message.op === WebSocketOP.CALL_END || message.op === WebSocketOP.CALL_REJECT) {
                setDisplayCallDivType('');
                setCallData({ channelID: '', username: '', type: '' });
            } else if (message.op === WebSocketOP.CALL_ACCEPT) {
                setDisplayCallDivType('');
                setCallData({ channelID: '', username: '', type: '' });

                setTimeout(() => history.push(`/app/channels/${message.d.channelID}/call?type=${message.d.type}`), 2500);
            }
        });
    }, []);

    return !isLoaded ? (
        <Loader />
    ) : (
        <div className='app'>
            <AppLeftSideBar unreadData={unreadData} setUnreadData={setUnreadData} />
            <Switch>
                <Route path='/app/channels/:channelID'>
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
            {displayCallDivType === 'incoming' && (
                <div className='group-create-div'>
                    <div>
                        <h3>Incoming Call From {callData.username}!</h3>
                        <div>
                            <button
                                className='group-create-cancel-btn'
                                onClick={() => {
                                    websiteUtils.sendMessageToWS({ op: WebSocketOP.CALL_REJECT, d: { channelID: callData.channelID } });

                                    setDisplayCallDivType('');
                                    setCallData({ channelID: '', username: '', type: '' });
                                }}
                            >
                                Reject
                            </button>
                            <button
                                onClick={async () => {
                                    websiteUtils.sendMessageToWS({ op: WebSocketOP.CALL_ACCEPT, d: { channelID: callData.channelID, type: callData.type } });

                                    setDisplayCallDivType('');
                                    setCallData({ channelID: '', username: '', type: '' });

                                    history.push(`/app/channels/${callData.channelID}/call?type=${callData.type}`);
                                }}
                            >
                                Accept
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {displayCallDivType === 'outgoing' && (
                <div className='group-create-div'>
                    <div>
                        <h3>Calling {callData.username}!</h3>
                        <div>
                            <button className='group-create-cancel-btn' onClick={() => websiteUtils.sendMessageToWS({ op: WebSocketOP.CALL_END, d: { channelID: callData.channelID } })}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default withRouter(App);
