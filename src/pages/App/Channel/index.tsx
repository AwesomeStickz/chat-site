import { useEffect, useState } from 'react';
import superagent from 'superagent';
import Loader from '../../../components.ts/Loader';
import { Channel as ChannelInterface, Message } from '../../../utils/interfaces';
import { websiteUtils } from '../../../utils/websiteUtils';
import { WebSocketEvent, WebSocketOP } from '../../../utils/websocketEvents';
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
            setMessages(messagesData.sort((a: Message, b: Message) => Number(a.sentAt) - Number(b.sentAt)));

            websiteUtils.attachMessageListenerToWS(window.location.href, (message: WebSocketEvent) => {
                if (message.op === WebSocketOP.MESSAGE_CREATE) setMessages((messages) => [...messages, message.d]);
                else if (message.op === WebSocketOP.MESSAGE_DELETE) setMessages((messages) => messages.filter((m) => m.id !== message.d.id));
                else if (message.op === WebSocketOP.MESSAGE_UPDATE) setMessages((messages) => messages.map((m) => (m.id === message.d.id ? message.d : m)));
            });

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
                {groupMessagesByUser(messages)?.map((messageGroup) => {
                    return (
                        <div>
                            <div>
                                <div className='friend-details' style={{ width: 'auto', marginRight: '10px' }}>
                                    <img src={channel.users.find((user) => user.id === messageGroup[0].authorID)?.avatar} alt='author icon' referrerPolicy='no-referrer' />
                                    <p>{channel.users.find((user) => user.id === messageGroup[0].authorID)?.username}</p>
                                </div>
                                <p>• {getMessageDisplayDate(new Date(Number(messageGroup[0].sentAt)))}</p>
                            </div>
                            {messageGroup.map((message) => (
                                <p>{message.content}</p>
                            ))}
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

const getMessageDisplayDate = (date: Date) => {
    const getMessageTime = (date: Date) => `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')} ${date.getHours() > 12 ? 'PM' : 'AM'}`;

    const getMessageDate = (date: Date) => {
        const today = new Date();
        const yesterday = new Date(today);

        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return 'Today';
        else if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear().toString().slice(2)}`;
    };

    return `${getMessageDate(date)} ${getMessageTime(date)}`;
};

const groupMessagesByUser = (messages: Message[]) => {
    const groupedMessages: Message[][] = [];

    let currentGroup: Message[] = [];

    let numberOfMessagesInCurrentGroup = 0;

    for (let i = 0; i < messages.length; i++) {
        const message = messages[i];

        numberOfMessagesInCurrentGroup++;

        if (i === 0) {
            currentGroup.push(message);

            continue;
        }

        const previousMessage = messages[i - 1];

        if (message.authorID === previousMessage.authorID && numberOfMessagesInCurrentGroup < 5) currentGroup.push(message);
        else {
            groupedMessages.push(currentGroup);
            currentGroup = [message];

            numberOfMessagesInCurrentGroup = 0;
        }
    }

    if (currentGroup.length > 0) groupedMessages.push(currentGroup);

    return groupedMessages;
};
