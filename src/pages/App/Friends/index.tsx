import { useEffect, useState } from 'react';
import superagent from 'superagent';
import { constants } from '../../../utils/constants';
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

    const [selectedMenu, setSelectedMenu] = useState<'friends' | 'pending' | 'addFriends'>('friends');
    const [usernameToSendFriendRequest, setUsernameToSendFriendRequest] = useState('');

    useEffect(() => {
        (async () => {
            const friendsData = (await superagent.get(`/api/friends`)).body;

            setFriends(friendsData.friends);
            setPendingFriendRequests(friendsData.pendingFriendRequests);
            setFriendRequests(friendsData.friendRequests);
        })();
    }, []);

    return (
        <div className='friends-bar-main'>
            <div className='friends-bar-header'>
                <div onClick={() => setSelectedMenu('friends')}>All Friends</div>
                <div onClick={() => setSelectedMenu('pending')}>Pending Requests</div>
                <div onClick={() => setSelectedMenu('addFriends')}>Add Friend</div>
            </div>
            <hr />
            {selectedMenu === 'friends' ? (
                <div>
                    {friends?.map((friend) => {
                        return (
                            <div className='friend-details'>
                                <img src={friend.avatar} alt='profile pic' referrerPolicy='no-referrer' />
                                <p>{friend.username}</p>
                            </div>
                        );
                    })}
                </div>
            ) : selectedMenu === 'pending' ? (
                <div>
                    <p>Incoming</p>
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
                    <p>Outgoing</p>
                    {pendingFriendRequests?.map((pendingFriendRequest) => {
                        return <div>{pendingFriendRequest.username}</div>;
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
