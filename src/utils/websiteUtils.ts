import cookies from 'js-cookie';
import { constants } from './constants';
import { WebSocketEvent, WebSocketOP } from './websocketEvents';

let ws: WebSocket;

export const wsMessageListeners = new Map<string, Function>();

export const websiteUtils = {
    connectToWS: (setIsLoaded: Function, setUnreadData: Function) => {
        if (!ws || !ws.OPEN) ws = new WebSocket(constants.websocketURL);

        ws.onopen = () => {
            ws.send(JSON.stringify({ op: WebSocketOP.HELLO, d: { id: cookies.get('id'), sessionID: cookies.get('connect.sid') } }));

            setIsLoaded(true);

            setInterval(() => {
                ws.send(JSON.stringify({ op: WebSocketOP.PING, d: null }));
            }, 30000);
        };

        ws.onclose = () => {
            setIsLoaded(false);

            setTimeout(() => window.location.reload(), 3000);
        };

        ws.onmessage = (msg) => {
            const message = JSON.parse(msg.data) as WebSocketEvent;

            if (message.op === WebSocketOP.HELLO) setUnreadData(message.d);

            for (const wsMessageListener of wsMessageListeners) wsMessageListener[1](message);
        };
    },
    heartbeat: () => {
        ws.send(JSON.stringify({ op: WebSocketOP.PING }));
    },
    // PascalCase cuz React errors otherwise for using useLayoutEffect
    attachMessageListenerToWS: (func: Function) => {
        const id = websiteUtils.generateRandomChars(64);

        wsMessageListeners.set(id, func);

        return id;
    },
    sendMessageToWS: (message: WebSocketEvent) => {
        ws.send(JSON.stringify(message));
    },
    generateRandomChars: (length: number) => {
        let result = '';
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const charactersLength = characters.length;

        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }

        return result;
    },
};
