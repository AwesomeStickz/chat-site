import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import superagent from 'superagent';
import { constants } from '../../utils/constants';
import { Channel } from '../../utils/interfaces';
import './AppLeftSideBar.css';

const AppLeftSideBar = () => {
    const history = useHistory();

    const [channels, setChannels] = useState<Channel[]>([]);

    useEffect(() => {
        (async () => {
            const channels = (await superagent.get(`/api/channels`)).body;

            setChannels(channels);
        })();
    }, []);

    return (
        <div className='app-left-sidebar'>
            <div className='app-left-sidebar-friends' onClick={() => history.push('/app/friends')}>
                <img src='/assets/friends-icon.png' />
                <p>Friends</p>
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
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AppLeftSideBar;
