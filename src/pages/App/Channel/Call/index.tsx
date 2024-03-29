import { useEffect, useLayoutEffect, useState } from 'react';
import { websiteUtils, wsMessageListeners } from '../../../../utils/websiteUtils';
import { WebSocketEvent, WebSocketOP } from '../../../../utils/websocketEvents';
import './Call.css';

let myVideoStream: MediaStream;
let otherUserVideoStream: MediaStream;

const handleVideoAdd = (video: HTMLVideoElement, stream: MediaStream) => {
    video.srcObject = stream;

    video.addEventListener('loadedmetadata', () => video.play());
};

const toggleAudio = (stream: MediaStream) => stream.getAudioTracks().forEach((track) => (track.enabled = !track.enabled));
const toggleVideo = (stream: MediaStream) => stream.getVideoTracks().forEach((track) => (track.enabled = !track.enabled));

const currentUserFocusStyle = {
    position: 'fixed',
    width: '200px',
    top: '300px',
    right: '30px',
};

const otherUserFocusStyle = {
    width: '750px',
};

const Call = (props: any) => {
    const { channelID } = props.match.params;

    const query = new URLSearchParams(window.location.search);
    const isVideoCall = query.get('type') === 'video';

    const [wsMessageListenerID, setWSMessageListenerID] = useState('');
    const [focusCurrentUser, setFocusCurrentUser] = useState(false);
    const [pingIntervalID, setPingIntervalID] = useState(0);

    const [mutedData, setMutedData] = useState({ me: false, other: false });
    const [camOnData, setCamOnData] = useState({ me: true, other: true });

    useEffect(() => {
        // @ts-expect-error
        const peer: any = new Peer();
        const peerConnections: any = {};

        navigator.mediaDevices
            .getUserMedia({
                video: isVideoCall,
                audio: true,
            })
            .then((stream) => {
                myVideoStream = stream;

                const vid = document.getElementById('myVid') as HTMLVideoElement;

                handleVideoAdd(vid, stream);

                const currentURL = window.location.href;

                // Ping Websocket Every Second
                const id = setInterval(() => {
                    websiteUtils.sendMessageToWS({ op: WebSocketOP.CALL_DATA, d: { type: 'ping', channelID } });

                    if (currentURL !== window.location.href) clearInterval(id);
                }, 1000);

                setPingIntervalID(id as any);

                peer.on('call', (call: any) => {
                    call.answer(stream);

                    const vid = document.getElementById('otherUserVid') as HTMLVideoElement;

                    call.on('stream', (userStream: any) => {
                        otherUserVideoStream = userStream;

                        handleVideoAdd(vid, userStream);
                    });

                    call.on('error', (err: any) => alert(err));
                    call.on('close', () => vid.remove());

                    peerConnections[call.peer] = call;
                });
            })
            .catch((err) => alert(err.message));

        peer.on('open', (id: any) => websiteUtils.sendMessageToWS({ op: WebSocketOP.CALL_DATA, d: { type: 'newUser', id, channelID } }));
        peer.on('error', (err: any) => alert(err.type));

        const id = websiteUtils.attachMessageListenerToWS((message: WebSocketEvent) => {
            if (message.op === WebSocketOP.CALL_DATA) {
                if (message.d.type === 'userJoined') {
                    const call = peer.call(message.d.id, myVideoStream);
                    const vid = document.getElementById('otherUserVid') as HTMLVideoElement;

                    call.on('error', (err: any) => alert(err));

                    call.on('stream', (userStream: any) => {
                        otherUserVideoStream = userStream;

                        handleVideoAdd(vid, userStream);
                    });

                    call.on('close', () => vid.remove());

                    peerConnections[message.d.id] = call;
                } else if (message.d.type === 'userDisconnect') {
                    if (peerConnections[message.d.id]) {
                        peerConnections[message.d.id].close();
                    }
                }
            } else if (message.op === WebSocketOP.CALL_END) {
                wsMessageListeners.delete(wsMessageListenerID);

                myVideoStream.getTracks().forEach((track) => track.stop());

                clearInterval(pingIntervalID);

                window.location.href = `/app/channels/${channelID}`;
            }
        });

        setWSMessageListenerID(id);
    }, []);

    useLayoutEffect(() => {
        return () => {
            wsMessageListeners.delete(wsMessageListenerID);

            myVideoStream.getTracks().forEach((track) => track.stop());

            clearInterval(pingIntervalID);
        };
    }, []);

    return (
        <div className='call-div'>
            <h1 style={{ textAlign: 'center' }}>In {isVideoCall ? 'Video' : 'Voice'} Call</h1>
            <div id='videoDiv'>
                <video id='myVid' autoPlay muted onClick={() => setFocusCurrentUser(!focusCurrentUser)} style={focusCurrentUser ? currentUserFocusStyle : otherUserFocusStyle} />
                <video id='otherUserVid' autoPlay onClick={() => setFocusCurrentUser(!focusCurrentUser)} style={focusCurrentUser ? otherUserFocusStyle : currentUserFocusStyle} />
            </div>
            <div className='call-div-buttons'>
                <button
                    onClick={() => {
                        toggleAudio(myVideoStream);

                        setMutedData({ ...mutedData, me: !mutedData.me });
                    }}
                >
                    {mutedData.me ? 'Unmute' : 'Mute'}
                </button>
                {isVideoCall && (
                    <button
                        onClick={() => {
                            toggleVideo(myVideoStream);

                            setCamOnData({ ...camOnData, me: !camOnData.me });
                        }}
                    >
                        {camOnData.me ? 'Turn Camera Off' : 'Turn Camera On'}
                    </button>
                )}
                <button
                    onClick={() => {
                        toggleAudio(otherUserVideoStream);

                        setMutedData({ ...mutedData, other: !mutedData.other });
                    }}
                >
                    {mutedData.other ? 'Enable Speaker' : 'Disable Speaker'}
                </button>
                {isVideoCall && (
                    <button
                        onClick={() => {
                            const video = document.getElementById('myVid') as HTMLVideoElement;

                            const shouldHide = video.style.display !== 'none';

                            video.style.display = shouldHide ? 'none' : 'block';

                            setFocusCurrentUser(shouldHide ? true : false);
                        }}
                    >
                        Hide My Video
                    </button>
                )}
                <button
                    className='group-create-cancel-btn'
                    onClick={() => {
                        websiteUtils.sendMessageToWS({ op: WebSocketOP.CALL_END, d: { channelID } });

                        window.location.href = `/app/channels/${channelID}`;
                    }}
                >
                    End Call
                </button>
            </div>
        </div>
    );
};

export default Call;
