import express from 'express';

const app = express();

app.listen(3001);

process.on('unhandledRejection', (error) => {
    console.error('Uncaught Promise Error: ', error);
});

console.log('Backend Started and is Running!');
