const express = require('express')
const cors = require('cors')

require('./database/db')

const leitosRoutes       = require('./routes/leitosRoutes')
const pacientesRoutes    = require('./routes/pacientesRoutes')
const internacaoRoutes   = require('./routes/internacaoRoutes')
const higienizacaoRoutes = require('./routes/higienizacaoRoutes')
const reservaRoutes      = require('./routes/reservaRoutes')
const bloqueioRoutes     = require('./routes/bloqueioRoutes')
const historicoRoutes    = require('./routes/historicoRoutes')
const relatoriosRoutes   = require('./routes/relatoriosRoutes')

const app = express()

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:4000',
      'https://hospital-leitos-frontend.vercel.app'
    ]
app.use(cors({
    origin: (origin, callback) => {
        // Permite: sem origin, string "null" (file://), e origens da lista
        if (!origin || origin === 'null' || allowedOrigins.includes(origin)) {
            callback(null, true)
        } else {
            callback(new Error('CORS bloqueado'))
        }
    }
}))
app.use(express.json())

app.use('/leitos',        leitosRoutes)
app.use('/pacientes',     pacientesRoutes)
app.use('/internacoes',   internacaoRoutes)
app.use('/higienizacoes', higienizacaoRoutes)
app.use('/reservas',      reservaRoutes)
app.use('/bloqueios',     bloqueioRoutes)
app.use('/historico',     historicoRoutes)
app.use('/relatorios',    relatoriosRoutes)

app.get('/', (req, res) => {
    res.json({
        sistema: 'API Hospital UMC',
        versao: '2.0',
        endpoints: [
            '/leitos', '/pacientes', '/internacoes',
            '/higienizacoes', '/reservas', '/bloqueios',
            '/historico', '/relatorios'
        ]
    })
})

app.use((req, res) => {
    res.status(404).json({ erro: 'Rota não encontrada' })
})

app.use((err, req, res, next) => {
    console.error(err)
    res.status(500).json({ erro: 'Erro interno do servidor' })
})

module.exports = app
