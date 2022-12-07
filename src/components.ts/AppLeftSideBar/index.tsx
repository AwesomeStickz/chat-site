import cookies from 'js-cookie';
import { useEffect, useLayoutEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import superagent from 'superagent';
import { constants } from '../../utils/constants';
import { Channel, User } from '../../utils/interfaces';
import { websiteUtils, wsMessageListeners } from '../../utils/websiteUtils';
import { WebSocketEvent, WebSocketOP } from '../../utils/websocketEvents';
import './AppLeftSideBar.css';

const getUnreadNumber = (num: number) => (num > 99 ? '99+' : num);

const AppLeftSideBar = (props: any) => {
    const history = useHistory();

    const [channels, setChannels] = useState([] as Channel[]);
    const [friends, setFriends] = useState([] as User[]);

    const [unreadMessagesInEachChannelCount, setUnreadMessagesInEachChannelCount] = useState({} as { [key: string]: number });
    const [pendingFriendRequestsCount, setPendingFriendRequestsCount] = useState(0);

    const [wsMessageListenerID, setWSMessageListenerID] = useState('');

    const [displayGroupCreateMenu, setDisplayGroupCreateMenu] = useState(false);
    const [groupFriendSearchText, setGroupFriendSearchText] = useState('');
    const [newGroupMembers, setNewGroupMembers] = useState([cookies.get('id')] as string[]);

    useEffect(() => {
        (async () => {
            const channels = (await superagent.get(`/api/channels`)).body;
            const friends = (await superagent.get(`/api/friends`)).body;

            setPendingFriendRequestsCount(props.unreadData.pendingFriendRequests || 0);
            setUnreadMessagesInEachChannelCount(props.unreadData.unreadMessages);

            setChannels(channels);
            setFriends(friends.friends);

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
                    setChannels((channels) => {
                        const channel = channels.find((channel) => channel.id === message.d.channelID);
                        if (channel) channel.lastActiveAt = Date.now();

                        return channels;
                    });

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
                } else if (message.op === WebSocketOP.CHANNEL_MEMBER_REMOVE) {
                    if (message.d.removedMemberID === currentUserID) setChannels((channels) => channels.filter((channel) => channel.id !== message.d.channelID));
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
        <>
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
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '22px',
                            width: '100%',
                            paddingLeft: '12px',
                        }}
                    >
                        <p>Chats</p>
                        <p style={{ marginRight: '10px' }} onClick={() => setDisplayGroupCreateMenu(true)}>
                            +
                        </p>
                    </div>
                </div>
                <div style={{ paddingLeft: '20px' }}>
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
            {displayGroupCreateMenu && (
                <div className='group-create-div'>
                    <div>
                        <h1>Create Group</h1>
                        <input type='text' placeholder='Search For Friends' onChange={(e) => setGroupFriendSearchText(e.target.value)} />
                        <div className='group-create-friends'>
                            {friends
                                .filter((friend) => friend.username.toLowerCase().includes(groupFriendSearchText.toLowerCase()))
                                .map((friend) => (
                                    <>
                                        <div
                                            onClick={() => {
                                                document.getElementById(`add-group-member-${friend.id}`)!.click();

                                                setNewGroupMembers((newGroupMembers) => {
                                                    if (newGroupMembers.includes(friend.id)) return newGroupMembers;
                                                    else return [...newGroupMembers, friend.id];
                                                });
                                            }}
                                        >
                                            <div className='friend-details'>
                                                <img src={friend.avatar} />
                                                <p>{friend.username}</p>
                                            </div>
                                            <input id={`add-group-member-${friend.id}`} type='checkbox' />
                                        </div>
                                    </>
                                ))}
                        </div>
                        <div>
                            <button className='group-create-cancel-btn' onClick={() => setDisplayGroupCreateMenu(false)}>
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    await superagent.post('/api/channels').send({ users: newGroupMembers, type: 'group' });

                                    setDisplayGroupCreateMenu(false);
                                }}
                            >
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AppLeftSideBar;
