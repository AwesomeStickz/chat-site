import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import superagent from 'superagent';
import { constants } from '../../utils/constants';
import { Channel } from '../../utils/interfaces';
import { websiteUtils } from '../../utils/websiteUtils';
import { WebSocketEvent, WebSocketOP } from '../../utils/websocketEvents';
import './AppLeftSideBar.css';

const AppLeftSideBar = () => {
    const history = useHistory();

    const [channels, setChannels] = useState<Channel[]>([]);
    const [unreadMessagesInEachChannelCount, setUnreadMessagesInEachChannelCount] = useState({} as { [key: string]: number });
    const [pendingFriendRequestsCount, setPendingFriendRequestsCount] = useState(0);

    useEffect(() => {
        (async () => {
            const channels = (await superagent.get(`/api/channels`)).body;

            websiteUtils.attachMessageListenerToWS(window.location.href, (message: WebSocketEvent) => {
                console.log(message.d);

                if (message.op === WebSocketOP.HELLO) {
                    setPendingFriendRequestsCount(message.d.pendingFriendRequests || 0);
                    setUnreadMessagesInEachChannelCount(message.d.unreadMessages);
                }
            });

            setChannels(channels);
        })();
    }, []);

    return (
        <div className='app-left-sidebar'>
            <div className='app-left-sidebar-friends' onClick={() => history.push('/app/friends')}>
                <img src='/assets/friends-icon.png' />
                <p>Friends</p>
                {pendingFriendRequestsCount > 0 && <div className='pending-friend-req-count'>{pendingFriendRequestsCount}</div>}
            </div>
            <hr />
            <div className='app-left-sidebar-friends'>
                <svg style={{ height: '20px', marginLeft: '30px', marginRight: '-10px', scale: '1.5', width: '45px' }}>
                    <path d={constants.svgs.icons.message} fill='white' />
                </svg>
                <p>Chats</p>
            </div>
            <div>
                {channels.map((channel) => {
                    return (
                        <div className='friend-details' onClick={() => history.push(`/app/channels/${channel.id}`)}>
                            <img src={channel.icon} alt='profile pic' referrerPolicy='no-referrer' />
                            <p>{channel.name}</p>
                            {unreadMessagesInEachChannelCount[channel.id] > 0 && <div className='unread-messages-count'>{unreadMessagesInEachChannelCount[channel.id]}</div>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AppLeftSideBar;
