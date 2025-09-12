const express = require('express');
const cors = require('cors');
const router = require('./Routers/Router');

const app = express();

app.use(express.json());
app.use(cors());

const port = process.env.PORT || 3000;

app.use('/', router);

app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});
