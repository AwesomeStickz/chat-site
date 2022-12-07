import cookies from 'js-cookie';
import { io } from 'socket.io-client';
import { WebSocketEvent, WebSocketOP } from './websocketEvents';

export let socket: ReturnType<typeof io> | null = null;

export const wsMessageListeners = new Map<string, Function>();

export const websiteUtils = {
    connectToWS: (setIsLoaded: Function, setUnreadData: Function) => {
        socket = io();

        socket.on('connect', () => {
            socket?.send({ op: WebSocketOP.HELLO, d: { id: cookies.get('id'), sessionID: cookies.get('connect.sid') } });

            setIsLoaded(true);

            setInterval(() => {
                socket?.send({ op: WebSocketOP.PING, d: null });
            }, 30000);
        });

        socket.on('message', (message: WebSocketEvent) => {
            if (message.op === WebSocketOP.HELLO) setUnreadData(message.d);

            for (const wsMessageListener of wsMessageListeners) wsMessageListener[1](message);
        });
    },
    heartbeat: () => {
        socket?.send({ op: WebSocketOP.PING });
    },
    attachMessageListenerToWS: (func: Function) => {
        const id = websiteUtils.generateRandomChars(64);

        wsMessageListeners.set(id, func);

        return id;
    },
    sendMessageToWS: (message: WebSocketEvent) => {
        socket?.send(message);
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
