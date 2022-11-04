import 'dotenv/config';
import express from 'express';
import { routers } from './routers';

const app = express();

app.use('/api', routers.API);
app.use('/oauth', routers.OAuth);

app.listen(3001);

process.on('unhandledRejection', (error) => {
    console.error('Uncaught Promise Error: ', error);
});

console.log('Backend Started and is Running!');
