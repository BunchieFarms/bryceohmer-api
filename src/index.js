import fetch from 'node-fetch';
import express from 'express';
import bodyParser from 'body-parser';
import cron from 'node-cron';
import { MongoClient } from 'mongodb';

const app = express();
const mongoUri = 'mongodb://localhost:27017';
const client = new MongoClient(mongoUri);

const dbName = 'bryceohmer';

app.get('/api/weather', (req, res) => {
    fetch('http://api.openweathermap.org/data/2.5/weather?zip=28461&appid=12a6b20d756c5b22ec58b419b759d177')
        .then((res) => res.json())
        .then((data) => {
            data.weather[0].iconUrl = `http://openweathermap.org/img/wn/${data.weather[0].icon}@4x.png`;
            res.send(data);
        });
});

async function fetching() {
    await client.connect();
    console.log('connected');
    const db = client.db(dbName);
    const collection = db.collection('testing');
    const findResult = await collection.find({}).toArray();
    console.log('Found documents =>', findResult);

    return 'done';
}

const fetcher = () => {
    client.connect()
        .then((cl) => {
            const db = cl.db(dbName);
            const collection = db.collection('testing');
            collection.find({}).toArray()
                .then((data) => console.log('Found dockies => ', data));
        });
};

// cron.schedule(`*/2 * * * * *`, () => {
//     saveCurrentWeather();
// })

//Fetch current weather every hour
cron.schedule(`0 * * * *`, () => {
    saveCurrentWeather();
});

//Fetch forecast once a day at 8am
cron.schedule(`0 8 * * *`, () => {

});

async function saveCurrentWeather() {
    fetch('http://api.openweathermap.org/data/2.5/weather?zip=28461&appid=12a6b20d756c5b22ec58b419b759d177')
        .then((res) => res.json())
        .then((data) => {
            data.weather[0].iconUrl = `http://openweathermap.org/img/wn/${data.weather[0].icon}@4x.png`;

            client.connect()
                .then((cl) => {
                    const db = cl.db(dbName);
                    const collection = db.collection('weather');
                    collection.insertOne(data);
                });
        });
}

app.listen(3001, () => {
    console.log('listening on 3001');
});