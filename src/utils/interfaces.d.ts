export interface Channel {
    id: string;
    users: User[];
    name: string;
    icon: string;
    type: 'dm' | 'group';
}

export interface Message {
    id: string;
    channelID: string;
    authorID: string;
    content: string;
    sentAt: string;
    editedAt?: string;
}

export interface User {
    id: string;
    username: string;
    avatar: string;
}
