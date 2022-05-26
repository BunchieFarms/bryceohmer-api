import fetch from 'node-fetch';
import express from 'express';
import cron from 'node-cron';
import { MongoClient } from 'mongodb';
import 'dotenv/config';

const app = express();
const mongoUri = process.env.MONGO_URI;
const client = new MongoClient(mongoUri);
const dbName = 'bryceohmer';

app.get('/api/currentWeather', async (req, res) => {
    const doc = await getFirstInCollection('currentWeather');
    res.send(doc[0]);
});

app.get('/api/weatherForecast', async (req, res) => {
    const doc = await getFirstInCollection('weatherForecast');
    res.send(doc[0]);
});

// app.get('/api/weatherHistory', async (req, res) => {
//     const doc = await getFirstInCollection('weatherHistory');
//     res.send(doc[0]);
// });

async function getFirstInCollection(coll) {
    await client.connect();
    const database = client.db(dbName);
    const collection = database.collection(coll);
    const found = collection.find({}).limit(1).sort({ _id: -1 }).toArray();
    return found;
}

// For testing
// cron.schedule(`*/5 * * * * *`, () => {
//     console.log('doin the dang thang')
//     saveForecast()
// })

//Fetch current weather every half hour
cron.schedule(`*/30 * * * *`, () => {
    saveCurrentWeather();
});

//Fetch forecast and historical, delete old records once a day at 8am
cron.schedule(`0 8 * * *`, () => {
    saveForecast();
    deleteOldForecast();
    deleteOldHistorical();
});

function saveCurrentWeather() {
    fetch(`http://api.openweathermap.org/data/2.5/weather?zip=28461&appid=${process.env.WEATHER_KEY}`)
        .then((res) => res.json())
        .then((data) => {
            data.weather[0].iconUrl = `http://openweathermap.org/img/wn/${data.weather[0].icon}@4x.png`;
            data.zip = 28461;

            client.connect()
                .then((cl) => {
                    const db = cl.db(dbName);
                    const collection = db.collection('currentWeather');
                    collection.insertOne(data);
                });
        });
}

// function saveHistorical() {
//     client.connect()
//         .then((cl) => {
//             const db = cl.db(dbName);
//             const collection = db.collection('currentWeather');
//             collection.findOne({ zip: 28461 })
//                 .then((found) => {
//                     fetch(`http://api.openweathermap.org/data/2.5/onecall/timemachine?lat=${found.coord.lat}&lon=${found.coord.lon}&dt=${Math.floor(new Date().getTime() / 1000) - 43200}&appid=${process.env.WEATHER_KEY}`)
//                         .then((res) => res.json())
//                         .then((data) => {
//                             data.zip = 28461;

//                             const collection = db.collection('weatherHistory');
//                             collection.insertOne(data);
//                         });
//                 });
//         });
// }

function saveForecast() {
    client.connect()
        .then((cl) => {
            const db = cl.db(dbName);
            const collection = db.collection('currentWeather');
            collection.findOne({ zip: 28461 })
                .then((found) => {
                    fetch(`https://api.openweathermap.org/data/2.5/onecall?lat=${found.coord.lat}&lon=${found.coord.lon}&exclude=minutely,hourly,current,alerts&appid=${process.env.WEATHER_KEY}`)
                        .then((res) => res.json())
                        .then((data) => {
                            data.zip = 28461;
                            data.daily.forEach((w) => {
                                w.weather[0].iconUrl = `http://openweathermap.org/img/wn/${w.weather[0].icon}@4x.png`
                            });

                            const collection = db.collection('weatherForecast');
                            collection.insertOne(data);
                        });
                });
        });
}

function deleteOldHistorical() {
    client.connect()
        then((cl) => {
            const db = cl.db(dbName);
            const collection = db.collection('currentWeather');
            collection.deleteMany({dt: {"$lt": new Date(Date.now() - 604800000).getTime() / 1000}});
        });
}

function deleteOldForecast() {
    client.connect()
        .then((cl) => {
            const db = cl.db(dbName);
            const collection = db.collection('weatherForecast');
            collection.deleteMany({ "daily.dt": {"$lt": new Date(Date.now() - 86400000).getTime() / 1000} });
        });
}

app.listen(3001, () => {
    console.log('listening on 3001');
});