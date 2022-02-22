import fetch from 'node-fetch';
import express from 'express';
import bodyParser from 'body-parser';

const app = express();

app.get('/api/weather', (req, res) => {
    fetch('http://api.openweathermap.org/data/2.5/weather?zip=28461&appid=12a6b20d756c5b22ec58b419b759d177')
        .then((res) => res.json())
        .then((data) => {
            data.weather[0].iconUrl = `http://openweathermap.org/img/wn/${data.weather[0].icon}@4x.png`;
            res.send(data);
        });
});

app.listen(3001, () => {
    console.log('listening on 3001');
})