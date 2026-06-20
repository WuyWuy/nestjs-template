export const ChatStatus = {
    SUCCESS: 'success',
    ERROR: 'error',
};

export const ChatEvent = {
    JOIN_ROOM: 'join-room',
    LEAVE_ROOM: 'leave-room',
    TEXT_CHAT: 'text-chat',
};

export enum ChatResponseBody {
    CONTENT = 'content',
    STATUS = 'status',
}
