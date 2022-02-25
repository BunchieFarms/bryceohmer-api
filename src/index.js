import fetch from 'node-fetch';
import express from 'express';
import cron from 'node-cron';
import { MongoClient } from 'mongodb';
import 'dotenv/config';

const app = express();
const mongoUri = process.env.MONGO_URI;
const client = new MongoClient(mongoUri);
const dbName = 'bryceohmer';

app.get('/api/currentWeather', (req, res) => {
    client.connect()
        .then((cl) => {
            const db = cl.db(dbName);
            const collection = db.collection('currentWeather');
            collection.find({}).limit(1).sort({_id: -1}).toArray()
                .then((data) => res.send(data));
        });
});

// For testing
// cron.schedule(`*/2 * * * * *`, () => {
//     console.log('doing the dang thang')
//     saveHistorical()
// })

//Fetch current weather every hour
cron.schedule(`0 * * * *`, () => {
    saveCurrentWeather();
});

//Fetch forecast and historical once a day at 8am
cron.schedule(`0 8 * * *`, () => {
    saveForecast();
    saveHistorical();
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

function saveHistorical() {
    client.connect()
        .then((cl) => {
            const db = cl.db(dbName);
            const collection = db.collection('currentWeather');
            collection.findOne({zip: 28461})
                .then((found) => {
                    fetch(`http://api.openweathermap.org/data/2.5/onecall/timemachine?lat=${found.coord.lat}&lon=${found.coord.lon}&dt=${Math.floor(new Date().getTime() / 1000) - 43200}&appid=${process.env.WEATHER_KEY}`)
                        .then((res) => res.json())
                        .then((data) => {
                            data.zip = 28461;

                            const collection = db.collection('weatherHistory');
                            collection.insertOne(data);
                        });
                });
        });
}

function saveForecast() {
    fetch(`https://api.openweathermap.org/data/2.5/onecall?lat=33.9357466&lon=-78.0546333&exclude=minutely,hourly,current,alerts&appid=${process.env.WEATHER_KEY}`)
        .then((res) => res.json())
        .then((data => {
            data.daily.forEach((w) => {
                w.weather[0].iconUrl = `http://openweathermap.org/img/wn/${data.weather[0].icon}@4x.png`
            });

            client.connect()
                .then((cl) => {
                    const db = cl.db(dbName);
                    const collection = db.collection('weatherForecast');
                    collection.insertOne(data);
                });
        }))
}

app.listen(3001, () => {
    console.log('listening on 3001');
});