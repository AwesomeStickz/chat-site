import cookies from 'js-cookie';
import { useEffect, useLayoutEffect, useState } from 'react';
import superagent from 'superagent';
import { constants } from '../../../utils/constants';
import { websiteUtils, wsMessageListeners } from '../../../utils/websiteUtils';
import { WebSocketEvent, WebSocketOP } from '../../../utils/websocketEvents';
import './Friends.css';

interface Friend {
    id: string;
    username: string;
    avatar: string;
}

const Friends = () => {
    const [friends, setFriends] = useState([] as Friend[]);
    const [friendRequests, setFriendRequests] = useState([] as Friend[]);
    const [pendingFriendRequests, setPendingFriendRequests] = useState([] as Friend[]);

    const [wsMessageListenerID, setWSMessageListenerID] = useState('');

    const [selectedMenu, setSelectedMenu] = useState<'friends' | 'pending' | 'addFriends'>('friends');
    const [usernameToSendFriendRequest, setUsernameToSendFriendRequest] = useState('');

    useEffect(() => {
        (async () => {
            const friendsData = (await superagent.get(`/api/friends`)).body;

            setFriends(friendsData.friends);
            setPendingFriendRequests(friendsData.pendingFriendRequests);
            setFriendRequests(friendsData.friendRequests);

            const id = websiteUtils.attachMessageListenerToWS((message: WebSocketEvent) => {
                const currentUserID = cookies.get('id');

                if (message.op === WebSocketOP.FRIEND_REQ_SEND) {
                    if (message.d.receiver.id === currentUserID) setFriendRequests((friendRequests) => [...friendRequests, message.d.sender]);
                    else setPendingFriendRequests((pendingFriendRequests) => [...pendingFriendRequests, message.d.receiver]);
                } else if (message.op === WebSocketOP.FRIEND_REQ_ACCEPT) {
                    setFriends((friends) => [...friends, message.d.sender.id === currentUserID ? message.d.receiver : message.d.sender]);
                    setPendingFriendRequests((pendingFriendRequests) => pendingFriendRequests.filter((friend) => friend.id !== message.d.sender.id && friend.id !== message.d.receiver.id));
                    setFriendRequests((friendRequests) => friendRequests.filter((friend) => friend.id !== message.d.sender.id && friend.id !== message.d.receiver.id));
                } else if (message.op === WebSocketOP.FRIEND_REQ_DELETE || message.op === WebSocketOP.FRIEND_REQ_REJECT) {
                    setFriends((friends) => friends.filter((friend) => friend.id !== message.d.sender.id && friend.id !== message.d.receiver.id));
                    setFriendRequests((friendRequests) => friendRequests.filter((friend) => friend.id !== message.d.sender.id && friend.id !== message.d.receiver.id));
                    setPendingFriendRequests((pendingFriendRequests) => pendingFriendRequests.filter((friend) => friend.id !== message.d.sender.id && friend.id !== message.d.receiver.id));
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
        <div className='friends-bar-main'>
            <div className='friends-bar-header'>
                <div onClick={() => setSelectedMenu('friends')}>All Friends</div>
                <div style={{ display: 'flex', alignItems: 'center' }} onClick={() => setSelectedMenu('pending')}>
                    Pending Requests {friendRequests.length > 0 && <div className='unread-div'>{friendRequests.length}</div>}
                </div>
                <div onClick={() => setSelectedMenu('addFriends')}>Add Friend</div>
            </div>
            <hr />
            {selectedMenu === 'friends' ? (
                <div>
                    {friends?.map((friend) => {
                        return (
                            <div style={{ display: 'flex', marginLeft: '15px', marginTop: '12px' }}>
                                <div className='friend-details'>
                                    <img src={friend.avatar} alt='profile pic' referrerPolicy='no-referrer' />
                                    <p>{friend.username}</p>
                                </div>
                                <div className='pending-friend-req-actions'>
                                    <svg style={{ height: '20px', marginLeft: '30px', marginRight: '-10px', scale: '1.5', width: '45px' }}>
                                        <path d={constants.svgs.icons.message} fill='white' />
                                    </svg>
                                    <svg onClick={async () => superagent.patch(`/api/friends/${friend.username}`).send({ op: 'remove' })}>
                                        <path d={constants.svgs.icons.cross} fill='orangered' />
                                    </svg>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : selectedMenu === 'pending' ? (
                <div style={{ paddingLeft: '15px' }}>
                    <h3>Incoming Requests</h3>
                    {friendRequests?.map((friendRequest) => {
                        return (
                            <div className='pending-friend-req'>
                                <div className='friend-details'>
                                    <img src={friendRequest.avatar} alt='profile pic' referrerPolicy='no-referrer' />
                                    <p>{friendRequest.username}</p>
                                </div>
                                <div className='pending-friend-req-actions'>
                                    <svg onClick={async () => superagent.patch(`/api/friends/${friendRequest.username}`).send({ op: 'accept' })}>
                                        <path d={constants.svgs.icons.tick} fill='mediumspringgreen' />
                                    </svg>
                                    <svg onClick={async () => superagent.patch(`/api/friends/${friendRequest.username}`).send({ op: 'reject' })}>
                                        <path d={constants.svgs.icons.cross} fill='orangered' />
                                    </svg>
                                </div>
                            </div>
                        );
                    })}
                    <h3>Outgoing Requests</h3>
                    {pendingFriendRequests?.map((pendingFriendRequest) => {
                        return (
                            <div className='pending-friend-req'>
                                <div className='friend-details'>
                                    <img src={pendingFriendRequest.avatar} alt='profile pic' referrerPolicy='no-referrer' />
                                    <p>{pendingFriendRequest.username}</p>
                                </div>
                                <div className='pending-friend-req-actions'>
                                    <svg onClick={async () => superagent.patch(`/api/friends/${pendingFriendRequest.username}`).send({ op: 'remove' })}>
                                        <path d={constants.svgs.icons.cross} fill='orangered' />
                                    </svg>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : selectedMenu === 'addFriends' ? (
                <div className='friends-bar-add-friends'>
                    <input type='text' value={usernameToSendFriendRequest} onChange={(e) => setUsernameToSendFriendRequest(e.target.value)} placeholder='Enter a Username' />
                    <button onClick={async () => await superagent.patch(`/api/friends/${usernameToSendFriendRequest}`).send({ op: 'add' })}>Send Request</button>
                </div>
            ) : null}
        </div>
    );
};

export default Friends;
