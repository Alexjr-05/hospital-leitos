const express = require('express')
const cors = require('cors')

require('./database/db')

const leitosRoutes = require('./routes/leitosRoutes')

const app = express()

app.use(cors())
app.use(express.json())

app.use('/leitos', leitosRoutes)

app.get('/', (req, res) => {
    res.send('API Hospital funcionando')
})

module.exports = app