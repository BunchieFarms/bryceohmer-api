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
    const doc = await getItemsInCollection('currentWeather', 1, -1);
    res.send(doc[0]);
});

app.get('/api/weatherForecast', async (req, res) => {
    const doc = await getItemsInCollection('weatherForecast', 1, -1);
    res.send(doc[0]);
});

app.get('/api/pastWeather', async (req, res) => {
    const doc = await getItemsInCollection('pastWeather', 8, 1);
    res.send(doc);
});

async function getItemsInCollection(coll, limit, direction) {
    await client.connect();
    const database = client.db(dbName);
    const collection = database.collection(coll);
    const found = collection.find({}).limit(limit).sort({ _id: direction }).toArray();
    return found;
}

// For testing
// cron.schedule(`*/5 * * * * *`, () => {
//     console.log('doin the dang thang')
//     createWeekOfHistory();
// })

//Fetch current weather every half hour
cron.schedule(`*/30 * * * *`, () => {
    saveCurrentWeather();
    createHistorical();
});

//Delete old records once a day at midnight
cron.schedule(`0 0 * * *`, () => {
    deleteOldForecast();
    deleteOldCurrentWeather();
    deleteOldPastWeather();
});

//Fetch forecast every hour
cron.schedule(`0 * * * *`, () => {
    saveForecast();
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

function createHistorical() {
    client.connect()
        .then((cl) => {
            const db = cl.db(dbName);
            const collection = db.collection('currentWeather');
            const dayStart = new Date().setHours(0, 0, 0, 0) / 1000;
            const dayEnd = new Date().setHours(23, 59, 59, 999) / 1000;
            const zip = 28461;
            let cumRain = 0;
            collection.find({ dt: { "$gte": dayStart, "$lte": dayEnd }, zip: zip }).toArray()
                .then((found) => {
                    let topIcon = 1;
                    found.forEach((item) => {
                        const currIcon = parseInt(item.weather[0].icon);
                        topIcon = currIcon > topIcon ? currIcon : topIcon;
                        if (item.rain !== undefined) {
                            cumRain += item.rain["1h"];
                        };
                    });
                    const iconUrlCode = topIcon < 10 ? `0${topIcon}d` : `${topIcon}d`;
                    saveHistorical({ date: dayStart, zip: zip, cumRain: cumRain, iconUrl: `http://openweathermap.org/img/wn/${iconUrlCode}@4x.png` });
                });
        });
}

// function createWeekOfHistory() {
//     client.connect()
//         .then((cl) => {
//             const db = cl.db(dbName);
//             const collection = db.collection('currentWeather');
//             const dayStart = new Date().setHours(0, 0, 0, 0) / 1000;
//             const dayEnd = new Date().setHours(23, 59, 59, 999) / 1000;
//             const zip = 28461;
//             for (let i = 1; i < 8; i++) {
//                 const pastDayStart = new Date(dayStart * 1000).setDate(new Date(dayStart * 1000).getDate() - i) / 1000;
//                 const pastDayEnd = new Date(dayEnd * 1000).setDate(new Date(dayEnd * 1000).getDate() - i) / 1000;
//                 let cumRain = 0;
//                 collection.find({ dt: { "$gte": pastDayStart, "$lte": pastDayEnd }, zip: zip }).toArray()
//                     .then((found) => {
//                         let topIcon = 1;
//                         found.forEach((item) => {
//                             const currIcon = parseInt(item.weather[0].icon);
//                             topIcon = currIcon > topIcon ? currIcon : topIcon;
//                             if (item.rain !== undefined) {
//                                 cumRain += item.rain["1h"];
//                             };
//                         });
//                         const iconUrlCode = topIcon < 10 ? `0${topIcon}d` : `${topIcon}d`;
//                         saveHistorical({ date: pastDayStart, zip: zip, cumRain: cumRain, iconUrl: `http://openweathermap.org/img/wn/${iconUrlCode}@4x.png` });
//                     });
//             }
//         });
// }

function saveHistorical(rainData) {
    client.connect()
        .then((cl) => {
            const db = cl.db(dbName);
            const collection = db.collection("pastWeather");
            collection.findOne({ date: rainData.date })
                .then((found) => {
                    if (found) {
                        collection.updateOne({ _id: found._id }, { $set: { cumRain: rainData.cumRain } });
                    } else {
                        collection.insertOne(rainData);
                    }
                });
        });
}

function deleteOldCurrentWeather() {
    client.connect()
        .then((cl) => {
            const db = cl.db(dbName);
            const collection = db.collection('currentWeather');
            collection.deleteMany({ dt: { "$lt": new Date(Date.now() - 604800000).getTime() / 1000 } });
        });
}

function deleteOldForecast() {
    client.connect()
        .then((cl) => {
            const db = cl.db(dbName);
            const collection = db.collection('weatherForecast');
            collection.deleteMany({ "daily.dt": { "$lt": new Date(Date.now() - 86400000).getTime() / 1000 } });
        });
}

function deleteOldPastWeather() {
    const midnightToday = new Date().setHours(0, 0, 0, 0) / 1000;
    const aWeekAgo = new Date(midnightToday * 1000).setDate(new Date(midnightToday * 1000).getDate() - 7) / 1000;
    client.connect()
        .then((cl) => {
            const db = cl.db(dbName);
            const collection = db.collection('pastWeather');
            collection.deleteMany({ date: { "$lt": aWeekAgo } })
        });
}

app.listen(3001, () => {
    console.log('listening on 3001');
});