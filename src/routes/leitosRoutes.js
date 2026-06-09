const express = require('express')
const router = express.Router()
const db = require('../database/db')

/* LEITOS DISPONÍVEIS — para reserva */
router.get('/disponiveis', async (req, res) => {
    try {
        const [results] = await db.query(
            "SELECT id, numero FROM leitos WHERE status = 'Disponível' ORDER BY numero"
        )
        res.json(results)
    } catch (err) {
        console.error(err)
        res.status(500).json({ erro: 'Erro ao buscar leitos disponíveis' })
    }
})

/* LEITOS INTERNAVEIS — disponível ou reservado */
router.get('/internaveis', async (req, res) => {
    try {
        const [results] = await db.query(
            "SELECT id, numero, status FROM leitos WHERE status IN ('Disponível', 'Reservado') ORDER BY numero"
        )
        res.json(results)
    } catch (err) {
        console.error(err)
        res.status(500).json({ erro: 'Erro ao buscar leitos internaveis' })
    }
})

/* LEITOS OCUPADOS — para alta e transferência de origem */
router.get('/ocupados', async (req, res) => {
    try {
        const [results] = await db.query(`
            SELECT l.id, l.numero, p.nome AS paciente, s.nome AS setor
            FROM leitos l
            LEFT JOIN pacientes p ON l.paciente_id = p.id
            JOIN setores s ON l.setor_id = s.id
            WHERE l.status = 'Ocupado'
            ORDER BY l.numero
        `)
        res.json(results)
    } catch (err) {
        console.error(err)
        res.status(500).json({ erro: 'Erro ao buscar leitos ocupados' })
    }
})

/* LEITOS EM HIGIENIZAÇÃO — para iniciar higienização */
router.get('/em-higienizacao', async (req, res) => {
    try {
        const [results] = await db.query(
            "SELECT id, numero FROM leitos WHERE status = 'Higienização' ORDER BY numero"
        )
        res.json(results)
    } catch (err) {
        console.error(err)
        res.status(500).json({ erro: 'Erro ao buscar leitos em higienização' })
    }
})

/* LEITOS BLOQUEADOS — para desbloqueio */
router.get('/bloqueados', async (req, res) => {
    try {
        const [results] = await db.query(
            "SELECT id, numero FROM leitos WHERE status = 'Bloqueado' ORDER BY numero"
        )
        res.json(results)
    } catch (err) {
        console.error(err)
        res.status(500).json({ erro: 'Erro ao buscar leitos bloqueados' })
    }
})

/* TODOS OS LEITOS — dashboard */
router.get('/', async (req, res) => {
    try {
        const [results] = await db.query(`
            SELECT
                l.id,
                l.numero,
                s.nome   AS setor,
                l.status,
                p.nome   AS paciente,
                p.convenio
            FROM leitos l
            JOIN setores  s ON l.setor_id   = s.id
            LEFT JOIN pacientes p ON l.paciente_id = p.id
            ORDER BY s.nome, l.numero
        `)
        res.json(results)
    } catch (err) {
        console.error(err)
        res.status(500).json({ erro: 'Erro ao buscar leitos' })
    }
})

module.exports = router
