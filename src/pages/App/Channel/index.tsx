import { useEffect, useState } from 'react';
import superagent from 'superagent';
import Loader from '../../../components.ts/Loader';
import { Channel as ChannelInterface, Message } from '../../../utils/interfaces';
import './Channel.css';

const Channel = (props: any) => {
    const { channelID } = props.match.params;

    const [isLoading, setIsLoading] = useState(true);
    const [channel, setChannel] = useState({} as ChannelInterface);
    const [messages, setMessages] = useState([] as Message[]);
    const [newMessageContent, setNewMessageContent] = useState('');

    const sendMessage = async () => {
        setNewMessageContent('');

        await superagent.post(`/api/channels/${channelID}/messages`).send({ content: newMessageContent });
    };

    useEffect(() => {
        (async () => {
            const channelData = (await superagent.get(`/api/channels/${channelID}`)).body;

            const messagesData = (await superagent.get(`/api/channels/${channelID}/messages`)).body;

            setChannel(channelData);
            setMessages(messagesData);

            // TODO: Fix this
            setIsLoading(false);

            messages.every(() => null);
        })();
    }, []);

    return isLoading ? (
        <Loader occupyFullScreen={true} />
    ) : (
        <div className='msg-channel'>
            <div className='msg-channel-header friend-details'>
                <img src={channel.icon} alt='channel icon' />
                <p>{channel.name}</p>
            </div>
            <div className='msg-channel-msgs-div'>
                {messages?.map((message) => {
                    return (
                        <div>
                            <div className='friend-details'>
                                <img src={channel.users.find((user) => user.id === message.authorID)?.avatar} alt='author icon' referrerPolicy='no-referrer' />
                                <p>{channel.users.find((user) => user.id === message.authorID)?.username}</p>
                            </div>
                            <p>{message.content}</p>
                        </div>
                    );
                })}
            </div>
            <div className='msg-channel-send-msg-div'>
                <textarea value={newMessageContent} onChange={(e) => setNewMessageContent(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()} placeholder='Enter a Message' />
                <button onClick={sendMessage}>Send</button>
            </div>
        </div>
    );
};

export default Channel;
