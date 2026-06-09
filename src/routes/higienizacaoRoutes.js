const express = require('express')
const router = express.Router()
const db = require('../database/db')

/* INICIAR HIGIENIZAÇÃO */
router.post('/iniciar', async (req, res) => {
    const { leito_id, responsavel } = req.body

    if (!leito_id || !responsavel?.trim()) {
        return res.status(400).json({ erro: 'leito_id e responsavel são obrigatórios' })
    }

    const conn = await db.getConnection()
    try {
        await conn.beginTransaction()

        const [leitos] = await conn.query(
            "SELECT id FROM leitos WHERE id = ? AND status = 'Higienização'",
            [leito_id]
        )
        if (leitos.length === 0) {
            await conn.rollback()
            return res.status(400).json({ erro: 'Leito não está em estado de higienização' })
        }

        const [ativas] = await conn.query(
            "SELECT id FROM higienizacoes WHERE leito_id = ? AND status = 'Em Andamento'",
            [leito_id]
        )
        if (ativas.length > 0) {
            await conn.rollback()
            return res.status(400).json({ erro: 'Já existe uma higienização em andamento para este leito' })
        }

        const [result] = await conn.query(
            'INSERT INTO higienizacoes (leito_id, responsavel) VALUES (?, ?)',
            [leito_id, responsavel.trim()]
        )

        await conn.query(
            "INSERT INTO historico_movimentacoes (leito_id, acao, descricao) VALUES (?, 'Higienização Iniciada', ?)",
            [leito_id, `Higienização iniciada por ${responsavel.trim()}`]
        )

        await conn.commit()
        res.status(201).json({ mensagem: 'Higienização iniciada com sucesso', id: result.insertId })
    } catch (err) {
        await conn.rollback()
        console.error(err)
        res.status(500).json({ erro: 'Erro ao iniciar higienização' })
    } finally {
        conn.release()
    }
})

/* CONCLUIR HIGIENIZAÇÃO */
router.post('/concluir', async (req, res) => {
    const { higienizacao_id, observacoes } = req.body

    if (!higienizacao_id) {
        return res.status(400).json({ erro: 'higienizacao_id é obrigatório' })
    }

    const conn = await db.getConnection()
    try {
        await conn.beginTransaction()

        const [higs] = await conn.query(
            "SELECT id, leito_id FROM higienizacoes WHERE id = ? AND status = 'Em Andamento'",
            [higienizacao_id]
        )
        if (higs.length === 0) {
            await conn.rollback()
            return res.status(400).json({ erro: 'Higienização não encontrada ou já concluída' })
        }

        const { leito_id } = higs[0]

        await conn.query(
            "UPDATE higienizacoes SET fim = NOW(), status = 'Concluída', observacoes = ? WHERE id = ?",
            [observacoes?.trim() || null, higienizacao_id]
        )

        await conn.query(
            "UPDATE leitos SET status = 'Disponível' WHERE id = ?",
            [leito_id]
        )

        await conn.query(
            "INSERT INTO historico_movimentacoes (leito_id, acao, descricao) VALUES (?, 'Higienização Concluída', 'Leito liberado e disponível para novos pacientes')",
            [leito_id]
        )

        await conn.commit()
        res.json({ mensagem: 'Higienização concluída. Leito disponível.' })
    } catch (err) {
        await conn.rollback()
        console.error(err)
        res.status(500).json({ erro: 'Erro ao concluir higienização' })
    } finally {
        conn.release()
    }
})

/* LISTAR HIGIENIZAÇÕES ATIVAS */
router.get('/ativas', async (req, res) => {
    try {
        const [results] = await db.query(`
            SELECT
                h.id,
                l.numero                                              AS leito_numero,
                s.nome                                                AS setor,
                h.responsavel,
                h.inicio,
                TIMESTAMPDIFF(MINUTE, h.inicio, NOW())               AS minutos_em_andamento
            FROM higienizacoes h
            JOIN leitos  l ON h.leito_id  = l.id
            JOIN setores s ON l.setor_id  = s.id
            WHERE h.status = 'Em Andamento'
            ORDER BY h.inicio
        `)
        res.json(results)
    } catch (err) {
        console.error(err)
        res.status(500).json({ erro: 'Erro ao buscar higienizações ativas' })
    }
})

module.exports = router
