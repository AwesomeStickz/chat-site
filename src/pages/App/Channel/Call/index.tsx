import { useEffect, useLayoutEffect, useState } from 'react';
import { websiteUtils, wsMessageListeners } from '../../../../utils/websiteUtils';
import { WebSocketEvent, WebSocketOP } from '../../../../utils/websocketEvents';
import './Call.css';

let myVideoStream: MediaStream;
let otherUserVideoStream: MediaStream;

// @ts-expect-error
const peer: any = new Peer();
// TODO: const peer: any = new Peer({ host: 'localhost', port: '3333' });

function addVideo(video: HTMLVideoElement, stream: MediaStream) {
    video.srcObject = stream;

    video.addEventListener('loadedmetadata', () => video.play());

    document.getElementById('videoDiv')!.append(video);
}

const peerConnections: any = {};

navigator.mediaDevices
    .getUserMedia({
        video: true,
        audio: false,
    })
    .then((stream) => {
        myVideoStream = stream;

        const vid = document.getElementById('myVid') as HTMLVideoElement;

        addVideo(vid, stream);

        peer.on('call', (call: any) => {
            call.answer(stream);

            const vid = document.getElementById('otherUserVid') as HTMLVideoElement;

            call.on('stream', (userStream: any) => {
                otherUserVideoStream = userStream;

                addVideo(vid, userStream);
            });

            call.on('error', (err: any) => alert(err));
            call.on('close', () => vid.remove());

            peerConnections[call.peer] = call;
        });
    })
    .catch((err) => {
        alert(err.message);
    });

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

    const [wsMessageListenerID, setWSMessageListenerID] = useState('');
    const [focusCurrentUser, setFocusCurrentUser] = useState(false);

    useEffect(() => {
        peer.on('open', (id: any) => websiteUtils.sendMessageToWS({ op: WebSocketOP.CALL_DATA, d: { type: 'newUser', id, channelID } }));

        peer.on('error', (err: any) => alert(err.type));

        const id = websiteUtils.attachMessageListenerToWS((message: WebSocketEvent) => {
            if (message.op === WebSocketOP.CALL_DATA) {
                if (message.d.type === 'userJoined') {
                    const call = peer.call(message.d.id, myVideoStream);
                    const vid = document.getElementById('otherUserVid') as HTMLVideoElement;

                    call.on('error', (err: any) => alert(err));
                    call.on('stream', (userStream: any) => addVideo(vid, userStream));
                    call.on('close', () => vid.remove());

                    peerConnections[message.d.id] = call;
                } else if (message.d.type === 'userDisconnect') {
                    if (peerConnections[message.d.id]) {
                        peerConnections[message.d.id].close();
                    }
                }
            }
        });

        setWSMessageListenerID(id);
    }, []);

    useLayoutEffect(() => {
        return () => {
            wsMessageListeners.delete(wsMessageListenerID);

            myVideoStream.getTracks().forEach((track) => track.stop());
        };
    }, []);

    return (
        <div style={{ width: '100%' }}>
            <h1 style={{ textAlign: 'center' }}>In Call</h1>
            <div id='videoDiv'>
                <video id='myVid' autoPlay muted onClick={() => setFocusCurrentUser(!focusCurrentUser)} style={focusCurrentUser ? currentUserFocusStyle : otherUserFocusStyle} />
                <video id='otherUserVid' autoPlay onClick={() => setFocusCurrentUser(!focusCurrentUser)} style={focusCurrentUser ? otherUserFocusStyle : currentUserFocusStyle} />
            </div>
            <div>
                <button onClick={() => toggleAudio(myVideoStream)}>Toggle Audio</button>
                <button onClick={() => toggleVideo(myVideoStream)}>Toggle Video</button>
                <button onClick={() => toggleAudio(otherUserVideoStream)}>Toggle Other User Audio</button>
            </div>
        </div>
    );
};

export default Call;
