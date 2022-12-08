import cookies from 'js-cookie';
import parseDuration from 'parse-duration';
import { useEffect, useLayoutEffect, useState } from 'react';
import { useHistory, withRouter } from 'react-router-dom';
import superagent from 'superagent';
import Loader from '../../../../components.ts/Loader';
import { Channel as ChannelInterface, Message } from '../../../../utils/interfaces';
import { websiteUtils, wsMessageListeners } from '../../../../utils/websiteUtils';
import { WebSocketEvent, WebSocketOP } from '../../../../utils/websocketEvents';
import './Channel.css';

const Channel = (props: any) => {
    const { channelID } = props.match.params;

    const history = useHistory();

    const [isLoading, setIsLoading] = useState(true);
    const [channel, setChannel] = useState({} as ChannelInterface);
    const [messages, setMessages] = useState([] as Message[]);

    const [newMessageContent, setNewMessageContent] = useState('');
    const [newMessageFile, setNewMessageFile] = useState({ name: '', data: '' });
    const [messageSettings, setMessageSettings] = useState({ isOneTimeMessage: false, maxAliveTime: 0 });
    const [maxAliveTimeText, setMaxAliveTimeText] = useState('');

    const [displayGroupMembers, setDisplayGroupMembers] = useState(false);
    const [displayMessageSettings, setDisplayMessageSettings] = useState(false);

    const [wsMessageListenerID, setWSMessageListenerID] = useState('');

    const sendMessage = async () => {
        if (newMessageContent.length === 0 && newMessageFile.name.length === 0) return;

        await superagent.post(`/api/channels/${channelID}/messages`).send({
            content: newMessageContent,
            file: newMessageFile.name.length === 0 ? null : newMessageFile.data,
            fileName: newMessageFile.name.length === 0 ? null : newMessageFile.name,
            isOneTimeMessage: messageSettings.isOneTimeMessage,
            maxAliveTime: messageSettings.maxAliveTime ? messageSettings.maxAliveTime : null,
        });

        setNewMessageContent('');
        setNewMessageFile({ name: '', data: '' });
    };

    const handleSelectFile = () => {
        const fileSelectorElement = document.createElement('input');

        fileSelectorElement.setAttribute('type', 'file');

        fileSelectorElement.addEventListener('change', () => {
            if (fileSelectorElement.files?.length) {
                const reader = new FileReader();
                reader.readAsDataURL(fileSelectorElement.files[0]);

                reader.onload = () => {
                    if (typeof reader.result !== 'string') return;

                    // TODO: Erorr message
                    // if (fileSelectorElement.files![0].size / 1024 / 1024 > 100) return setPopupMessage('Please select a file whose size is less than or equal to 10MB!');

                    setNewMessageFile({ name: fileSelectorElement.files![0].name, data: reader.result });
                };
            }
        });

        fileSelectorElement.click();
    };

    useEffect(() => {
        (async () => {
            setIsLoading(true);

            const channelData = (await superagent.get(`/api/channels/${channelID}`)).body;
            const messagesData = (await superagent.get(`/api/channels/${channelID}/messages`)).body;

            setChannel(channelData);
            setMessages(messagesData.sort((a: Message, b: Message) => Number(a.sentAt) - Number(b.sentAt)));

            setTimeout(() => websiteUtils.sendMessageToWS({ op: WebSocketOP.ACK_MESSAGES, d: { channelID: channelID } }), 2500);

            const id = websiteUtils.attachMessageListenerToWS((message: WebSocketEvent) => {
                if (message.op === WebSocketOP.MESSAGE_CREATE) {
                    setMessages((messages) => [...messages, message.d]);

                    if (window.location.href.endsWith(channelID)) websiteUtils.sendMessageToWS({ op: WebSocketOP.ACK_MESSAGES, d: { channelID } });
                } else if (message.op === WebSocketOP.MESSAGE_DELETE) setMessages((messages) => messages.filter((m) => m.id !== message.d.id));
                else if (message.op === WebSocketOP.MESSAGE_UPDATE) setMessages((messages) => messages.map((m) => (m.id === message.d.id ? message.d : m)));
                else if (message.op === WebSocketOP.CHANNEL_MEMBER_REMOVE) {
                    if (message.d.id === cookies.get('id')) history.push('/app');
                    else setChannel((channel) => ({ ...channel, users: channel.users.filter((user) => user.id !== message.d.memberID) }));
                }
            });

            setWSMessageListenerID(id);

            // TODO: Fix this
            setIsLoading(false);

            messages.every(() => null);
        })();
    }, [channelID]);

    useLayoutEffect(() => {
        return () => {
            wsMessageListeners.delete(wsMessageListenerID);
        };
    }, []);

    return isLoading ? (
        <Loader occupyFullScreen={true} />
    ) : (
        <>
            <div className='msg-channel'>
                <div className='msg-channel-header'>
                    <div className='friend-details' style={{ marginLeft: '10px' }}>
                        <img src={channel.icon} alt='channel icon' referrerPolicy='no-referrer' />
                        <p>{channel.name}</p>
                    </div>
                    <div className='msg-channel-header-right-side'>
                        {channel.type === 'dm' ? (
                            <>
                                <img src='/assets/voice-call-icon.png' alt='voice call' style={{ width: '35px', cursor: 'pointer' }} />
                                <img src='/assets/video-call-icon.png' alt='video call' style={{ width: '30px', marginLeft: '10px', cursor: 'pointer' }} onClick={() => websiteUtils.sendMessageToWS({ op: WebSocketOP.CALL_CREATE, d: { channelID } })} />
                                <input type='text' placeholder='Search' style={{ marginLeft: '10px' }} />
                            </>
                        ) : (
                            <>
                                <p style={{ cursor: 'pointer', scale: '2' }}>+</p>
                                <img src='/assets/friends-icon.png' style={{ cursor: 'pointer', height: '40px', marginLeft: '20px' }} onClick={() => setDisplayGroupMembers(true)} />
                                <img
                                    src='/assets/exit-icon.png'
                                    style={{ cursor: 'pointer', height: '40px', marginLeft: '10px', marginRight: '10px' }}
                                    onClick={async () => {
                                        await superagent.delete(`/api/channels/${channelID}/members/${cookies.get('id')}`);
                                        history.push('/app');
                                    }}
                                />
                            </>
                        )}
                    </div>
                </div>
                <div className='msg-channel-msgs-div'>
                    {groupMessagesByUser(messages)?.map((messageGroup, index) => {
                        return (
                            <div key={index}>
                                <div>
                                    {messageGroup[0].authorID !== '1' && (
                                        <>
                                            <div className='friend-details' style={{ width: 'auto', marginRight: '10px' }}>
                                                <img src={channel.users.find((user) => user.id === messageGroup[0].authorID)?.avatar || '/assets/group-icon.png'} alt='author icon' referrerPolicy='no-referrer' />
                                                <p>{channel.users.find((user) => user.id === messageGroup[0].authorID)?.username || 'User Left Group'}</p>
                                            </div>
                                            <p>• {getMessageDisplayDate(new Date(Number(messageGroup[0].sentAt)))}</p>
                                        </>
                                    )}
                                </div>
                                {messageGroup.map((message, index) => (
                                    <div
                                        key={index}
                                        className='msg-channel-msg-div'
                                        id={`msg-${message.id}-div`}
                                        onMouseOver={() => {
                                            document.getElementById(`msg-${message.id}-div`)!.style.backgroundColor = '#2a2d2f';
                                            document.getElementById(`msg-channel-msg-${message.id}-options`)!.style.display = 'block';
                                        }}
                                        onMouseOut={() => {
                                            document.getElementById(`msg-${message.id}-div`)!.style.backgroundColor = 'inherit';
                                            document.getElementById(`msg-channel-msg-${message.id}-options`)!.style.display = 'none';
                                        }}
                                    >
                                        {message.content ? (
                                            <div>
                                                {message.system
                                                    ? message.content.split('\n').map((line, index) => (
                                                          <>
                                                              <p key={index} style={{ margin: '0px', color: '#9b9b9b', fontStyle: 'italic' }}>
                                                                  {line}
                                                              </p>
                                                              <br />
                                                          </>
                                                      ))
                                                    : message.content.split('\n').map((line, index) => (
                                                          <>
                                                              <p key={index} style={{ margin: '0px' }}>
                                                                  {line}
                                                              </p>
                                                              <br />
                                                          </>
                                                      ))}
                                            </div>
                                        ) : message.file?.startsWith('data:image/') ? (
                                            <img src={message.file} alt='message file' referrerPolicy='no-referrer' style={{ maxHeight: '500px', maxWidth: '500px', marginTop: '10px', marginBottom: '10px' }} />
                                        ) : message.file?.startsWith('data:audio/') ? (
                                            <audio controls style={{ marginTop: '10px', marginBottom: '10px' }}>
                                                <source src={message.file} type='audio/mpeg' />
                                            </audio>
                                        ) : message.file?.startsWith('data:video/') ? (
                                            <video controls style={{ maxHeight: '350px', maxWidth: '500px', marginTop: '10px', marginBottom: '10px' }}>
                                                <source src={message.file} type='video/mp4' />
                                            </video>
                                        ) : (
                                            <div
                                                style={{ backgroundColor: '#212426', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                                                onClick={() => {
                                                    const a = document.createElement('a');

                                                    a.href = message.file!;
                                                    a.download = message.fileName!;

                                                    a.click();
                                                }}
                                            >
                                                <p style={{ marginLeft: '10px' }}>{message.fileName}</p>
                                                <img src='/assets/download-icon.png' style={{ marginLeft: '10px', marginRight: '10px' }} />
                                            </div>
                                        )}
                                        <div id={`msg-channel-msg-${message.id}-options`} style={{ display: 'none' }}>
                                            {message.authorID === cookies.get('id') && <img src='/assets/delete-icon.png' alt='delete icon' onClick={async () => await superagent.delete(`/api/channels/${channelID}/messages/${message.id}`)} />}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
                <div className='msg-channel-send-msg-div'>
                    <img src='/assets/add-file-icon.png' onClick={handleSelectFile} />
                    {!newMessageFile.name ? (
                        <textarea value={newMessageContent} onChange={(e) => setNewMessageContent(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()} placeholder='Enter a Message' />
                    ) : (
                        <>
                            <p style={{ width: '100%' }}>You selected the file {newMessageFile.name}</p>
                            <img src='/assets/delete-icon.png' onClick={() => setNewMessageFile({ name: '', data: '' })} />
                        </>
                    )}
                    <button onClick={sendMessage}>Send</button>
                    <img src='/assets/gear-icon.png' onClick={() => setDisplayMessageSettings(true)} />
                </div>
            </div>
            {displayGroupMembers && (
                <div className='group-create-div'>
                    <div>
                        <h1>Group Members</h1>
                        <div className='group-create-friends' style={{ maxHeight: '300px', marginBottom: '15px' }}>
                            {channel.users.map((user) => (
                                <>
                                    <div style={{ paddingLeft: '50px' }}>
                                        <div className='friend-details'>
                                            <img src={user.avatar} />
                                            <p>{user.username}</p>
                                        </div>
                                    </div>
                                </>
                            ))}
                        </div>
                        <button className='group-create-cancel-btn' onClick={() => setDisplayGroupMembers(false)}>
                            Close
                        </button>
                    </div>
                </div>
            )}
            {displayMessageSettings && (
                <div className='group-create-div'>
                    <div>
                        <h1>Message Settings</h1>
                        <div className='group-create-friends' style={{ maxHeight: '300px', marginBottom: '15px' }}>
                            <>
                                <div
                                    onClick={() => {
                                        document.getElementById(`one-time-messsage`)!.click();

                                        console.log(messageSettings.isOneTimeMessage);

                                        setMessageSettings({ ...messageSettings, isOneTimeMessage: !messageSettings.isOneTimeMessage });
                                    }}
                                >
                                    <div className='friend-details'>
                                        <p>Viewable Only Once</p>
                                    </div>
                                    <input id={`one-time-messsage`} type='checkbox' checked={messageSettings.isOneTimeMessage} />
                                </div>
                                <div>
                                    <div className='friend-details'>
                                        <p>Delete After</p>
                                    </div>
                                    <input
                                        id={`one-time-messsage`}
                                        type='text'
                                        value={maxAliveTimeText}
                                        onChange={(e) => {
                                            const timeInMs = parseDuration(e.target.value);

                                            setMessageSettings({ ...messageSettings, maxAliveTime: timeInMs });

                                            setMaxAliveTimeText(e.target.value);
                                        }}
                                    />
                                </div>
                            </>
                        </div>
                        <button className='group-create-cancel-btn' onClick={() => setDisplayMessageSettings(false)}>
                            Close
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default withRouter(Channel);

const getMessageDisplayDate = (date: Date) => {
    const getMessageTime = (date: Date) => `${(date.getHours() % 12).toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')} ${date.getHours() > 12 ? 'PM' : 'AM'}`;

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

        if (message.authorID === previousMessage.authorID && numberOfMessagesInCurrentGroup < 5 && Number(message.sentAt) - Number(previousMessage.sentAt) < 600000) currentGroup.push(message);
        else {
            groupedMessages.push(currentGroup);
            currentGroup = [message];

            numberOfMessagesInCurrentGroup = 0;
        }
    }

    if (currentGroup.length > 0) groupedMessages.push(currentGroup);

    return groupedMessages;
};
