import cookies from 'js-cookie';
import { constants } from './constants';
import { WebSocketOP } from './websocketEvents';

let ws: WebSocket;
const wsMessageListeners = new Map<string, Function>();

export const websiteUtils = {
    connectToWS: (setIsLoaded: Function) => {
        ws = new WebSocket(constants.websocketURL);

        ws.onopen = () => {
            ws.send(JSON.stringify({ op: WebSocketOP.HELLO, d: { id: cookies.get('id') } }));

            setIsLoaded(true);

            setInterval(() => {
                ws.send(JSON.stringify({ op: WebSocketOP.PING, d: null }));
            }, 30000);
        };

        ws.onclose = () => {
            setIsLoaded(false);

            setTimeout(() => {
                websiteUtils.connectToWS(setIsLoaded);
            }, 5000);
        };

        ws.onmessage = (msg) => {
            const message = JSON.parse(msg.data);

            for (const wsMessageListener of wsMessageListeners) {
                if (window.location.href === wsMessageListener[0]) wsMessageListener[1](message);
            }
        };
    },
    heartbeat: () => {
        ws.send(JSON.stringify({ op: WebSocketOP.PING }));
    },
    attachMessageListenerToWS: (href: string, func: Function) => {
        wsMessageListeners.set(href, func);
    },
};
