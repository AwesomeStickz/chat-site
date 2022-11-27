const ports = {
    backendPort: process.env.NODE_ENV === 'production' ? 19437 : 3333,
    frontendPort: process.env.NODE_ENV === 'production' ? 28450 : 3000,
    websocketPort: process.env.NODE_ENV === 'production' ? 35382 : 3334,
};

export const constants = {
    ...ports,
    backendBaseURL: `http://localhost:${ports.backendPort}`,
    frontendBaseURL: `http://localhost:${ports.frontendPort}`,
    websocketURL: `ws://localhost:${ports.websocketPort}`,
    svgs: {
        icons: {
            message: 'M4.79805 3C3.80445 3 2.99805 3.8055 2.99805 4.8V15.6C2.99805 16.5936 3.80445 17.4 4.79805 17.4H7.49805V21L11.098 17.4H19.198C20.1925 17.4 20.998 16.5936 20.998 15.6V4.8C20.998 3.8055 20.1925 3 19.198 3H4.79805Z',
            tick: 'M8.99991 16.17L4.82991 12L3.40991 13.41L8.99991 19L20.9999 7.00003L19.5899 5.59003L8.99991 16.17Z',
            cross: 'M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z',
        },
    },
};
