const express = require('express')
const router = express.Router()
const db = require('../database/db')

/* LISTAR HISTÓRICO COM FILTROS */
router.get('/', async (req, res) => {
    const { leito_id, acao, data_inicio, data_fim, limit = 200 } = req.query

    let sql = `
        SELECT
            h.id,
            h.created_at,
            l.numero       AS leito_numero,
            s.nome         AS setor,
            p.nome         AS paciente_nome,
            h.acao,
            h.descricao,
            h.usuario
        FROM historico_movimentacoes h
        JOIN leitos  l ON h.leito_id   = l.id
        JOIN setores s ON l.setor_id   = s.id
        LEFT JOIN pacientes p ON h.paciente_id = p.id
    `

    const params = []
    const conditions = []

    if (leito_id) {
        conditions.push('h.leito_id = ?')
        params.push(Number(leito_id))
    }

    if (acao) {
        conditions.push('h.acao = ?')
        params.push(acao)
    }

    if (data_inicio) {
        conditions.push('DATE(h.created_at) >= ?')
        params.push(data_inicio)
    }

    if (data_fim) {
        conditions.push('DATE(h.created_at) <= ?')
        params.push(data_fim)
    }

    if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ')
    }

    const limitNum = Math.min(Math.max(parseInt(limit) || 200, 1), 1000)
    sql += ' ORDER BY h.created_at DESC LIMIT ?'
    params.push(limitNum)

    try {
        const [results] = await db.query(sql, params)
        res.json(results)
    } catch (err) {
        console.error(err)
        res.status(500).json({ erro: 'Erro ao buscar histórico' })
    }
})

module.exports = router
