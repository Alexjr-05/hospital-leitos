const express = require('express')
const router = express.Router()
const db = require('../database/db')

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

router.get('/', async (req, res) => {
    const sql = `
        SELECT
            leitos.id,
            leitos.numero,
            setores.nome AS setor,
            leitos.status,
            pacientes.nome AS paciente,
            pacientes.convenio AS convenio
        FROM leitos
        JOIN setores ON leitos.setor_id = setores.id
        LEFT JOIN pacientes ON leitos.paciente_id = pacientes.id
    `
    try {
        const [results] = await db.query(sql)
        res.json(results)
    } catch (err) {
        console.error(err)
        res.status(500).json({ erro: 'Erro ao buscar leitos' })
    }
})

module.exports = router
