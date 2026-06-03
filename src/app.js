const express = require('express')
const cors = require('cors')

require('./database/db')

const leitosRoutes = require('./routes/leitosRoutes')
const pacientesRoutes = require('./routes/pacientesRoutes')
const internacaoRoutes = require('./routes/internacaoRoutes')

const app = express()

const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:3000']

app.use(cors({ origin: allowedOrigins }))
app.use(express.json())

app.use('/leitos', leitosRoutes)
app.use('/pacientes', pacientesRoutes)
app.use('/internacoes', internacaoRoutes)

app.get('/', (req, res) => {
    res.send('API Hospital funcionando')
})

app.use((req, res) => {
    res.status(404).json({ erro: 'Rota não encontrada' })
})

app.use((err, req, res, next) => {
    console.error(err)
    res.status(500).json({ erro: 'Erro interno do servidor' })
})

module.exports = app
