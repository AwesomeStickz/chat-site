import cookies from 'js-cookie';
import { useEffect, useLayoutEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import superagent from 'superagent';
import { constants } from '../../utils/constants';
import { Channel } from '../../utils/interfaces';
import { websiteUtils, wsMessageListeners } from '../../utils/websiteUtils';
import { WebSocketEvent, WebSocketOP } from '../../utils/websocketEvents';
import './AppLeftSideBar.css';

const getUnreadNumber = (num: number) => (num > 99 ? '99+' : num);

const AppLeftSideBar = (props: any) => {
    const history = useHistory();

    const [channels, setChannels] = useState<Channel[]>([]);
    const [unreadMessagesInEachChannelCount, setUnreadMessagesInEachChannelCount] = useState({} as { [key: string]: number });
    const [pendingFriendRequestsCount, setPendingFriendRequestsCount] = useState(0);

    const [wsMessageListenerID, setWSMessageListenerID] = useState('');

    useEffect(() => {
        (async () => {
            const channels = (await superagent.get(`/api/channels`)).body;

            setPendingFriendRequestsCount(props.unreadData.pendingFriendRequests || 0);
            setUnreadMessagesInEachChannelCount(props.unreadData.unreadMessages);

            setChannels(channels);

            const id = websiteUtils.attachMessageListenerToWS((message: WebSocketEvent) => {
                const currentUserID = cookies.get('id');

                if (message.op === WebSocketOP.CHANNEL_CREATE) setChannels((channels) => [...channels, message.d]);
                else if (message.op === WebSocketOP.FRIEND_REQ_SEND) {
                    if (message.d.receiver.id === currentUserID) {
                        setPendingFriendRequestsCount((count) => count + 1);

                        props.setUnreadData((unreadData: any) => ({ ...unreadData, pendingFriendRequests: unreadData.pendingFriendRequests + 1 }));
                    }
                } else if (message.op === WebSocketOP.FRIEND_REQ_ACCEPT) {
                    if (currentUserID !== message.d.receiver.id) {
                        setPendingFriendRequestsCount((pendingFriendRequestsCount) => pendingFriendRequestsCount - 1);

                        props.setUnreadData((unreadData: any) => {
                            unreadData.pendingFriendRequests = unreadData.pendingFriendRequests - 1;

                            return unreadData;
                        });
                    }
                } else if (message.op === WebSocketOP.FRIEND_REQ_DELETE || message.op === WebSocketOP.FRIEND_REQ_REJECT) {
                    if (currentUserID !== message.d.receiver.id) {
                        setPendingFriendRequestsCount((pendingFriendRequestsCount) => pendingFriendRequestsCount - 1);

                        props.setUnreadData((unreadData: any) => {
                            unreadData.pendingFriendRequests = unreadData.pendingFriendRequests - 1;

                            return unreadData;
                        });
                    }
                } else if (message.op === WebSocketOP.MESSAGE_CREATE) {
                    if (currentUserID !== message.d.authorID) {
                        props.setUnreadData((unreadData: any) => {
                            const unreadMessagesInChannel = Number(unreadData.unreadMessages[message.d.channelID]) || 0;

                            const numberToAdd = window.location.href.endsWith(`/channels/${message.d.channelID}`) ? 0 : 1;

                            unreadData.unreadMessages[message.d.channelID] = unreadMessagesInChannel + numberToAdd;

                            setUnreadMessagesInEachChannelCount((unreadMessagesInEachChannelCount) => ({ ...unreadMessagesInEachChannelCount, [message.d.channelID]: String(unreadMessagesInChannel + numberToAdd) }));

                            return unreadData;
                        });
                    }
                } else if (message.op === WebSocketOP.ACK_MESSAGES_RECEIVED) {
                    props.setUnreadData((unreadData: any) => {
                        unreadData.unreadMessages[message.d.channelID] = 0;

                        setUnreadMessagesInEachChannelCount((unreadMessagesInEachChannelCount) => ({ ...unreadMessagesInEachChannelCount, [message.d.channelID]: '0' }));

                        return unreadData;
                    });
                }
            });

            setWSMessageListenerID(id);
        })();
    }, []);

    useLayoutEffect(() => {
        return () => {
            wsMessageListeners.delete(wsMessageListenerID);
        };
    }, []);

    return (
        <div className='app-left-sidebar'>
            <div className='app-left-sidebar-friends' onClick={() => history.push('/app/friends')}>
                <img src='/assets/friends-icon.png' />
                <p>Friends</p>
                {pendingFriendRequestsCount > 0 && <div className='unread-div'>{getUnreadNumber(pendingFriendRequestsCount)}</div>}
            </div>
            <hr />
            <div className='app-left-sidebar-friends'>
                <svg style={{ height: '20px', marginLeft: '30px', marginRight: '-10px', scale: '1.5', width: '45px' }}>
                    <path d={constants.svgs.icons.message} fill='white' />
                </svg>
                <p>Chats</p>
            </div>
            <div>
                {channels
                    .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
                    .map((channel, index) => {
                        return (
                            <div className='friend-details' onClick={() => history.push(`/app/channels/${channel.id}`)} key={index}>
                                <img src={channel.icon} alt='profile pic' referrerPolicy='no-referrer' />
                                <p>{channel.name}</p>
                                {unreadMessagesInEachChannelCount[channel.id] > 0 && <div className='unread-div'>{getUnreadNumber(unreadMessagesInEachChannelCount[channel.id])}</div>}
                            </div>
                        );
                    })}
            </div>
        </div>
    );
};

export default AppLeftSideBar;
